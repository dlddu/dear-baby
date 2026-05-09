package aipreview_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"strings"
	"sync"
	"testing"

	"github.com/dlddu/dear-baby/worker/internal/openrouter"
	"github.com/dlddu/dear-baby/worker/internal/protocol"
	"github.com/dlddu/dear-baby/worker/internal/tasks/aipreview"
)

// fakeChat stands in for *openrouter.Client. The fixed reply lets tests
// assert on the published preview without setting up SDK internals.
type fakeChat struct {
	mu       sync.Mutex
	calls    int
	lastReq  openrouter.ChatRequest
	response openrouter.ChatResponse
	err      error
}

func (f *fakeChat) Send(_ context.Context, req openrouter.ChatRequest) (openrouter.ChatResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	f.lastReq = req
	if f.err != nil {
		return openrouter.ChatResponse{}, f.err
	}
	return f.response, nil
}

// fakePublisher records every publish; the result channel SSE depends on
// is implicit so tests assert on channel name and message body.
type fakePublisher struct {
	mu       sync.Mutex
	pubs     []publishCall
	pubErr   error
}

type publishCall struct {
	channel string
	message string
}

func (f *fakePublisher) Publish(_ context.Context, channel, message string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.pubErr != nil {
		return f.pubErr
	}
	f.pubs = append(f.pubs, publishCall{channel: channel, message: message})
	return nil
}

func (f *fakePublisher) calls() []publishCall {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]publishCall, len(f.pubs))
	copy(out, f.pubs)
	return out
}

func silentLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func newTask(t *testing.T, chat *fakeChat, pub *fakePublisher) *aipreview.Task {
	t.Helper()
	return aipreview.New(aipreview.Deps{
		Redis:  pub,
		Chat:   chat,
		Model:  "test-model",
		Logger: silentLogger(),
	})
}

func envelopePayload(t *testing.T, p map[string]any) []byte {
	t.Helper()
	b, err := json.Marshal(p)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	return b
}

