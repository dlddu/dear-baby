package onboarding

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path"

	"github.com/google/uuid"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/storage"
)

// PhotoStorage is the subset of storage.Client surface the case-onboarding
// handlers need. Defining it as an interface keeps tests free of the
// AWS SDK: the handler accepts any concrete implementation.
type PhotoStorage interface {
	BuildChildPhotoTmpKey(userID, uuid string, format storage.ImageFormat) string
	BuildChildPhotoKey(userID, childID string, format storage.ImageFormat) string
	IsValidChildPhotoTmpKey(userID, key string) bool
	PresignImagePut(ctx context.Context, key string, format storage.ImageFormat) (storage.PresignedPut, error)
	HeadObject(ctx context.Context, key string) (bool, error)
	CopyObject(ctx context.Context, srcKey, dstKey string) error
	DeleteObject(ctx context.Context, key string) error
}

// uploadURLBody is the optional request body for the upload-url endpoint.
// The default of "jpeg" matches what 90% of camera roll picks emit, so a
// client that omits the field still gets a usable URL.
type uploadURLBody struct {
	Format string `json:"format"`
}

// uploadURLResponse echoes the storage envelope plus the canonical tmp
// key the client must hand back inside the case submission payload.
type uploadURLResponse struct {
	storage.PresignedPut
	PhotoTmpKey string `json:"photo_tmp_key"`
}

// CreateChildPhotoUploadURL handles POST
// /onboarding/children/photo/upload-url. It mints an onboarding-tmp key
// scoped to the calling user, returns a presigned PUT URL bound to the
// chosen format, and lets the client upload directly to S3 — the API
// host never proxies bytes.
//
// The tmp key is the contract handed to the case-submission step:
// the client carries it in the children[].photo_tmp_key field, the
// server validates it against IsValidChildPhotoTmpKey and resolves it
// to a permanent key during commit.
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

	var body uploadURLBody
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

	key := h.Photos.BuildChildPhotoTmpKey(uid, uuid.NewString(), format)
	put, err := h.Photos.PresignImagePut(r.Context(), key, format)
	if err != nil {
		slog.Error("presign image put failed", "err", err, "user_id", uid, "format", format)
		httpx.WriteError(w, http.StatusInternalServerError, "presign failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, uploadURLResponse{
		PresignedPut: put,
		PhotoTmpKey:  key,
	})
}

// caseSubmissionResponse returns the children that were just created
// alongside the updated profile so the client can refresh AuthContext
// in one round-trip.
type caseSubmissionResponse struct {
	Children []childView `json:"children"`
	// Note: handlers compose the user profile via the users.Store from
	// the router, so the actual JSON includes whatever the router wires
	// into the ProfileFn callback below. We keep the children list
	// inline so a single response carries everything the client needs.
	User any `json:"user"`
}

// childView is the JSON shape returned for a created child. Mirrors
// ChildRow but with idiomatic snake_case keys.
type childView struct {
	ID             string          `json:"id"`
	Kind           ChildKind       `json:"kind"`
	DisplayName    *string         `json:"display_name"`
	Gender         Gender          `json:"gender"`
	Introduction   *string         `json:"introduction"`
	PhotoS3Key     *string         `json:"photo_s3_key"`
	BirthDate      *string         `json:"birth_date"`
	PregnancyWeeks *int            `json:"pregnancy_weeks"`
	DueDate        *string         `json:"due_date"`
	SortOrder      int             `json:"sort_order"`
	Purposes       []RecordPurpose `json:"purposes"`
}

func toChildView(r ChildRow) childView {
	return childView{
		ID:             r.ID,
		Kind:           r.Kind,
		DisplayName:    r.DisplayName,
		Gender:         r.Gender,
		Introduction:   r.Introduction,
		PhotoS3Key:     r.PhotoS3Key,
		BirthDate:      r.BirthDate,
		PregnancyWeeks: r.PregnancyWeeks,
		DueDate:        r.DueDate,
		SortOrder:      r.SortOrder,
		Purposes:       append([]RecordPurpose(nil), r.Purposes...),
	}
}

