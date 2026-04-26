package records

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/storage"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

// maxContentRunes caps the length of a record. 2000 UTF-8 code points
// comfortably fits the Stage 2 text-entry screen (multiline, ~a few
// paragraphs) and STT transcripts of a 60-second voice memo while
// keeping the payload small on low-end networks.
const maxContentRunes = 2000

// AudioStorage is the subset of the storage.Client surface the handlers
// need. Defining it as an interface here lets tests substitute a fake
// without pulling in the AWS SDK at all.
type AudioStorage interface {
	BuildRecordAudioKey(userID, recordID string) string
	IsValidRecordAudioKey(userID, recordID, key string) bool
	PresignPut(ctx context.Context, key string) (storage.PresignedPut, error)
	HeadObject(ctx context.Context, key string) (bool, error)
}

// Handlers exposes the records HTTP surface:
//   - POST   /records                          (text + voice, audio attached later)
//   - POST   /records/{id}/audio/upload-url    (presigned S3 PUT URL)
//   - PATCH  /records/{id}                     (attach audio_s3_key after upload)
//
// AudioStorage may be nil — when it is, the audio-related routes are
// not mounted (see app/router.go). This keeps the binary running in
// environments without S3 credentials (CI smoke, /health-only deploys).
type Handlers struct {
	Store           *Store
	Users           *users.Store
	Audio           AudioStorage
	UserIDFromCtxFn func(r *http.Request) (string, bool)
}

type createBody struct {
	Content string `json:"content"`
	// Source is optional; missing or empty defaults to "text" so the
	// existing AC-001-04 path keeps working without the client opting
	// in. Voice records must explicitly send "voice".
	Source string `json:"source"`
}

// createResponse returns the new record alongside the updated flat profile
// so the client can refresh AuthContext in one round-trip.
type createResponse struct {
	Record *Record        `json:"record"`
	User   *users.Profile `json:"user"`
}

// Create handles POST /records. Accepts `{content, source?}`, validates,
// persists, and re-derives first_record_at from the oldest existing
// record. For source="voice" the audio is attached separately via PATCH
// after the device uploads to S3.
func (h *Handlers) Create(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var body createBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}

	content := strings.TrimSpace(body.Content)
	if content == "" {
		httpx.WriteError(w, http.StatusBadRequest, "content is required")
		return
	}
	if utf8.RuneCountInString(content) > maxContentRunes {
		httpx.WriteError(w, http.StatusBadRequest, "content too long")
		return
	}

	source := SourceText
	if body.Source != "" {
		s := Source(body.Source)
		if !s.Valid() {
			httpx.WriteError(w, http.StatusBadRequest, "invalid source")
			return
		}
		source = s
	}

	res, err := h.Store.Create(r.Context(), h.Users, uid, content, source)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, createResponse{Record: res.Record, User: res.Profile})
}

// audioUploadURLResponse mirrors storage.PresignedPut plus the canonical
// audio_s3_key the client will hand back via PATCH. Echoing the key lets
// the client send back exactly what the server expects without doing
// any string assembly itself.
type audioUploadURLResponse struct {
	storage.PresignedPut
	AudioS3Key string `json:"audio_s3_key"`
}

// CreateAudioUploadURL handles POST /records/{id}/audio/upload-url.
// Returns a short-lived presigned PUT URL bound to the canonical key
// for this user/record. The client uploads with the returned URL +
// Content-Type, then PATCHes the record with the same key.
//
// Idempotent: presigning a URL does not mutate state, so the client can
// re-request after a 5-min URL expiry without coordination.
func (h *Handlers) CreateAudioUploadURL(w http.ResponseWriter, r *http.Request) {
	if h.Audio == nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "audio storage not configured")
		return
	}
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	recordID := strings.TrimSpace(chi.URLParam(r, "id"))
	if recordID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "missing record id")
		return
	}

	rec, err := h.Store.GetByIDForUser(r.Context(), uid, recordID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "record not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	if rec.AudioS3Key != nil {
		// Already attached — no point letting the client upload again.
		httpx.WriteError(w, http.StatusConflict, "audio already attached")
		return
	}

	key := h.Audio.BuildRecordAudioKey(uid, recordID)
	put, err := h.Audio.PresignPut(r.Context(), key)
	if err != nil {
		slog.Error("presign put failed", "err", err, "user_id", uid, "record_id", recordID)
		httpx.WriteError(w, http.StatusInternalServerError, "presign failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, audioUploadURLResponse{
		PresignedPut: put,
		AudioS3Key:   key,
	})
}

type patchBody struct {
	// AudioS3Key is the only field PATCH accepts today. We don't allow
	// clearing it (audio_s3_key flips null→non-null exactly once); to
	// "remove" audio the user keeps the row but deletes the local
	// copy, leaving the record text-only.
	AudioS3Key *string `json:"audio_s3_key"`
}

// Patch handles PATCH /records/{id}. The only currently-supported field
// is audio_s3_key, which can flip from null → a key matching this
// user/record (validated against the canonical builder so the client
// can't redirect to a different user's namespace). Verifies S3 actually
// holds the object before persisting, so we don't end up pointing at
// nothing.
func (h *Handlers) Patch(w http.ResponseWriter, r *http.Request) {
	if h.Audio == nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "audio storage not configured")
		return
	}
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	recordID := strings.TrimSpace(chi.URLParam(r, "id"))
	if recordID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "missing record id")
		return
	}

	var body patchBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.AudioS3Key == nil || *body.AudioS3Key == "" {
		httpx.WriteError(w, http.StatusBadRequest, "audio_s3_key is required")
		return
	}
	key := *body.AudioS3Key

	if !h.Audio.IsValidRecordAudioKey(uid, recordID, key) {
		// The client tried to PATCH a key that doesn't match this
		// user's canonical namespace. Treat as 400 — this is a bug,
		// not a legitimate state.
		httpx.WriteError(w, http.StatusBadRequest, "audio_s3_key does not match record")
		return
	}

	exists, err := h.Audio.HeadObject(r.Context(), key)
	if err != nil {
		slog.Error("head object failed", "err", err, "user_id", uid, "record_id", recordID, "key", key)
		httpx.WriteError(w, http.StatusInternalServerError, "head object failed")
		return
	}
	if !exists {
		// Client claims the upload finished but S3 disagrees. The
		// presigned URL TTL or the device's network is to blame —
		// either way the record stays unattached and the device can
		// retry the whole 3-step flow.
		httpx.WriteError(w, http.StatusBadRequest, "audio object not found")
		return
	}

	rec, err := h.Store.AttachAudio(r.Context(), uid, recordID, key)
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			httpx.WriteError(w, http.StatusNotFound, "record not found")
		case errors.Is(err, ErrAudioAlreadyAttached):
			httpx.WriteError(w, http.StatusConflict, "audio already attached")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "internal")
		}
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"record": rec})
}
