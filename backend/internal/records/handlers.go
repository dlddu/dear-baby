package records

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"
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

// maxQuestionRunes caps the daily question stored alongside a record.
// 500 UTF-8 code points is well above the longest Stage 2 prompt and
// comfortably fits any future weekly-matched question text.
const maxQuestionRunes = 500

// defaultListLimit / maxListLimit cap the diary list page size. 30 is a
// comfortable scroll page in the mockup; 100 is the upper bound so a
// pathological cursor request doesn't return everything at once.
const (
	defaultListLimit = 30
	maxListLimit     = 100
)

// AudioStorage is the subset of the storage.Client surface the handlers
// need. Defining it as an interface here lets tests substitute a fake
// without pulling in the AWS SDK at all.
type AudioStorage interface {
	BuildRecordAudioKey(userID, recordID string, format storage.AudioFormat, createdAt time.Time) string
	IsValidRecordAudioKey(userID, recordID, key string, createdAt time.Time) bool
	PresignPut(ctx context.Context, key string, format storage.AudioFormat) (storage.PresignedPut, error)
	HeadObject(ctx context.Context, key string) (bool, error)
}

// Handlers exposes the records HTTP surface:
//   - POST   /records                          (text + voice, audio attached later)
//   - GET    /records                          (diary tab list with filter + cursor)
//   - GET    /records/{id}                     (diary tab detail)
//   - PATCH  /records/{id}                     (audio_s3_key | content | visibility)
//   - DELETE /records/{id}                     (diary tab delete)
//   - POST   /records/{id}/audio/upload-url    (presigned S3 PUT URL)
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
	// QuestionText is the daily question the home screen surfaced when
	// the user started this record. Optional — non-home entry points
	// (deep links, future flows) may omit it.
	QuestionText string `json:"question_text"`
	// SubjectID points to a record_subjects row. Required at every write
	// site — PRD-008 makes the diary tab "which child's record" a
	// first-class field rather than a derived attribute. The client looks
	// up the active child's subject_id from /me.
	SubjectID string `json:"subject_id"`
	// Visibility flips between 'private' and 'public'. Optional —
	// defaults to 'private' (user-trust-first). The diary tab's per-row
	// toggle later switches it.
	Visibility string `json:"visibility"`
}

// createResponse returns the new record alongside the updated flat profile
// so the client can refresh AuthContext in one round-trip.
type createResponse struct {
	Record *Record        `json:"record"`
	User   *users.Profile `json:"user"`
}

// Create handles POST /records. Accepts `{content, subject_id, source?,
// visibility?, question_text?}`, validates, persists, and re-derives
// first_record_at from the oldest existing record. For source="voice"
// the audio is attached separately via PATCH after the device uploads to S3.
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

	visibility := VisibilityPrivate
	if body.Visibility != "" {
		v := Visibility(body.Visibility)
		if !v.Valid() {
			httpx.WriteError(w, http.StatusBadRequest, "invalid visibility")
			return
		}
		visibility = v
	}

	subjectID := strings.TrimSpace(body.SubjectID)
	if subjectID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "subject_id is required")
		return
	}

	var questionText *string
	if q := strings.TrimSpace(body.QuestionText); q != "" {
		if utf8.RuneCountInString(q) > maxQuestionRunes {
			httpx.WriteError(w, http.StatusBadRequest, "question_text too long")
			return
		}
		questionText = &q
	}

	res, err := h.Store.Create(r.Context(), h.Users, uid, content, source, questionText, subjectID, visibility)
	if err != nil {
		switch {
		case errors.Is(err, users.ErrNotFound):
			httpx.WriteError(w, http.StatusNotFound, "user not found")
		case errors.Is(err, ErrInvalidSubject):
			httpx.WriteError(w, http.StatusBadRequest, "invalid subject_id")
		case errors.Is(err, ErrInvalidContent):
			httpx.WriteError(w, http.StatusBadRequest, err.Error())
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "internal")
		}
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, createResponse{Record: res.Record, User: res.Profile})
}

// listResponse is the GET /records body: a page of records plus an opaque
// cursor for the next page (empty when exhausted).
type listResponse struct {
	Records    []Record `json:"records"`
	NextCursor string   `json:"next_cursor"`
}

// List handles GET /records?subject_id=…&subject_id=…&visibility=…
// &cursor=…&limit=…. All query params are optional. Empty subject_id
// filters means "any of the user's subjects". When visibility is omitted
// both private and public are returned. cursor is opaque — pass through
// from a prior response.
func (h *Handlers) List(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	q := r.URL.Query()
	filter := ListFilter{}
	if subjects, ok := q["subject_id"]; ok {
		for _, s := range subjects {
			s = strings.TrimSpace(s)
			if s != "" {
				filter.SubjectIDs = append(filter.SubjectIDs, s)
			}
		}
	}
	if v := strings.TrimSpace(q.Get("visibility")); v != "" {
		vis := Visibility(v)
		if !vis.Valid() {
			httpx.WriteError(w, http.StatusBadRequest, "invalid visibility")
			return
		}
		filter.Visibility = &vis
	}
	limit := defaultListLimit
	if l := strings.TrimSpace(q.Get("limit")); l != "" {
		n, err := strconv.Atoi(l)
		if err != nil || n <= 0 {
			httpx.WriteError(w, http.StatusBadRequest, "invalid limit")
			return
		}
		if n > maxListLimit {
			n = maxListLimit
		}
		limit = n
	}
	cursor := strings.TrimSpace(q.Get("cursor"))

	recs, next, err := h.Store.ListForUser(r.Context(), uid, filter, cursor, limit)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, listResponse{Records: recs, NextCursor: next})
}

// Get handles GET /records/{id}.
func (h *Handlers) Get(w http.ResponseWriter, r *http.Request) {
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
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"record": rec})
}