func TestHandle_PublishesOK(t *testing.T) {
	t.Parallel()
	chat := &fakeChat{response: openrouter.ChatResponse{Content: "정리된 미리보기 ✨"}}
	pub := &fakePublisher{}
	task := newTask(t, chat, pub)

	payload := envelopePayload(t, map[string]any{
		"user_id":   "u1",
		"record_id": "r1",
		"content":   "오늘 너의 움직임을 처음 느꼈어.",
		"attempt":   1,
	})
	if err := task.Handle(context.Background(), payload); err != nil {
		t.Fatalf("handle: %v", err)
	}

	pubs := pub.calls()
	if len(pubs) != 1 {
		t.Fatalf("expected 1 publish, got %d", len(pubs))
	}
	if pubs[0].channel != protocol.ResultChannel(aipreview.TaskType, "u1") {
		t.Fatalf("channel = %q", pubs[0].channel)
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(pubs[0].message), &body); err != nil {
		t.Fatalf("unmarshal published body: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("status = %v", body["status"])
	}
	if body["preview"] != "정리된 미리보기 ✨" {
		t.Fatalf("preview = %v", body["preview"])
	}

	if chat.calls != 1 {
		t.Fatalf("openrouter calls = %d", chat.calls)
	}
	req := chat.lastReq
	if req.Model != "test-model" {
		t.Fatalf("model = %q", req.Model)
	}
	if len(req.Messages) != 2 {
		t.Fatalf("messages = %d", len(req.Messages))
	}
	if req.Messages[0].Role != openrouter.RoleSystem {
		t.Fatalf("first message role = %q", req.Messages[0].Role)
	}
	if !strings.Contains(req.Messages[1].Content, "움직임") {
		t.Fatalf("user content not forwarded: %q", req.Messages[1].Content)
	}
}

func TestHandle_PublishesErrorWithAttemptOnLLMFailure(t *testing.T) {
	t.Parallel()
	chat := &fakeChat{err: errors.New("openrouter down")}
	pub := &fakePublisher{}
	task := newTask(t, chat, pub)

	payload := envelopePayload(t, map[string]any{
		"user_id":   "u9",
		"record_id": "r9",
		"content":   "x",
		"attempt":   2,
	})
	if err := task.Handle(context.Background(), payload); err != nil {
		t.Fatalf("handle should swallow LLM errors, got %v", err)
	}

	pubs := pub.calls()
	if len(pubs) != 1 {
		t.Fatalf("expected 1 publish, got %d", len(pubs))
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(pubs[0].message), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["status"] != "error" {
		t.Fatalf("status = %v", body["status"])
	}
	if !strings.Contains(body["error"].(string), "openrouter down") {
		t.Fatalf("error message = %v", body["error"])
	}
	// Backend retry policy reads attempt to decide whether to re-enqueue.
	if got, want := int(body["attempt"].(float64)), 2; got != want {
		t.Fatalf("attempt = %d, want %d", got, want)
	}
}

func TestHandle_PublishesErrorOnEmptyModelOutput(t *testing.T) {
	t.Parallel()
	chat := &fakeChat{response: openrouter.ChatResponse{Content: "   "}}
	pub := &fakePublisher{}
	task := newTask(t, chat, pub)

	payload := envelopePayload(t, map[string]any{
		"user_id":   "u2",
		"record_id": "r2",
		"content":   "x",
		"attempt":   1,
	})
	if err := task.Handle(context.Background(), payload); err != nil {
		t.Fatalf("handle: %v", err)
	}
	pubs := pub.calls()
	if len(pubs) != 1 {
		t.Fatalf("expected 1 publish, got %d", len(pubs))
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(pubs[0].message), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["status"] != "error" {
		t.Fatalf("status = %v", body["status"])
	}
	if !strings.Contains(body["error"].(string), "empty preview") {
		t.Fatalf("error message = %v", body["error"])
	}
	if got, want := int(body["attempt"].(float64)), 1; got != want {
		t.Fatalf("attempt = %d, want %d", got, want)
	}
}

func TestHandle_SurvivesPublishFailure(t *testing.T) {
	t.Parallel()
	chat := &fakeChat{err: errors.New("openrouter down")}
	pub := &fakePublisher{pubErr: errors.New("redis unavailable")}
	task := newTask(t, chat, pub)

	payload := envelopePayload(t, map[string]any{
		"user_id":   "u3",
		"record_id": "r3",
		"content":   "x",
		"attempt":   1,
	})
	// The error path swallows publish failures after logging so the
	// worker can take the next job.
	if err := task.Handle(context.Background(), payload); err != nil {
		t.Fatalf("handle should not error on publish failure, got %v", err)
	}
}

func TestHandle_RejectsInvalidPayload(t *testing.T) {
	t.Parallel()
	chat := &fakeChat{}
	pub := &fakePublisher{}
	task := newTask(t, chat, pub)

	cases := []struct {
		name    string
		body    map[string]any
		wantSub string
	}{
		{"missing user_id", map[string]any{"record_id": "r", "content": "c"}, "user_id"},
		{"missing record_id", map[string]any{"user_id": "u", "content": "c"}, "record_id"},
		{"missing content", map[string]any{"user_id": "u", "record_id": "r"}, "content"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := task.Handle(context.Background(), envelopePayload(t, c.body))
			if err == nil || !strings.Contains(err.Error(), c.wantSub) {
				t.Fatalf("want validation error containing %q, got %v", c.wantSub, err)
			}
			if chat.calls != 0 {
				t.Fatalf("chat should not be called on invalid payload")
			}
		})
	}
}

func TestType(t *testing.T) {
	t.Parallel()
	task := newTask(t, &fakeChat{}, &fakePublisher{})
	if task.Type() != aipreview.TaskType {
		t.Fatalf("type = %q", task.Type())
	}
	if aipreview.TaskType != "ai_preview" {
		t.Fatalf("TaskType drift: %q", aipreview.TaskType)
	}
}
