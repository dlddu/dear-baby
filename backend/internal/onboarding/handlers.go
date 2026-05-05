package onboarding

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/storage"
	"github.com/dlddu/dear-baby/backend/internal/tasks"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

// PhotoStorage is the slice of storage.Client that the case-onboarding
// handlers depend on. Defining it here lets tests substitute a fake
// without pulling in the AWS SDK.
type PhotoStorage interface {
	BuildChildPhotoTmpKey(userID, uuid string, format storage.ImageFormat) string
	BuildChildPhotoKey(userID, childID string, format storage.ImageFormat) string
	PresignImagePut(ctx context.Context, key string, format storage.ImageFormat) (storage.PresignedPut, error)
	IsValidChildPhotoTmpKey(userID, key string) bool
	HeadObject(ctx context.Context, key string) (bool, error)
	CopyObject(ctx context.Context, srcKey, dstKey string) error
	DeleteObject(ctx context.Context, key string) error
}

// Handlers exposes the onboarding endpoints — case-branching submission,
// photo upload-url issuance, and the AI-preview request + SSE stream.
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
	// IDGen optionally overrides UUID generation for the children rows.
	// Defaults to uuid.NewString — tests substitute a deterministic gen.
	IDGen func() string
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

// childPhotoUploadURLResponse mirrors storage.PresignedPut plus the
// canonical photo_tmp_key the client will hand back inside the
// SubmitCase payload. Echoing the key lets the client send back exactly
// what the server expects without doing any string assembly itself.
type childPhotoUploadURLResponse struct {
	storage.PresignedPut
	PhotoTmpKey string `json:"photo_tmp_key"`
}

// childPhotoUploadURLBody is the optional request body. Only the format
// field is read today; missing or empty defaults to JPEG.
type childPhotoUploadURLBody struct {
	Format string `json:"format"`
}

// CreateChildPhotoUploadURL issues a short-lived presigned PUT URL into
// the calling user's onboarding-tmp prefix. The client uploads the
// photo with this URL, then echoes the returned `photo_tmp_key` inside
// the SubmitCase payload — the server rotates the key onto its
// permanent layout once the child row is committed.
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

	var body childPhotoUploadURLBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	format, formatOK := storage.ParseImageFormat(body.Format)
	if !formatOK {
		httpx.WriteError(w, http.StatusBadRequest, "unsupported format")
		return
	}

	id := uuid.NewString()
	key := h.Photos.BuildChildPhotoTmpKey(uid, id, format)
	put, err := h.Photos.PresignImagePut(r.Context(), key, format)
	if err != nil {
		slog.Error("presign photo failed", "err", err, "user_id", uid)
		httpx.WriteError(w, http.StatusInternalServerError, "presign failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, childPhotoUploadURLResponse{
		PresignedPut: put,
		PhotoTmpKey:  key,
	})
}

// submitCaseResponse is the shape of POST /onboarding/case — the
// updated flat user profile (so the client can flip status from
// 'onboarding' to 'authenticated' in one round-trip) plus the persisted
// child rows, which the home screen consumes for the multi-child
// switcher.
type submitCaseResponse struct {
	User     *users.Profile  `json:"user"`
	Children []childResponse `json:"children"`
}

// childResponse is the on-the-wire shape of a `children` row. Mirrors
// ChildRow but flattens times to ISO strings for the JSON layer.
type childResponse struct {
	ID             string          `json:"id"`
	Kind           ChildKind       `json:"kind"`
	DisplayName    *string         `json:"display_name"`
	Gender         Gender          `json:"gender"`
	Introduction   *string         `json:"introduction"`
	PhotoS3Key     *string         `json:"photo_s3_key"`
	BirthDate      *string         `json:"birth_date"`
	PregnancyWeeks *int            `json:"pregnancy_weeks"`
	DueDate        *string         `json:"due_date"`
	Purposes       []RecordPurpose `json:"purposes"`
	SortOrder      int             `json:"sort_order"`
}

