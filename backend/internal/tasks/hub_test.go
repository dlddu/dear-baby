package tasks

import (
	"testing"
)

func TestHub_SubscribeFanout(t *testing.T) {
	h := &Hub{subs: make(map[string]map[chan Result]struct{})}
	ch1, cancel1 := h.Subscribe("ai_preview", "u1")
	ch2, cancel2 := h.Subscribe("ai_preview", "u1")
	defer cancel1()
	defer cancel2()

	h.dispatch("tasks:result:ai_preview:u1", []byte(`{"status":"ok"}`))

	for i, c := range []<-chan Result{ch1, ch2} {
		select {
		case r := <-c:
			if r.UserID != "u1" || r.TaskType != "ai_preview" {
				t.Errorf("sub %d: got %+v", i, r)
			}
			if string(r.Body) != `{"status":"ok"}` {
				t.Errorf("sub %d body: %s", i, string(r.Body))
			}
		default:
			t.Errorf("sub %d: no message", i)
		}
	}
}

func TestHub_CancelRemovesSubscriber(t *testing.T) {
	h := &Hub{subs: make(map[string]map[chan Result]struct{})}
	_, cancel := h.Subscribe("ai_preview", "u1")
	cancel()

	h.dispatch("tasks:result:ai_preview:u1", []byte(`{}`))

	h.mu.RLock()
	defer h.mu.RUnlock()
	if _, exists := h.subs[key("ai_preview", "u1")]; exists {
		t.Error("subscriber map should be empty after cancel")
	}
}

func TestHub_UnrelatedChannelIgnored(t *testing.T) {
	h := &Hub{subs: make(map[string]map[chan Result]struct{})}
	ch, cancel := h.Subscribe("ai_preview", "u1")
	defer cancel()

	h.dispatch("tasks:result:ai_preview:u2", []byte(`{}`))

	select {
	case r := <-ch:
		t.Errorf("unexpected message: %+v", r)
	default:
	}
}
