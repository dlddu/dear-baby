package onboarding

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/storage"
	"github.com/dlddu/dear-baby/backend/internal/tasks"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

// PhotoStorage is the subset of the storage.Client surface needed by
// the case-onboarding handlers. Defining it as an interface keeps the
// AWS SDK out of test scopes that only care about handler logic.
type PhotoStorage interface {
	BuildChildPhotoTmpKey(userID, uuid string, format storage.ImageFormat) string
	BuildChildPhotoKey(userID, childID string, format storage.ImageFormat) string
	IsValidChildPhotoTmpKey(userID, key string) bool
	PresignImagePut(ctx context.Context, key string, format storage.ImageFormat) (storage.PresignedPut, error)
	HeadObject(ctx context.Context, key string) (bool, error)
	CopyObject(ctx context.Context, srcKey, dstKey string) error
	DeleteObject(ctx context.Context, key string) error
}

// Handlers exposes the onboarding endpoints — case-branching submission,
// the per-child photo upload helper, and the AI-preview request + SSE
// stream. Keeping them on a single struct lets the router wire
// everything through one constructor.
type Handlers struct {
	Store           *Store
	Users           *users.Store
	Photos          PhotoStorage
	Tasks           *tasks.Client
	Hub             *tasks.Hub
	UserIDFromCtxFn func(r *http.Request) (string, bool)
	// SSEHeartbeat controls the keepalive cadence for GET
	// /onboarding/ai-preview/events. Zero disables heartbeats — keep it
	// configurable so tests can drive faster cadences.
	SSEHeartbeat time.Duration
}

// photoUploadURLBody is the request body for POST
// /onboarding/children/photo/upload-url. Format is required — unlike
// audio, there is no historical default.
type photoUploadURLBody struct {
	Format string `json:"format"`
}

// photoUploadURLResponse mirrors storage.PresignedPut plus the
// canonical photo_tmp_key the client will hand back via POST
// /onboarding/case. Echoing the key lets the client send back exactly
// what the server expects without doing any string assembly itself.
type photoUploadURLResponse struct {
	storage.PresignedPut
	PhotoTmpKey string `json:"photo_tmp_key"`
}

// CreateChildPhotoUploadURL handles POST /onboarding/children/photo/upload-url.
// Returns a short-lived presigned PUT URL bound to a fresh
// onboarding-tmp/{uuid} key for the calling user. The client uploads
// directly to S3 and then includes the same key in its
// children[].photo_tmp_key field on the case submission.
//
// The UUID is generated server-side so the client never controls the
// key — keeps the IsValidChildPhotoTmpKey check meaningful.
func (h *Handlers) CreateChildPhotoUploadURL(w http.ResponseWriter, r *http.Request) {
	if h.Photos == nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "photo storage not configured")
		return
	}
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var body photoUploadURLBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	format, ok := storage.ParseImageFormat(body.Format)
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "unsupported format")
		return
	}

	key := h.Photos.BuildChildPhotoTmpKey(uid, uuid.NewString(), format)
	put, err := h.Photos.PresignImagePut(r.Context(), key, format)
	if err != nil {
		slog.Error("presign image put failed", "err", err, "user_id", uid)
		httpx.WriteError(w, http.StatusInternalServerError, "presign failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, photoUploadURLResponse{
		PresignedPut: put,
		PhotoTmpKey:  key,
	})
}

// caseSubmissionResponse echoes the user's profile + the persisted
// children rows so the client can hydrate AuthContext without a
// follow-up /me call.
type caseSubmissionResponse struct {
	User     *users.Profile `json:"user"`
	Children []ChildRow     `json:"children"`
}

