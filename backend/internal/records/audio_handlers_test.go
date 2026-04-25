package records

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

// TestCreate_VoiceSource exercises the new `source` field on POST
// /records — voice records insert with audio_s3_key NULL and Source set.
func TestCreate_VoiceSource(t *testing.T) {
	h, db := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"오늘 너의 작은 움직임","source":"voice"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	var got createResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Record == nil || got.Record.Source != SourceVoice {
		t.Errorf("source: got %+v", got.Record)
	}
	if got.Record.AudioS3Key != nil {
		t.Errorf("audio_s3_key should start NULL: got %v", got.Record.AudioS3Key)
	}
}

func TestCreate_InvalidSource(t *testing.T) {
	h, db := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"x","source":"video"}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d body=%s", rec.Code, rec.Body.String())
	}
}

// TestPresign_NoS3Configured verifies that the upload-url endpoint
// surfaces a 503 when AWS isn't wired (local dev) — instead of
// silently 404'ing, which would mask the misconfiguration.
func TestPresign_NoS3Configured(t *testing.T) {
	h, db := newHandlers(t, "u1")
	defer db.Close()

	// Seed a voice record to have something to look up.
	postRes := post(t, h, "u1", `{"content":"x","source":"voice"}`)
	if postRes.Code != http.StatusCreated {
		t.Fatalf("seed record: %d", postRes.Code)
	}
	var created createResponse
	_ = json.Unmarshal(postRes.Body.Bytes(), &created)

	r := chi.NewRouter()
	r.Post("/records/{id}/audio/upload-url", h.PresignAudioUpload)
	req := httptest.NewRequest(http.MethodPost,
		"/records/"+created.Record.ID+"/audio/upload-url", nil)
	req = withUser(req, "u1")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status: got %d want 503", rec.Code)
	}
}

func TestAttachAudio_NoS3Configured(t *testing.T) {
	h, db := newHandlers(t, "u1")
	defer db.Close()

	// Seed a record.
	postRes := post(t, h, "u1", `{"content":"x","source":"voice"}`)
	var created createResponse
	_ = json.Unmarshal(postRes.Body.Bytes(), &created)

	r := chi.NewRouter()
	r.Patch("/records/{id}", h.AttachAudio)
	req := httptest.NewRequest(http.MethodPatch,
		"/records/"+created.Record.ID,
		bytes.NewBufferString(`{"audio_s3_key":"users/u1/records/x.m4a"}`))
	req = withUser(req, "u1")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status: got %d want 503", rec.Code)
	}
}

// TestAllowPresign_RateLimit checks the in-memory rate limiter admits up
// to the cap and rejects after.
func TestAllowPresign_RateLimit(t *testing.T) {
	h := &Handlers{}
	for i := 0; i < presignRateMax; i++ {
		if !h.allowPresign("u1") {
			t.Fatalf("admit %d should have passed", i)
		}
	}
	if h.allowPresign("u1") {
		t.Error("admit beyond cap should have been rejected")
	}
	// Different user is unaffected.
	if !h.allowPresign("u2") {
		t.Error("u2 should not share u1's window")
	}
}

// TestStore_GetByID_CrossTenant verifies that a record id from one
// user is not visible to another — the lookup is owner-scoped, so a
// hostile client guessing UUIDs gets ErrNotFound rather than the row.
func TestStore_GetByID_CrossTenant(t *testing.T) {
	h, db := newHandlers(t, "u1")
	defer db.Close()
	seedUser(t, db, "u2", "u2@b.com")

	postRes := post(t, h, "u1", `{"content":"x","source":"voice"}`)
	var created createResponse
	_ = json.Unmarshal(postRes.Body.Bytes(), &created)

	if _, err := h.Store.GetByID(req(t).Context(), "u2", created.Record.ID); err != ErrNotFound {
		t.Errorf("got %v, want ErrNotFound", err)
	}
}

// req builds a throwaway request whose context the store can use; the
// store does not read anything off the request beyond Context().
func req(t *testing.T) *http.Request {
	t.Helper()
	return httptest.NewRequest(http.MethodGet, "/", nil)
}
