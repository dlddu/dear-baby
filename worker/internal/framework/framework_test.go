package framework_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"testing"

	"github.com/dlddu/dear-baby/worker/internal/framework"
)

// stubTask records the payload it was handed and returns the configured
// error (or nil). All tests in this file route through it.
type stubTask struct {
	taskType string
	called   int
	lastRaw  []byte
	err      error
}

func (s *stubTask) Type() string { return s.taskType }

func (s *stubTask) Handle(_ context.Context, raw []byte) error {
	s.called++
	s.lastRaw = append([]byte(nil), raw...)
	return s.err
}

func silentLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestRegistry_Dispatch_RoutesByType(t *testing.T) {
	t.Parallel()
	r := framework.NewRegistry()
	a := &stubTask{taskType: "alpha"}
	b := &stubTask{taskType: "beta"}
	r.MustRegister(a)
	r.MustRegister(b)

	envelope := `{"type":"beta","payload":{"x":1},"job_id":"j1","issued_at":"now","v":1}`
	if err := r.Dispatch(context.Background(), []byte(envelope)); err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	if a.called != 0 {
		t.Fatalf("alpha should not be called, got %d", a.called)
	}
	if b.called != 1 {
		t.Fatalf("beta called %d times, want 1", b.called)
	}
	// The framework forwards the raw payload bytes verbatim so each task
	// owns its own validator.
	if got := string(b.lastRaw); !strings.Contains(got, `"x":1`) {
		t.Fatalf("payload not forwarded: %q", got)
	}
}

func TestRegistry_Dispatch_RejectsUnknownType(t *testing.T) {
	t.Parallel()
	r := framework.NewRegistry()
	envelope := `{"type":"mystery","payload":{},"job_id":"j","issued_at":"now","v":1}`
	err := r.Dispatch(context.Background(), []byte(envelope))
	if err == nil || !strings.Contains(err.Error(), "unknown task type") {
		t.Fatalf("expected unknown-task error, got %v", err)
	}
}

func TestRegistry_Dispatch_RejectsBadEnvelope(t *testing.T) {
	t.Parallel()
	r := framework.NewRegistry()
	a := &stubTask{taskType: "alpha"}
	r.MustRegister(a)

	cases := []struct {
		name    string
		raw     string
		wantSub string
	}{
		{"missing type", `{"payload":{},"job_id":"j","issued_at":"now","v":1}`, "type is empty"},
		{"missing job_id", `{"type":"alpha","payload":{},"issued_at":"now","v":1}`, "job_id"},
		{"missing issued_at", `{"type":"alpha","payload":{},"job_id":"j","v":1}`, "issued_at"},
		{"unsupported version", `{"type":"alpha","payload":{},"job_id":"j","issued_at":"now","v":7}`, "unsupported"},
		{"not json", `not-json`, "unmarshal"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			err := r.Dispatch(context.Background(), []byte(c.raw))
			if err == nil || !strings.Contains(err.Error(), c.wantSub) {
				t.Fatalf("want error containing %q, got %v", c.wantSub, err)
			}
			if a.called != 0 {
				t.Fatalf("task should not be called on bad envelope")
			}
		})
	}
}

func TestRegistry_Register_RejectsDuplicate(t *testing.T) {
	t.Parallel()
	r := framework.NewRegistry()
	if err := r.Register(&stubTask{taskType: "alpha"}); err != nil {
		t.Fatalf("first register: %v", err)
	}
	err := r.Register(&stubTask{taskType: "alpha"})
	if err == nil || !strings.Contains(err.Error(), "duplicate") {
		t.Fatalf("expected duplicate error, got %v", err)
	}
}

func TestRegistry_Register_RejectsNil(t *testing.T) {
	t.Parallel()
	r := framework.NewRegistry()
	if err := r.Register(nil); err == nil {
		t.Fatalf("expected error for nil task")
	}
}

func TestRegistry_Dispatch_PropagatesTaskError(t *testing.T) {
	t.Parallel()
	r := framework.NewRegistry()
	want := errors.New("boom")
	r.MustRegister(&stubTask{taskType: "alpha", err: want})
	envelope := `{"type":"alpha","payload":{},"job_id":"j","issued_at":"now","v":1}`
	if err := r.Dispatch(context.Background(), []byte(envelope)); !errors.Is(err, want) {
		t.Fatalf("expected boom error, got %v", err)
	}
}
