// Package aipreview implements the ai_preview task: take a mother's raw
// record, ask an LLM to polish it into a 1–2 sentence emotional preview,
// and publish the outcome on the per-user result channel. Persistence
// and SSE fanout are the backend's responsibility.
package aipreview

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/dlddu/dear-baby/worker/internal/openrouter"
	"github.com/dlddu/dear-baby/worker/internal/protocol"
)

// TaskType is the envelope discriminator the backend tags ai_preview
// jobs with. Exported so callers (and tests) can build envelopes
// without hard-coding the literal.
const TaskType = "ai_preview"

// SystemPrompt is the single tuning knob for the preview tone. Keep it
// short and stable — this text is not user-facing, so we don't need
// translation or variants.
const SystemPrompt = "임신 중 엄마가 남긴 짧은 기록을 1~2문장의 따뜻한 감성 미리보기로 다듬어줘. 원문의 사실은 바꾸지 마. 경어체 유지. 이모지 1개 허용."

// HandleTimeout caps the OpenRouter call so one slow model can't stall
// the worker indefinitely. 15s matches the SSE client's wait tolerance —
// anything longer on the server side would exceed the E2E timeout
// anyway.
const HandleTimeout = 15 * time.Second

// MaxTokens caps output so a misbehaving model can't run the meter. A
// 1–2 sentence Korean preview is well under 200 tokens.
const MaxTokens = 300

// Publisher is the slice of redis we need: publish a string payload on a
// channel. Defined as an interface so tests can substitute a recorder
// without standing up miniredis.
type Publisher interface {
	Publish(ctx context.Context, channel, message string) error
}

// Sender is the OpenRouter surface this task uses. Mirrors
// (*openrouter.Client).Send so the concrete client can be passed
// directly while tests inject a stub.
type Sender interface {
	Send(ctx context.Context, req openrouter.ChatRequest) (openrouter.ChatResponse, error)
}

// Flusher lets the task synchronously wait for trace export after the
// LLM call. nil receivers are tolerated so dev runs without tracing
// don't have to inject a stub.
type Flusher interface {
	Flush(ctx context.Context)
}

// Deps is the bundle the task receives. All collaborators are
// interfaces so each can be replaced in tests.
type Deps struct {
	Redis   Publisher
	Chat    Sender
	Model   string
	Logger  *slog.Logger
	Tracing Flusher // optional; may be nil
}

// Task is the registered handler. Construct via New so deps are
// validated up front.
type Task struct {
	deps Deps
}

// New returns a configured task. Required deps panic up front rather
// than failing only when the first envelope arrives.
func New(deps Deps) *Task {
	if deps.Redis == nil {
		panic("aipreview: Deps.Redis is required")
	}
	if deps.Chat == nil {
		panic("aipreview: Deps.Chat is required")
	}
	if deps.Model == "" {
		panic("aipreview: Deps.Model is required")
	}
	if deps.Logger == nil {
		deps.Logger = slog.Default()
	}
	return &Task{deps: deps}
}

// Type implements framework.Task.
func (t *Task) Type() string { return TaskType }

// payload is the wire shape backend producers send. Pointer fields would
// let us distinguish unset from empty, but the zero-string case is
// rejected by validation regardless, so plain strings are cleaner.
type payload struct {
	UserID   string `json:"user_id"`
	RecordID string `json:"record_id"`
	Content  string `json:"content"`
	// Attempt is echoed back in the result so the backend can decide
	// whether to schedule another retry or surface a final error. 0 is
	// treated as "first attempt" to stay wire-compatible with older
	// producers that never set it.
	Attempt int `json:"attempt"`
}

func (p *payload) validate() error {
	if p.UserID == "" {
		return errors.New("payload: user_id is required")
	}
	if p.RecordID == "" {
		return errors.New("payload: record_id is required")
	}
	if p.Content == "" {
		return errors.New("payload: content is required")
	}
	if p.Attempt < 1 {
		p.Attempt = 1
	}
	return nil
}