// SubmitCase handles POST /onboarding/case — the main funnel commit.
// The handler:
//  1. validates the body shape and case/kind composition rules
//  2. opens a DB transaction that inserts children + purposes + stamps
//     onboarded_at
//  3. for each child carrying a photo_tmp_key: validates the key,
//     confirms the S3 object exists, copies it to its permanent key,
//     and writes the permanent key onto the row
//  4. on commit, kicks off a best-effort delete of the tmp keys (if a
//     delete fails the orphans get reaped by reset-onboarding)
//  5. returns the created children + refreshed profile
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
	if err := sub.Validate(); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	// If any child carries a photo_tmp_key, the photo storage must be
	// configured. A nil store is a deployment misconfiguration, not
	// the caller's fault, so return 503.
	usesPhotos := false
	for _, c := range sub.Children {
		if c.PhotoTmpKey != "" {
			usesPhotos = true
			break
		}
	}
	if usesPhotos && h.Photos == nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "photo storage not configured")
		return
	}

	tmpKeysToCleanup := make([]string, 0, len(sub.Children))
	finalizer := func(ctx context.Context, childID string, c *ChildInput) (string, error) {
		if h.Photos == nil {
			return "", fmt.Errorf("photo storage missing")
		}
		if !h.Photos.IsValidChildPhotoTmpKey(uid, c.PhotoTmpKey) {
			return "", fmt.Errorf("%w: photo_tmp_key not owned by user", ErrInvalidPayload)
		}
		exists, err := h.Photos.HeadObject(ctx, c.PhotoTmpKey)
		if err != nil {
			return "", fmt.Errorf("head tmp object: %w", err)
		}
		if !exists {
			return "", fmt.Errorf("%w: photo_tmp_key object missing in S3", ErrInvalidPayload)
		}
		ext := path.Ext(c.PhotoTmpKey)
		format, ok := storage.ImageFormatFromExtension(ext)
		if !ok {
			return "", fmt.Errorf("%w: unsupported photo extension", ErrInvalidPayload)
		}
		dst := h.Photos.BuildChildPhotoKey(uid, childID, format)
		if err := h.Photos.CopyObject(ctx, c.PhotoTmpKey, dst); err != nil {
			return "", fmt.Errorf("copy tmp to final: %w", err)
		}
		tmpKeysToCleanup = append(tmpKeysToCleanup, c.PhotoTmpKey)
		return dst, nil
	}

	rows, err := h.Store.SaveCaseOnboarding(r.Context(), uid, &sub, finalizer)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidPayload):
			httpx.WriteError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, ErrNotFound):
			httpx.WriteError(w, http.StatusNotFound, "user not found")
		default:
			slog.Error("save case onboarding failed", "err", err, "user_id", uid)
			httpx.WriteError(w, http.StatusInternalServerError, "internal")
		}
		return
	}

	// Best-effort tmp cleanup. The DB commit has already happened, so
	// from the user's perspective the submission is complete; failing
	// to delete the tmp object is a janitor problem (reset-onboarding
	// will scoop it up later).
	for _, key := range tmpKeysToCleanup {
		if err := h.Photos.DeleteObject(r.Context(), key); err != nil {
			slog.Warn("tmp photo delete failed",
				"err", err, "user_id", uid, "key", key)
		}
	}

	views := make([]childView, len(rows))
	for i, row := range rows {
		views[i] = toChildView(row)
	}
	var profile any
	if h.ProfileFn != nil {
		profile, err = h.ProfileFn(r.Context(), uid)
		if err != nil {
			slog.Error("profile lookup after submit failed", "err", err, "user_id", uid)
			httpx.WriteError(w, http.StatusInternalServerError, "internal")
			return
		}
	}
	httpx.WriteJSON(w, http.StatusCreated, caseSubmissionResponse{
		Children: views,
		User:     profile,
	})
}