// Delete handles DELETE /records/{id}.
func (h *Handlers) Delete(w http.ResponseWriter, r *http.Request) {
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
	if err := h.Store.DeleteForUser(r.Context(), uid, recordID); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "record not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// audioUploadURLResponse mirrors storage.PresignedPut plus the canonical
// audio_s3_key the client will hand back via PATCH. Echoing the key lets
// the client send back exactly what the server expects without doing
// any string assembly itself.
type audioUploadURLResponse struct {
	storage.PresignedPut
	AudioS3Key string `json:"audio_s3_key"`
}

// audioUploadURLBody is the optional request body for upload-url. Only
// `format` is supported today: "m4a" (default, Android) or "wav"
// (iOS). Older clients send no body; ParseAudioFormat falls back to
// m4a so they keep working unchanged.
type audioUploadURLBody struct {
	Format string `json:"format"`
}

// CreateAudioUploadURL handles POST /records/{id}/audio/upload-url.
// Returns a short-lived presigned PUT URL bound to the canonical key
// for this user/record. The client uploads with the returned URL +
// Content-Type, then PATCHes the record with the same key.
//
// Accepts an optional `{format: "wav"|"m4a"}` body so iOS (PCM/.wav)
// and Android (AAC/.m4a) can each request a presigned URL whose
// Content-Type matches what the device actually produced — SigV4
// would otherwise reject the PUT because Content-Type is signed.
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

	// Body is optional — older clients send nothing. io.EOF on Decode
	// means an empty body, which falls through to the default format.
	var body audioUploadURLBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	format, formatOK := storage.ParseAudioFormat(body.Format)
	if !formatOK {
		httpx.WriteError(w, http.StatusBadRequest, "unsupported format")
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

	key := h.Audio.BuildRecordAudioKey(uid, recordID, format, rec.CreatedAt)
	put, err := h.Audio.PresignPut(r.Context(), key, format)
	if err != nil {
		slog.Error("presign put failed", "err", err, "user_id", uid, "record_id", recordID, "format", format)
		httpx.WriteError(w, http.StatusInternalServerError, "presign failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, audioUploadURLResponse{
		PresignedPut: put,
		AudioS3Key:   key,
	})
}

type patchBody struct {
	// AudioS3Key is the original PATCH field; can flip from null → a
	// canonical key matching this user/record. Never clears.
	AudioS3Key *string `json:"audio_s3_key"`
	// Content edits the body of an existing record. Diary tab edit path.
	Content *string `json:"content"`
	// Visibility flips between 'private' and 'public'. Diary tab toggle.
	Visibility *string `json:"visibility"`
}

// Patch handles PATCH /records/{id}. Accepts exactly one of audio_s3_key,
// content, or visibility per request — the three fields touch independent
// storage paths (S3, the body column, the visibility column) and mixing
// them invites half-applied edits when one half fails. The Diary tab edit
// + visibility-toggle flows live here; audio attach stays the
// original behavior (validates against canonical key + HEAD-checks S3).
func (h *Handlers) Patch(w http.ResponseWriter, r *http.Request) {
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

	// Reject ambiguous requests up front. Counting non-nil fields rather
	// than building a discriminated union keeps the handler small.
	set := 0
	if body.AudioS3Key != nil {
		set++
	}
	if body.Content != nil {
		set++
	}
	if body.Visibility != nil {
		set++
	}
	if set == 0 {
		httpx.WriteError(w, http.StatusBadRequest, "no fields to update")
		return
	}
	if set > 1 {
		httpx.WriteError(w, http.StatusBadRequest, "exactly one field per request")
		return
	}

	switch {
	case body.Content != nil:
		h.patchContent(w, r, uid, recordID, *body.Content)
	case body.Visibility != nil:
		h.patchVisibility(w, r, uid, recordID, *body.Visibility)
	default:
		h.patchAudio(w, r, uid, recordID, *body.AudioS3Key)
	}
}

func (h *Handlers) patchContent(w http.ResponseWriter, r *http.Request, uid, recordID, content string) {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		httpx.WriteError(w, http.StatusBadRequest, "content is required")
		return
	}
	if utf8.RuneCountInString(trimmed) > maxContentRunes {
		httpx.WriteError(w, http.StatusBadRequest, "content too long")
		return
	}
	rec, err := h.Store.UpdateContent(r.Context(), uid, recordID, trimmed)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "record not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"record": rec})
}

func (h *Handlers) patchVisibility(w http.ResponseWriter, r *http.Request, uid, recordID, raw string) {
	v := Visibility(strings.TrimSpace(raw))
	if !v.Valid() {
		httpx.WriteError(w, http.StatusBadRequest, "invalid visibility")
		return
	}
	rec, err := h.Store.UpdateVisibility(r.Context(), uid, recordID, v)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "record not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"record": rec})
}

func (h *Handlers) patchAudio(w http.ResponseWriter, r *http.Request, uid, recordID, key string) {
	if h.Audio == nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "audio storage not configured")
		return
	}
	if key == "" {
		httpx.WriteError(w, http.StatusBadRequest, "audio_s3_key is required")
		return
	}

	// Look up the record before validating the key. Two reasons:
	//   1. If the record doesn't belong to this user, returning 404
	//      (rather than 400 "key mismatch") avoids leaking whether
	//      the record exists for another user.
	//   2. If the row already has an audio_s3_key, returning 409
	//      short-circuits the HEAD round-trip.
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
		httpx.WriteError(w, http.StatusConflict, "audio already attached")
		return
	}

	if !h.Audio.IsValidRecordAudioKey(uid, recordID, key, rec.CreatedAt) {
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

	rec, err = h.Store.AttachAudio(r.Context(), uid, recordID, key)
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
