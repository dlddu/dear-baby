package tasks

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"

	"github.com/redis/go-redis/v9"
)

// resultChannelPattern matches every per-user result stream. The hub
// keeps a single PSUBSCRIBE open and fans messages out to local
// subscribers keyed by (task_type, user_id).
const resultChannelPattern = "tasks:result:*"

// ResultMessage is the decoded (task_type, user_id, payload) delivered
// from the hub to each subscriber. Payload is the raw JSON string the
// worker published — consumers parse their own shape.
type ResultMessage struct {
	TaskType string
	UserID   string
	Payload  string
}

// ResultProcessor runs on every inbound result for a task type before
// fanout. Returning a non-nil error cancels fanout: the typical use is
// persisting the outcome (e.g. writing ai_preview to the DB) so that a
// late-arriving SSE client can still read the value from the snapshot.
// If persistence fails, dropping the fanout keeps the UI consistent —
// the client will re-subscribe / retry and hit the still-null snapshot.
type ResultProcessor func(ctx context.Context, userID, payload string) error

// Hub fans Redis pub/sub messages out to in-process subscribers. One
// PSUBSCRIBE in front of N SSE goroutines so a burst of connected
// clients does not multiply Redis connections.
type Hub struct {
	Redis  *redis.Client
	Logger *slog.Logger

	mu          sync.Mutex
	subscribers map[subscriberKey]map[chan ResultMessage]struct{}
	processors  map[string]ResultProcessor
	running     bool
	cancel      context.CancelFunc
}

type subscriberKey struct {
	TaskType string
	UserID   string
}

// RegisterProcessor attaches a processor for a given task type. Must be
// called before Start — the loop reads the map without locking on the
// hot path. Overwrites any previously registered processor for the same
// task type.
func (h *Hub) RegisterProcessor(taskType string, p ResultProcessor) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.running {
		panic("tasks.Hub: RegisterProcessor called after Start")
	}
	if h.processors == nil {
		h.processors = make(map[string]ResultProcessor)
	}
	h.processors[taskType] = p
}

// Start begins the background PSUBSCRIBE loop. Idempotent: calling twice
// is safe; the second call is a no-op.
func (h *Hub) Start(ctx context.Context) error {
	h.mu.Lock()
	if h.running {
		h.mu.Unlock()
		return nil
	}
	h.subscribers = make(map[subscriberKey]map[chan ResultMessage]struct{})
	runCtx, cancel := context.WithCancel(ctx)
	h.cancel = cancel
	h.running = true
	h.mu.Unlock()

	ps := h.Redis.PSubscribe(runCtx, resultChannelPattern)
	// Receive once with a short timeout so errors surface at Start time,
	// not half an hour later on the first real message.
	if _, err := ps.Receive(runCtx); err != nil {
		h.mu.Lock()
		h.running = false
		h.mu.Unlock()
		cancel()
		return fmt.Errorf("psubscribe receive: %w", err)
	}

	go h.loop(runCtx, ps)
	return nil
}

// Stop signals the loop to shut down and closes every outstanding
// subscriber channel. Safe to call after Start or as a no-op.
func (h *Hub) Stop() {
	h.mu.Lock()
	if !h.running {
		h.mu.Unlock()
		return
	}
	h.running = false
	cancel := h.cancel
	subs := h.subscribers
	h.subscribers = nil
	h.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	for _, chans := range subs {
		for ch := range chans {
			close(ch)
		}
	}
}

// Subscribe returns a channel that receives every result matching the
// given (task_type, user_id). The caller must invoke the returned
// unsubscribe function when done. Unsubscribing is idempotent.
func (h *Hub) Subscribe(taskType, userID string) (<-chan ResultMessage, func()) {
	ch := make(chan ResultMessage, 8)
	key := subscriberKey{TaskType: taskType, UserID: userID}

	h.mu.Lock()
	if h.subscribers == nil {
		h.subscribers = make(map[subscriberKey]map[chan ResultMessage]struct{})
	}
	chans, ok := h.subscribers[key]
	if !ok {
		chans = make(map[chan ResultMessage]struct{})
		h.subscribers[key] = chans
	}
	chans[ch] = struct{}{}
	h.mu.Unlock()

	unsub := func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		cs, ok := h.subscribers[key]
		if !ok {
			return
		}
		if _, ok := cs[ch]; !ok {
			return
		}
		delete(cs, ch)
		if len(cs) == 0 {
			delete(h.subscribers, key)
		}
		close(ch)
	}
	return ch, unsub
}

// loop pumps messages from the Redis pubsub channel out to local subscribers.
func (h *Hub) loop(ctx context.Context, ps *redis.PubSub) {
	defer ps.Close()
	msgCh := ps.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-msgCh:
			if !ok {
				return
			}
			h.deliver(ctx, msg)
		}
	}
}

// deliver parses a raw pubsub message, runs any registered processor
// (e.g. DB persistence), and hands the result to every subscriber for
// the matching (task_type, user_id). Full buffers are dropped so a slow
// SSE client cannot block the hub — clients receive only the latest
// outcome in that case, which matches UX expectations (one status
// transition per job).
func (h *Hub) deliver(ctx context.Context, msg *redis.Message) {
	taskType, userID, ok := parseChannel(msg.Channel)
	if !ok {
		if h.Logger != nil {
			h.Logger.Warn("unparseable task result channel", "channel", msg.Channel)
		}
		return
	}

	// Processors run before fanout so persistence is visible to any
	// snapshot read that follows the SSE notification. A processor error
	// drops fanout entirely — see ResultProcessor docs for rationale.
	if p := h.processors[taskType]; p != nil {
		if err := p(ctx, userID, msg.Payload); err != nil {
			if h.Logger != nil {
				h.Logger.Warn("result processor failed; dropping fanout",
					"task", taskType, "user_id", userID, "err", err)
			}
			return
		}
	}

	rm := ResultMessage{TaskType: taskType, UserID: userID, Payload: msg.Payload}

	h.mu.Lock()
	chans := h.subscribers[subscriberKey{TaskType: taskType, UserID: userID}]
	// Copy so we can release the mutex before sending.
	if len(chans) == 0 {
		h.mu.Unlock()
		return
	}
	out := make([]chan ResultMessage, 0, len(chans))
	for ch := range chans {
		out = append(out, ch)
	}
	h.mu.Unlock()

	for _, ch := range out {
		select {
		case ch <- rm:
		default:
			if h.Logger != nil {
				h.Logger.Warn("dropping result for slow subscriber", "user_id", userID)
			}
		}
	}
}

// parseChannel splits "tasks:result:<type>:<user_id>" into its parts.
// Returns false if the channel doesn't match.
func parseChannel(channel string) (taskType, userID string, ok bool) {
	const prefix = "tasks:result:"
	if !strings.HasPrefix(channel, prefix) {
		return "", "", false
	}
	rest := channel[len(prefix):]
	// taskType:userID — task types today are simple ascii (e.g. ai_preview),
	// so a single colon split is enough.
	idx := strings.Index(rest, ":")
	if idx <= 0 || idx == len(rest)-1 {
		return "", "", false
	}
	return rest[:idx], rest[idx+1:], true
}
