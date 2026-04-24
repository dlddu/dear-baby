package onboarding

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/tasks"
)

// Handlers exposes the onboarding endpoints — today just the AI-preview
// request and SSE stream. Keeping them on a single struct lets the
// router wire everything through one constructor.
type Handlers struct {
	Store           *Store
	Tasks           *tasks.Client
	Hub             *tasks.Hub
	UserIDFromCtxFn func(r *http.Request) (string, bool)
	// SSEHeartbeat controls the keepalive cadence for GET
	// /onboarding/ai-preview/events. Zero disables heartbeats — keep it
	// configurable so tests can drive faster cadences.
	SSEHeartbeat time.Duration
}

// aiPreviewEnqueuePayload mirrors worker schema exactly; drift here
// would surface as Zod parse failures in the worker. See
// worker/src/tasks/ai-preview/index.ts.
type aiPreviewEnqueuePayload struct {
	UserID   string `json:"user_id"`
	RecordID string `json:"record_id"`
	Content  string `json:"content"`
	// Attempt starts at 1 on the initial enqueue. The worker echoes it
	// back in the error result so AIPreviewProcessor can cap retries.
	Attempt int `json:"attempt"`
}

// RequestAIPreview enqueues a job for the user's first/oldest record.
// Covers both initial generation and retry — callers simply POST again.
// Idempotent in the sense that a duplicate enqueue overwrites the same
// ai_preview field with the same (re-generated) output.
func (h *Handlers) RequestAIPreview(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	o, err := h.Store.GetByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusBadRequest, "no first record yet")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	if o.FirstRecordAt == nil {
		httpx.WriteError(w, http.StatusBadRequest, "no first record yet")
		return
	}

	recordID, content, err := h.Store.GetOldestRecord(r.Context(), userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.WriteError(w, http.StatusBadRequest, "no record")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}

	if err := h.Tasks.Enqueue(r.Context(), "ai_preview", aiPreviewEnqueuePayload{
		UserID:   userID,
		RecordID: recordID,
		Content:  content,
		Attempt:  1,
	}); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "enqueue failed")
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

// AIPreviewEvents streams preview status to the client over SSE. On
// connect it emits an immediate snapshot (so reconnecting clients pick
// up a result that arrived mid-disconnect), then forwards every pubsub
// message to the wire as `event: <status>\ndata: <json>\n\n`.
func (h *Handlers) AIPreviewEvents(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		httpx.WriteError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}

	// SSE headers. Nginx/proxy friendly: disable buffering, tell the
	// browser this is a long-lived text/event-stream.
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	// Snapshot: if the preview is already done when the client connects,
	// send the ready event immediately. This is the tab-ieave /
	// reconnect case — without this snapshot, a client that missed the
	// pubsub would hang forever.
	if o, err := h.Store.GetByID(r.Context(), userID); err == nil && o.AIPreview != nil {
		writeSSE(w, "ready", map[string]string{"preview": *o.AIPreview})
		flusher.Flush()
	}

	ch, unsubscribe := h.Hub.Subscribe("ai_preview", userID)
	defer unsubscribe()

	// Heartbeat keeps load balancers from closing idle connections.
	heartbeat := h.SSEHeartbeat
	if heartbeat == 0 {
		heartbeat = 15 * time.Second
	}
	ticker := time.NewTicker(heartbeat)
	defer ticker.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := fmt.Fprintf(w, ": keepalive %d\n\n", time.Now().Unix()); err != nil {
				return
			}
			flusher.Flush()
		case msg, ok := <-ch:
			if !ok {
				return
			}
			writeSSEResult(w, msg.Payload)
			flusher.Flush()
		}
	}
}

// writeSSE emits an `event:` + `data:` pair.
func writeSSE(w http.ResponseWriter, event string, data any) {
	b, _ := json.Marshal(data)
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, b)
}

// writeSSEResult takes the raw worker payload (already JSON-serialized,
// either {"status":"ok","preview":...} or {"status":"error",...}) and
// writes it as an SSE event. The event name maps worker status to the
// UX-facing vocabulary the client listens on: ok → `ready`, error →
// `error`. A status the client doesn't know about falls through as the
// raw name so future additions (e.g. `warning`) don't need a backend
// deploy to surface.
func writeSSEResult(w http.ResponseWriter, payload string) {
	var shell struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal([]byte(payload), &shell); err != nil || shell.Status == "" {
		fmt.Fprintf(w, "event: error\ndata: {\"error\":\"malformed result\"}\n\n")
		return
	}
	event := shell.Status
	if shell.Status == "ok" {
		event = "ready"
	}
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, payload)
}