// errorResult is a small superset of protocol.ResultError that also
// carries the attempt counter. The backend reads this to decide
// whether to re-enqueue.
type errorResult struct {
	Status  string `json:"status"`
	Error   string `json:"error"`
	Attempt int    `json:"attempt"`
}

// Handle implements framework.Task. Errors returned here are logged by
// the framework but never re-throw to the consume loop — the published
// result is the source of truth for the backend.
func (t *Task) Handle(ctx context.Context, raw []byte) error {
	var p payload
	if err := json.Unmarshal(raw, &p); err != nil {
		return fmt.Errorf("ai_preview: payload unmarshal: %w", err)
	}
	if err := p.validate(); err != nil {
		return fmt.Errorf("ai_preview: payload invalid: %w", err)
	}

	log := t.deps.Logger.With(
		"task", TaskType,
		"user_id", p.UserID,
		"attempt", p.Attempt,
	)
	log.Debug("handle start",
		"model", t.deps.Model,
		"content_length", len(p.Content),
	)
	started := time.Now()

	callCtx, cancel := context.WithTimeout(ctx, HandleTimeout)
	defer cancel()

	preview, err := t.generate(callCtx, p.Content)
	if err != nil {
		msg := err.Error()
		log.Error("preview generation failed", "err", msg)
		t.publishError(ctx, p, msg, log)
		return nil
	}

	log.Debug("openrouter returned",
		"elapsed_ms", time.Since(started).Milliseconds(),
		"preview_length", len(preview),
	)

	ok := protocol.NewResultOK()
	ok.Preview = preview
	body, err := json.Marshal(ok)
	if err != nil {
		// Marshaling a struct with two strings shouldn't fail in
		// practice; treat it as a programmer error and publish an error
		// so the user doesn't sit on a hung SSE.
		t.publishError(ctx, p, "preview marshal: "+err.Error(), log)
		return nil
	}
	if err := t.deps.Redis.Publish(ctx, protocol.ResultChannel(TaskType, p.UserID), string(body)); err != nil {
		log.Error("failed to publish ok result", "err", err.Error())
		return nil
	}
	log.Info("preview ready",
		"preview", preview,
		"elapsed_ms", time.Since(started).Milliseconds(),
	)
	return nil
}

// generate isolates the LLM round-trip so tests can stub it via the
// Sender interface without setting up SDK internals.
func (t *Task) generate(ctx context.Context, content string) (string, error) {
	resp, err := t.deps.Chat.Send(ctx, openrouter.ChatRequest{
		Model: t.deps.Model,
		Messages: []openrouter.Message{
			{Role: openrouter.RoleSystem, Content: SystemPrompt},
			{Role: openrouter.RoleUser, Content: content},
		},
		MaxTokens: MaxTokens,
	})
	// Force the OTel span processor to flush before we return — otherwise
	// CI pods get killed ~1s after the preview completes and the span
	// export request never gets off the box. No-op when tracing is off.
	if t.deps.Tracing != nil {
		flushCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		t.deps.Tracing.Flush(flushCtx)
		cancel()
	}
	if err != nil {
		return "", err
	}
	text := strings.TrimSpace(resp.Content)
	if text == "" {
		return "", errors.New("empty preview from model")
	}
	return text, nil
}

// publishError swallows publish failures after logging — the worker has
// to take the next job either way, and dropping the error result is no
// worse than crashing here.
func (t *Task) publishError(ctx context.Context, p payload, msg string, log *slog.Logger) {
	body, err := json.Marshal(errorResult{
		Status:  "error",
		Error:   msg,
		Attempt: p.Attempt,
	})
	if err != nil {
		log.Error("failed to marshal error result", "err", err.Error())
		return
	}
	if err := t.deps.Redis.Publish(ctx, protocol.ResultChannel(TaskType, p.UserID), string(body)); err != nil {
		log.Error("failed to publish error result", "err", err.Error())
	}
}
