// Package framework hosts the worker event loop and the task registry.
// It is intentionally narrow: it knows about Redis (for BRPOP and result
// fan-out is the task's job), the protocol envelope, and a Task
// interface. Concrete tasks bind their own dependencies at construction
// time so this layer stays free of openrouter / tracing imports.
package framework

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/dlddu/dear-baby/worker/internal/protocol"
)

// Task is what the registry dispatches. Tasks own their own deps —
// constructing a *Task at boot lets them embed mock-friendly interfaces
// without leaking through this layer.
type Task interface {
	// Type matches the envelope's `type` discriminator.
	Type() string
	// Handle owns the entire job lifecycle: parse payload, call the
	// model, publish the result. Errors returned here are logged but
	// don't kill the worker — task failures are expected to be published
	// by the task itself on the result channel.
	Handle(ctx context.Context, payload []byte) error
}

// Registry tracks tasks by type and dispatches raw envelopes to them.
// Decoupled from the runner so tests can exercise dispatch without
// spinning up a real Redis loop.
type Registry struct {
	tasks map[string]Task
}

// NewRegistry returns an empty registry.
func NewRegistry() *Registry {
	return &Registry{tasks: map[string]Task{}}
}

// Register adds a task. Returns an error if the type is already taken so
// the caller can choose between MustRegister (panic) and a soft error.
func (r *Registry) Register(t Task) error {
	if t == nil {
		return errors.New("registry: nil task")
	}
	if _, exists := r.tasks[t.Type()]; exists {
		return fmt.Errorf("registry: duplicate task type %q", t.Type())
	}
	r.tasks[t.Type()] = t
	return nil
}

// MustRegister panics on duplicate registration. Used at boot where a
// duplicate is a programmer error.
func (r *Registry) MustRegister(t Task) {
	if err := r.Register(t); err != nil {
		panic(err)
	}
}

// Types returns the registered task types. Order is map-iteration order
// — only used for boot logging where order doesn't matter.
func (r *Registry) Types() []string {
	out := make([]string, 0, len(r.tasks))
	for k := range r.tasks {
		out = append(out, k)
	}
	return out
}

// Dispatch parses the envelope, looks up the task, and runs it. The
// payload is forwarded as raw JSON bytes — each task validates its own
// shape so this layer doesn't grow per-task knowledge.
func (r *Registry) Dispatch(ctx context.Context, raw []byte) error {
	env, err := protocol.ParseEnvelope(raw)
	if err != nil {
		return err
	}
	t, ok := r.tasks[env.Type]
	if !ok {
		return fmt.Errorf("unknown task type: %s", env.Type)
	}
	return t.Handle(ctx, env.Payload)
}

// BRPopper is the slice of go-redis we use. Defining it here lets tests
// pass a fake without standing up miniredis.
type BRPopper interface {
	BRPop(ctx context.Context, timeout time.Duration, keys ...string) *redis.StringSliceCmd
}

// WorkerOptions configures the consume loop. BlockTimeout has to be
// non-zero so the loop can notice ctx cancellation between BRPOP calls;
// 5s keeps spin cost negligible while staying responsive to SIGTERM.
type WorkerOptions struct {
	Registry     *Registry
	Redis        BRPopper
	Logger       *slog.Logger
	BlockTimeout time.Duration
	// BackoffOnError is the pause after a redis-level failure (not a
	// timeout). Prevents a Redis outage from spinning the CPU.
	BackoffOnError time.Duration
}

// Worker is the running consume loop. Construct via RunWorker.
type Worker struct {
	opts WorkerOptions
	done chan struct{}
	once sync.Once
}

// RunWorker starts the consume loop in the calling goroutine via the
// returned Worker.Run method. Callers typically do `go w.Run(ctx)` and
// then signal cancellation through ctx + Wait for graceful drain.
func RunWorker(opts WorkerOptions) *Worker {
	if opts.BlockTimeout <= 0 {
		opts.BlockTimeout = 5 * time.Second
	}
	if opts.BackoffOnError <= 0 {
		opts.BackoffOnError = time.Second
	}
	return &Worker{
		opts: opts,
		done: make(chan struct{}),
	}
}

// Run blocks until ctx is cancelled. Errors are logged and the loop
// continues — task-level failures are published on the result channel,
// not raised here.
func (w *Worker) Run(ctx context.Context) {
	defer w.once.Do(func() { close(w.done) })

	w.opts.Logger.Info("entering consume loop",
		"queue", protocol.QueueKey,
		"block_timeout", w.opts.BlockTimeout.String(),
	)

	for {
		if ctx.Err() != nil {
			return
		}
		raw, err := w.popOne(ctx)
		if err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return
			}
			if errors.Is(err, redis.Nil) {
				continue // BRPOP timeout — normal idle, just loop.
			}
			w.opts.Logger.Error("brpop failed", "err", err.Error())
			// Back off briefly before retrying so a Redis outage does not
			// spin the CPU.
			select {
			case <-ctx.Done():
				return
			case <-time.After(w.opts.BackoffOnError):
			}
			continue
		}
		if len(raw) == 0 {
			continue
		}

		w.opts.Logger.Debug("brpop returned task", "raw_length", len(raw))
		if err := w.opts.Registry.Dispatch(ctx, raw); err != nil {
			w.opts.Logger.Error("dispatch failed", "err", err.Error(), "raw", string(raw))
			continue
		}
		w.opts.Logger.Debug("task dispatch finished")
	}
}

func (w *Worker) popOne(ctx context.Context) ([]byte, error) {
	res, err := w.opts.Redis.BRPop(ctx, w.opts.BlockTimeout, protocol.QueueKey).Result()
	if err != nil {
		return nil, err
	}
	if len(res) < 2 {
		return nil, nil
	}
	return []byte(res[1]), nil
}

// Wait blocks until Run returns. Use after cancelling the worker's
// context to drain the in-flight job.
func (w *Worker) Wait() {
	<-w.done
}
