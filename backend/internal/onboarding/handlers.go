package onboarding

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/tasks"
)

// Handlers wires the onboarding endpoints that the Stage 2 home screen
// drives: POST /onboarding/ai-preview (enqueue an edit) and
// GET /onboarding/ai-preview/events (SSE stream of results).
type Handlers struct {
	Store           *Store
	Tasks           *tasks.Client
	Hub             *tasks.Hub
	UserIDFromCtxFn func(r *http.Request) (string, bool)
}

type aiPreviewEnqueuePayload struct {
	UserID   string `json:"user_id"`
	RecordID string `json:"record_id"`
	Content  string `json:"content"`
}

// CreateAIPreview handles POST /onboarding/ai-preview. Accepts no body.
// Guards:
//   - onboarding.first_record_at must be non-null
//   - at least one record must exist (fallback guard; should be equivalent)
//
// Doesn't care whether ai_preview is already set — retries re-enqueue the
// same job so the worker can overwrite. Always 202 on enqueue success.
func (h *Handlers) CreateAIPreview(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	o, err := h.Store.Get(r.Context(), uid)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	if o.FirstRecordAt == nil {
		httpx.WriteError(w, http.StatusBadRequest, "no first record yet")
		return
	}
	rec, err := h.Store.GetOldestRecord(r.Context(), uid)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusBadRequest, "no record")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	if err := h.Tasks.Enqueue(r.Context(), "ai_preview", aiPreviewEnqueuePayload{
		UserID:   uid,
		RecordID: rec.ID,
		Content:  rec.Content,
	}); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "enqueue failed")
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

// AIPreviewEvents handles GET /onboarding/ai-preview/events — a Server-Sent
// Events stream carrying the worker's ready/error messages for the current
// user. On connect the handler emits a snapshot if ai_preview is already
// set (so a client reconnecting after tab-switch doesn't miss the result),
// then forwards pub/sub events until the client disconnects.
func (h *Handlers) AIPreviewEvents(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		httpx.WriteError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	// Snapshot: emit the current ai_preview immediately if available. Saves
	// the app from a missed-event race when the result landed while the
	// client had the screen backgrounded.
	if o, err := h.Store.Get(r.Context(), uid); err == nil && o.AIPreview != nil {
		body, _ := json.Marshal(map[string]any{
			"status":  "ok",
			"preview": *o.AIPreview,
		})
		if _, err := fmt.Fprintf(w, "data: %s\n\n", body); err == nil {
			flusher.Flush()
		}
	}

	sub, cancel := h.Hub.Subscribe("ai_preview", uid)
	defer cancel()

	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-heartbeat.C:
			// Comments ": ...\n\n" are valid SSE heartbeats. Prevents
			// idle-connection timeouts on proxies.
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()
		case msg, ok := <-sub:
			if !ok {
				return
			}
			if _, err := fmt.Fprintf(w, "data: %s\n\n", msg.Body); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

