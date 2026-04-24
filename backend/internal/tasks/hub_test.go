package tasks

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"

	"github.com/redis/go-redis/v9"
)

func TestParseChannel(t *testing.T) {
	cases := []struct {
		in       string
		wantType string
		wantUser string
		wantOk   bool
	}{
		{"tasks:result:ai_preview:u123", "ai_preview", "u123", true},
		{"tasks:result:foo:bar-baz-qux", "foo", "bar-baz-qux", true},
		{"tasks:result:", "", "", false},
		{"tasks:result:foo:", "", "", false},
		{"tasks:result::u1", "", "", false},
		{"other:result:x:u1", "", "", false},
		{"", "", "", false},
	}
	for _, c := range cases {
		gotType, gotUser, gotOk := parseChannel(c.in)
		if gotType != c.wantType || gotUser != c.wantUser || gotOk != c.wantOk {
			t.Errorf("parseChannel(%q)=(%q,%q,%v) want (%q,%q,%v)",
				c.in, gotType, gotUser, gotOk,
				c.wantType, c.wantUser, c.wantOk)
		}
	}
}

func TestHubSubscribeAndUnsubscribe(t *testing.T) {
	h := &Hub{}
	// Subscribe without Start — Subscribe does not require the loop to be
	// running; it just registers the channel. The loop delivers messages.
	ch, unsub := h.Subscribe("ai_preview", "u1")

	// deliver manually — synthetic redis.Message (we use the private
	// helper directly so this test does not need a real Redis).
	// Subscribe should have registered the chan.
	h.mu.Lock()
	if _, ok := h.subscribers[subscriberKey{TaskType: "ai_preview", UserID: "u1"}]; !ok {
		t.Fatal("subscriber not registered")
	}
	h.mu.Unlock()

	unsub()
	// After unsub the channel should be closed.
	if _, ok := <-ch; ok {
		t.Error("channel should be closed after unsubscribe")
	}

	// Unsub again is safe (idempotent).
	unsub()
}

// TestHubDeliver_ProcessorRunsBeforeFanout verifies the DB-first ordering
// property: the processor observes the payload and completes before any
// subscriber is notified. This is what lets a late SSE connect rely on
// the DB snapshot.
func TestHubDeliver_ProcessorRunsBeforeFanout(t *testing.T) {
	h := &Hub{}

	var processed atomic.Bool
	var seenBySubscriberBefore atomic.Bool
	h.RegisterProcessor("ai_preview", func(ctx context.Context, userID, payload string) error {
		processed.Store(true)
		return nil
	})

	ch, unsub := h.Subscribe("ai_preview", "u1")
	defer unsub()

	// Poll from another goroutine; if a message arrives before the
	// processor flag is set, that's a race-ordering bug.
	done := make(chan struct{})
	go func() {
		<-ch
		if !processed.Load() {
			seenBySubscriberBefore.Store(true)
		}
		close(done)
	}()

	h.deliver(context.Background(), &redis.Message{
		Channel: "tasks:result:ai_preview:u1",
		Payload: `{"status":"ok","preview":"hi"}`,
	})
	<-done

	if !processed.Load() {
		t.Fatal("processor did not run")
	}
	if seenBySubscriberBefore.Load() {
		t.Error("subscriber observed message before processor completed")
	}
}

// TestHubDeliver_ProcessorErrorDropsFanout verifies that a failed
// persistence step prevents fanout — clients that reconnect will see the
// still-null snapshot and can retry cleanly.
func TestHubDeliver_ProcessorErrorDropsFanout(t *testing.T) {
	h := &Hub{}
	h.RegisterProcessor("ai_preview", func(ctx context.Context, userID, payload string) error {
		return errors.New("save failed")
	})

	ch, unsub := h.Subscribe("ai_preview", "u1")
	defer unsub()

	h.deliver(context.Background(), &redis.Message{
		Channel: "tasks:result:ai_preview:u1",
		Payload: `{"status":"ok","preview":"x"}`,
	})

	select {
	case msg, ok := <-ch:
		if ok {
			t.Errorf("expected no fanout, got %+v", msg)
		}
	default:
		// good — nothing delivered
	}
}

// TestHubDeliver_NoProcessorPassesThrough verifies that task types
// without a registered processor still fan out normally.
func TestHubDeliver_NoProcessorPassesThrough(t *testing.T) {
	h := &Hub{}

	ch, unsub := h.Subscribe("other", "u1")
	defer unsub()

	h.deliver(context.Background(), &redis.Message{
		Channel: "tasks:result:other:u1",
		Payload: `{"status":"ok"}`,
	})

	select {
	case msg := <-ch:
		if msg.TaskType != "other" || msg.UserID != "u1" {
			t.Errorf("unexpected: %+v", msg)
		}
	default:
		t.Error("expected fanout, got nothing")
	}
}
