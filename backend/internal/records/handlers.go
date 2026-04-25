package records

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/storage"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

// maxContentRunes caps the length of a record's text. 2000 UTF-8 code
// points comfortably fits the Stage 2 entry screens (multiline, ~a few
// paragraphs) while keeping the payload small on low-end networks.
const maxContentRunes = 2000

// presignTTL is the lifetime of a single audio upload URL. Short enough
// to bound the replay window; long enough to survive a slow mobile
// upload. The client orchestrator requests a fresh URL when retrying.
const presignTTL = 5 * time.Minute

// presignRateWindow + presignRateMax form a per-user sliding window:
// each user may request up to N URLs per W. The window protects against
// a buggy/malicious client minting unbounded presigned URLs and against
// accidental upload retry storms. In-memory is acceptable because the
// backend is a single pod today; switch to Redis when we scale out.
const (
	presignRateWindow = time.Minute
	presignRateMax    = 10
)

// Handlers exposes the records endpoints. AI-preview enqueuing remains
// the onboarding package's concern. Audio S3 access is delegated to the
// optional S3 client — when nil, the upload-url and PATCH endpoints
// return 503 (the routes stay mounted so the missing-config error is
// visible in client logs).
type Handlers struct {
	Store           *Store
	Users           *users.Store
	S3              *storage.Client
	UserIDFromCtxFn func(r *http.Request) (string, bool)

	rateMu sync.Mutex
	rate   map[string][]time.Time
}

type createBody struct {
	Content string `json:"content"`
	// Source defaults to "text" when omitted, preserving the original
	// POST /records contract from before voice records existed.
	Source string `json:"source,omitempty"`
}

// createResponse returns the new record alongside the updated flat profile
// so the client can refresh AuthContext in one round-trip.
type createResponse struct {
	Record *Record        `json:"record"`
	User   *users.Profile `json:"user"`
}

// Create handles POST /records. Accepts `{content, source?}`, trims it,
// validates length (1..2000 runes) and source ('text'|'voice'), and
// persists. For voice records, audio_s3_key starts NULL — the client
// attaches it later via PATCH if (and when) it uploads the audio.
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

	source := body.Source
	if source == "" {
		source = SourceText
	}
	if source != SourceText && source != SourceVoice {
		httpx.WriteError(w, http.StatusBadRequest, "invalid source")
		return
	}

	res, err := h.Store.Create(r.Context(), h.Users, uid, content, source)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		if errors.Is(err, ErrInvalidSource) {
			httpx.WriteError(w, http.StatusBadRequest, "invalid source")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, createResponse{Record: res.Record, User: res.Profile})
}

type presignResponse struct {
	UploadURL   string    `json:"upload_url"`
	AudioS3Key  string    `json:"audio_s3_key"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// PresignAudioUpload handles POST /records/{id}/audio/upload-url. It
// verifies record ownership, rate-limits per user, then issues a
// presigned PUT URL the client uses to upload the m4a directly to S3.
//
// The handler computes the S3 key itself (clients never assemble keys)
// and returns it so the subsequent PATCH can echo it back unchanged.
func (h *Handlers) PresignAudioUpload(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if h.S3 == nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "audio uploads not configured")
		return
	}

	recordID := chi.URLParam(r, "id")
	if recordID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "id is required")
		return
	}

	rec, err := h.Store.GetByID(r.Context(), uid, recordID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "record not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	// Refuse re-issuing URLs once an audio is attached — saves the
	// caller a round-trip and prevents the audio from being silently
	// overwritten by a stale device.
	if rec.AudioS3Key != nil {
		httpx.WriteError(w, http.StatusConflict, "audio already attached")
		return
	}

	if !h.allowPresign(uid) {
		httpx.WriteError(w, http.StatusTooManyRequests, "rate limited")
		return
	}

	key := h.S3.Config().BuildRecordAudioKey(uid, recordID)
	url, expiresAt, err := h.S3.PresignPutAudio(r.Context(), key, presignTTL)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "presign failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, presignResponse{
		UploadURL:  url,
		AudioS3Key: key,
		ExpiresAt:  expiresAt,
	})
}

type patchBody struct {
	AudioS3Key string `json:"audio_s3_key"`
}

// AttachAudio handles PATCH /records/{id}. Today the only mutable field
// is audio_s3_key (one-shot transition NULL → set). The handler
// validates that the supplied key matches what the backend would have
// generated for this (user, record) pair — this is what prevents a
// hostile client from pointing a record at a different tenant's audio
// or at an arbitrary key inside our bucket.
func (h *Handlers) AttachAudio(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if h.S3 == nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "audio uploads not configured")
		return
	}

	recordID := chi.URLParam(r, "id")
	if recordID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "id is required")
		return
	}

	var body patchBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.AudioS3Key == "" {
		httpx.WriteError(w, http.StatusBadRequest, "audio_s3_key is required")
		return
	}

	expected := h.S3.Config().BuildRecordAudioKey(uid, recordID)
	if body.AudioS3Key != expected {
		httpx.WriteError(w, http.StatusBadRequest, "audio_s3_key mismatch")
		return
	}

	// HEAD the object to confirm the client actually completed the PUT.
	// Without this, a buggy client could PATCH a key it never uploaded
	// and we'd later 404 when the AI worker (or future playback) tried
	// to fetch it.
	if err := h.S3.HeadAudio(r.Context(), body.AudioS3Key); err != nil {
		if errors.Is(err, storage.ErrAudioNotFound) {
			httpx.WriteError(w, http.StatusBadRequest, "audio not uploaded")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "verify upload failed")
		return
	}

	rec, err := h.Store.AttachAudio(r.Context(), uid, recordID, body.AudioS3Key)
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
	httpx.WriteJSON(w, http.StatusOK, rec)
}

// allowPresign trims the per-user timestamp slice to entries inside the
// rolling window and admits the request if there is room. Lock is held
// only for the slice mutation — callers shouldn't see contention since
// presign rate is capped per user.
func (h *Handlers) allowPresign(userID string) bool {
	h.rateMu.Lock()
	defer h.rateMu.Unlock()
	if h.rate == nil {
		h.rate = make(map[string][]time.Time)
	}
	now := time.Now()
	cutoff := now.Add(-presignRateWindow)
	hits := h.rate[userID]
	kept := hits[:0]
	for _, t := range hits {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= presignRateMax {
		h.rate[userID] = kept
		return false
	}
	h.rate[userID] = append(kept, now)
	return true
}