// SubmitCase handles POST /onboarding/case. Validates + persists the
// case-branching submission inside a single transaction, with the photo
// rename(copy + delete) running as a callback during the same tx so a
// failed S3 step rolls back the DB inserts.
func (h *Handlers) SubmitCase(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var sub CaseSubmission
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&sub); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}

	// Pre-validate photo tmp keys before opening the transaction. A
	// forged tmp key (different user namespace, missing prefix, unknown
	// extension) is a hard 400 — we don't want partial inserts.
	for i, c := range sub.Children {
		if c.PhotoTmpKey == nil || *c.PhotoTmpKey == "" {
			continue
		}
		if h.Photos == nil {
			httpx.WriteError(w, http.StatusServiceUnavailable, "photo storage not configured")
			return
		}
		if !h.Photos.IsValidChildPhotoTmpKey(uid, *c.PhotoTmpKey) {
			httpx.WriteError(w, http.StatusBadRequest, fmt.Sprintf("invalid photo_tmp_key at %d", i))
			return
		}
	}

	rename := h.buildRenamePhotoFn(r.Context(), uid)

	rows, err := h.Store.SaveCaseOnboarding(r.Context(), uid, sub, rename)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidPayload):
			httpx.WriteError(w, http.StatusBadRequest, "invalid payload")
			return
		case errors.Is(err, ErrNotFound):
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		case errors.Is(err, errPhotoMissing):
			httpx.WriteError(w, http.StatusBadRequest, "photo not uploaded")
			return
		}
		slog.Error("save case onboarding failed", "err", err, "user_id", uid)
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}

	// Best-effort cleanup of the original tmp objects after a successful
	// commit. A failure here leaves a stale tmp object that
	// reset-onboarding (or a future S3 lifecycle rule) will clean up.
	if h.Photos != nil {
		for i, c := range sub.Children {
			if c.PhotoTmpKey == nil || *c.PhotoTmpKey == "" {
				continue
			}
			if i >= len(rows) || rows[i].PhotoS3Key == nil {
				continue
			}
			if err := h.Photos.DeleteObject(r.Context(), *c.PhotoTmpKey); err != nil {
				slog.Warn("photo tmp delete failed; will be reaped",
					"err", err, "user_id", uid, "tmp_key", *c.PhotoTmpKey)
			}
		}
	}

	var profile *users.Profile
	if h.Users != nil {
		p, err := h.Users.GetProfile(r.Context(), uid)
		if err != nil {
			slog.Error("load profile after submission failed", "err", err, "user_id", uid)
			// The submission succeeded; we still want to return a useful
			// response. Fall through with profile=nil.
		} else {
			profile = p
		}
	}
	httpx.WriteJSON(w, http.StatusOK, caseSubmissionResponse{
		User:     profile,
		Children: rows,
	})
}

// errPhotoMissing surfaces from the rename callback when S3 has no
// object at the supplied tmp key. Mapped to 400 by the handler — the
// client either skipped the upload or its presigned URL expired.
var errPhotoMissing = errors.New("photo not uploaded")

// buildRenamePhotoFn returns a closure compatible with the store's
// renamePhotoFn. The closure validates the tmp key is reachable in S3
// (HeadObject), copies it to its permanent location, and returns the
// new permanent key. Cleanup of the tmp key happens *after* the
// transaction commits — it is best-effort and not part of the rollback
// boundary.
func (h *Handlers) buildRenamePhotoFn(ctx context.Context, userID string) renamePhotoFn {
	if h.Photos == nil {
		return nil
	}
	return func(ctx context.Context, childID string, in ChildInput) (string, error) {
		if in.PhotoTmpKey == nil || *in.PhotoTmpKey == "" {
			return "", nil
		}
		tmpKey := *in.PhotoTmpKey
		exists, err := h.Photos.HeadObject(ctx, tmpKey)
		if err != nil {
			return "", fmt.Errorf("head photo: %w", err)
		}
		if !exists {
			return "", errPhotoMissing
		}
		format := storage.ImageFormatFromExtension(tmpKey)
		dstKey := h.Photos.BuildChildPhotoKey(userID, childID, format)
		if err := h.Photos.CopyObject(ctx, tmpKey, dstKey); err != nil {
			return "", fmt.Errorf("copy photo: %w", err)
		}
		return dstKey, nil
	}
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