// SubmitCase handles POST /onboarding/case — the final write of the
// case-branching funnel. Validates the payload, runs SaveCaseOnboarding
// (which performs the children INSERT + photo rename + onboarded_at
// stamp in a single transaction), and returns the updated profile +
// children for the client to flip to the home screen.
func (h *Handlers) SubmitCase(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req SubmitCaseRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if err := req.Validate(); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Fast-fail on photo tmp keys that don't match the calling user's
	// namespace — the renamer will reject them too, but rejecting
	// before the transaction begins is cheaper and easier to reason
	// about.
	if h.Photos == nil {
		// Without storage we still let payloads without photos through.
		for i, c := range req.Children {
			if c.PhotoTmpKey != nil && *c.PhotoTmpKey != "" {
				httpx.WriteError(w, http.StatusServiceUnavailable, fmt.Sprintf("child[%d]: photo storage not configured", i))
				return
			}
		}
	} else {
		for i, c := range req.Children {
			if c.PhotoTmpKey == nil || *c.PhotoTmpKey == "" {
				continue
			}
			if !h.Photos.IsValidChildPhotoTmpKey(uid, *c.PhotoTmpKey) {
				httpx.WriteError(w, http.StatusBadRequest, fmt.Sprintf("child[%d]: invalid photo_tmp_key", i))
				return
			}
		}
	}

	idGen := h.IDGen
	if idGen == nil {
		idGen = uuid.NewString
	}

	rename := func(ctx context.Context, userID, childID, tmpKey string) (string, error) {
		if h.Photos == nil {
			return "", fmt.Errorf("photo storage not configured")
		}
		if !h.Photos.IsValidChildPhotoTmpKey(userID, tmpKey) {
			return "", fmt.Errorf("invalid tmp key")
		}
		exists, err := h.Photos.HeadObject(ctx, tmpKey)
		if err != nil {
			return "", fmt.Errorf("head tmp key: %w", err)
		}
		if !exists {
			return "", fmt.Errorf("tmp object missing")
		}
		format, ok := storage.ImageFormatFromKey(tmpKey)
		if !ok {
			return "", fmt.Errorf("unsupported tmp key format")
		}
		permKey := h.Photos.BuildChildPhotoKey(userID, childID, format)
		if err := h.Photos.CopyObject(ctx, tmpKey, permKey); err != nil {
			return "", fmt.Errorf("copy: %w", err)
		}
		// Best-effort delete; the source becoming an orphan is far
		// better than failing the onboarding submission. Log but don't
		// abort the transaction.
		if err := h.Photos.DeleteObject(ctx, tmpKey); err != nil {
			slog.Warn("delete tmp photo failed", "err", err, "key", tmpKey)
		}
		return permKey, nil
	}

	out, err := h.Store.SaveCaseOnboarding(r.Context(), uid, req, idGen, rename)
	if err != nil {
		if errors.Is(err, ErrInvalidCasePayload) {
			httpx.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		slog.Error("save case onboarding failed", "err", err, "user_id", uid)
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}

	profile, err := h.Users.GetProfile(r.Context(), uid)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		slog.Error("get profile failed", "err", err, "user_id", uid)
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}

	children := make([]childResponse, 0, len(out.Children))
	for _, c := range out.Children {
		children = append(children, childResponse{
			ID:             c.ID,
			Kind:           c.Kind,
			DisplayName:    c.DisplayName,
			Gender:         c.Gender,
			Introduction:   c.Introduction,
			PhotoS3Key:     c.PhotoS3Key,
			BirthDate:      c.BirthDate,
			PregnancyWeeks: c.PregnancyWeeks,
			DueDate:        c.DueDate,
			Purposes:       c.Purposes,
			SortOrder:      c.SortOrder,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, submitCaseResponse{
		User:     profile,
		Children: children,
	})
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

