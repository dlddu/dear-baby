package tasks

import "testing"

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
