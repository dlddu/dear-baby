package tasks

import (
	"context"
	"log/slog"
	"strings"
	"sync"

	"github.com/redis/go-redis/v9"
)

// Result is the decoded event a subscriber receives. The body is the raw
// pub/sub message bytes — the SSE handler forwards it verbatim.
type Result struct {
	TaskType string
	UserID   string
	Body     []byte
}

// Hub fans Redis pub/sub messages out to per-subscriber channels. Backend
// opens one pattern subscription for `tasks:result:*` and routes each
// message to whichever SSE handlers are interested in that (task, user)
// pair. Subscribers register with Subscribe and release with the returned
// cancel function.
type Hub struct {
	Redis  *redis.Client
	Logger *slog.Logger

	mu      sync.RWMutex
	subs    map[string]map[chan Result]struct{} // key = taskType + "|" + userID
	started bool
}

func key(taskType, userID string) string { return taskType + "|" + userID }

// NewHub constructs a Hub. Run must be called once per process to start the
// background pub/sub loop.
func NewHub(r *redis.Client, l *slog.Logger) *Hub {
	return &Hub{
		Redis:  r,
		Logger: l,
		subs:   make(map[string]map[chan Result]struct{}),
	}
}

// Run starts the pub/sub reader and blocks until the context is cancelled.
// Safe to call exactly once.
func (h *Hub) Run(ctx context.Context) error {
	h.mu.Lock()
	if h.started {
		h.mu.Unlock()
		return nil
	}
	h.started = true
	h.mu.Unlock()

	ps := h.Redis.PSubscribe(ctx, "tasks:result:*")
	defer ps.Close()
	ch := ps.Channel()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg, ok := <-ch:
			if !ok {
				return nil
			}
			h.dispatch(msg.Channel, []byte(msg.Payload))
		}
	}
}

func (h *Hub) dispatch(channel string, body []byte) {
	// channel looks like "tasks:result:{task_type}:{user_id}". Split from
	// the right so user_id containing ':' would still work, but our ids are
	// UUIDs so there are no colons in practice.
	rest := strings.TrimPrefix(channel, "tasks:result:")
	sep := strings.LastIndex(rest, ":")
	if sep < 0 {
		return
	}
	taskType := rest[:sep]
	userID := rest[sep+1:]

	h.mu.RLock()
	targets := h.subs[key(taskType, userID)]
	fanout := make([]chan Result, 0, len(targets))
	for c := range targets {
		fanout = append(fanout, c)
	}
	h.mu.RUnlock()

	res := Result{TaskType: taskType, UserID: userID, Body: body}
	for _, c := range fanout {
		// Drop on full — subscribers own a buffered channel; if they can't
		// keep up, we'd rather drop than stall the whole hub.
		select {
		case c <- res:
		default:
			if h.Logger != nil {
				h.Logger.Warn("tasks hub: dropping result (slow subscriber)", "task", taskType, "user", userID)
			}
		}
	}
}

// Subscribe returns a channel that receives all results for the (taskType,
// userID) pair until the returned cancel function is called.
func (h *Hub) Subscribe(taskType, userID string) (<-chan Result, func()) {
	ch := make(chan Result, 8)
	k := key(taskType, userID)
	h.mu.Lock()
	if h.subs[k] == nil {
		h.subs[k] = make(map[chan Result]struct{})
	}
	h.subs[k][ch] = struct{}{}
	h.mu.Unlock()

	return ch, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if set, ok := h.subs[k]; ok {
			delete(set, ch)
			if len(set) == 0 {
				delete(h.subs, k)
			}
		}
		close(ch)
	}
}
