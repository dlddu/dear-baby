package onboarding

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/storage"
)

// PhotoStorage is the subset of the storage.Client surface the
// case-onboarding handlers and store need. Defining it as an interface
// here keeps the onboarding package testable without the AWS SDK.
type PhotoStorage interface {
	BuildChildPhotoTmpKey(userID, uploadID string, format storage.ImageFormat) string
	IsValidChildPhotoTmpKey(userID, key string) bool
	PresignImagePut(ctx context.Context, key string, format storage.ImageFormat) (storage.PresignedPut, error)
	MoveChildPhoto(ctx context.Context, userID, childID, tmpKey string) (string, error)
}

// CaseHandlers exposes POST /onboarding/case + the photo upload-url
// endpoint that supports it. Kept on a separate struct from the AI
// preview Handlers so the router can wire the dependencies it actually
// needs without a god-handler.
type CaseHandlers struct {
	Store           *Store
	Photos          PhotoStorage
	UsersUpdater    UsersProfileFetcher
	UserIDFromCtxFn func(r *http.Request) (string, bool)
}

// UsersProfileFetcher returns the merged user+onboarding profile after
// SaveCaseOnboarding commits, so the response can echo the updated
// profile in one round-trip — same shape as the audio/preview routes.
type UsersProfileFetcher interface {
	GetProfileForUser(ctx context.Context, userID string) (any, error)
}

// childPhotoUploadURLBody is optional; the format is required when
// present. We accept an empty body and default to JPEG so older clients
// (and the test runner) can fall through without sending it — but the
// Content-Type returned to the client will pin the format.
type childPhotoUploadURLBody struct {
	Format string `json:"format"`
}

type childPhotoUploadURLResponse struct {
	storage.PresignedPut
	PhotoTmpKey string `json:"photo_tmp_key"`
}

// CreateChildPhotoUploadURL handles POST
// /onboarding/children/photo/upload-url. Returns a presigned PUT URL
// to a UUID-named key under the caller's onboarding-tmp prefix. The
// client uploads, then submits the same photo_tmp_key via POST
// /onboarding/case so the server can rename it to the permanent key
// (built from the freshly-minted child id).
//
// Idempotent in spirit: presigning is read-only, so a client can
// re-request after the 5-min URL expiry. A new UUID is generated each
// time — losing the previous one to garbage is intentional, the reset
// tool eventually sweeps the tmp prefix.
func (h *CaseHandlers) CreateChildPhotoUploadURL(w http.ResponseWriter, r *http.Request) {
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
	if body.Format == "" {
		// Default to JPEG: every camera roll has these, and HEIC clients
		// always send the field explicitly.
		body.Format = "jpeg"
	}
	format, ok := storage.ParseImageFormat(body.Format)
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "unsupported format")
		return
	}

	uploadID := uuid.NewString()
	key := h.Photos.BuildChildPhotoTmpKey(uid, uploadID, format)
	put, err := h.Photos.PresignImagePut(r.Context(), key, format)
	if err != nil {
		slog.Error("presign image put failed", "err", err, "user_id", uid)
		httpx.WriteError(w, http.StatusInternalServerError, "presign failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, childPhotoUploadURLResponse{
		PresignedPut: put,
		PhotoTmpKey:  key,
	})
}

// caseSubmitResponse echoes the updated profile so the client can flip
// AuthContext to status='authenticated' in the same round-trip.
type caseSubmitResponse struct {
	User any `json:"user"`
}

// isoDateRe matches YYYY-MM-DD shape; combined with time.Parse below it
// rejects 2025-02-31.
var isoDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// validateCasePayload runs the field-level validation that
// SaveCaseOnboarding relies on. Mirrors the rules in
// docs/prd/PRD-006-onboarding-cases.md AC-006-01~04 and the wireframe
// constraints. Returns nil on success, an HTTP-friendly error string
// otherwise.
func validateCasePayload(in CaseOnboardingInput, photos PhotoStorage, userID string) string {
	if !in.Case.Valid() {
		return "invalid case"
	}
	if len(in.Children) == 0 {
		return "at least one child required"
	}
	hasFetus, hasChild := false, false
	for i, c := range in.Children {
		if !c.Kind.Valid() {
			return childErr(i, "invalid kind")
		}
		if !c.Gender.Valid() {
			return childErr(i, "invalid gender")
		}
		if len(c.Purposes) == 0 {
			return childErr(i, "at least one purpose required")
		}
		for _, p := range c.Purposes {
			if !p.Valid() {
				return childErr(i, "invalid purpose")
			}
		}

		switch c.Kind {
		case ChildKindFetus:
			hasFetus = true
			if c.PregnancyWeeks == nil || *c.PregnancyWeeks < 1 || *c.PregnancyWeeks > 45 {
				return childErr(i, "pregnancy_weeks required (1-45)")
			}
			if c.DueDate == nil || !validISODate(*c.DueDate) {
				return childErr(i, "due_date required (YYYY-MM-DD)")
			}
			if c.BirthDate != nil {
				return childErr(i, "birth_date forbidden for fetus")
			}
		case ChildKindChild:
			hasChild = true
			if c.DisplayName == nil || strings.TrimSpace(*c.DisplayName) == "" {
				return childErr(i, "display_name required")
			}
			if c.BirthDate == nil || !validISODate(*c.BirthDate) {
				return childErr(i, "birth_date required (YYYY-MM-DD)")
			}
			if c.PregnancyWeeks != nil || c.DueDate != nil {
				return childErr(i, "pregnancy_weeks/due_date forbidden for child")
			}
		}

		if c.PhotoTmpKey != nil && *c.PhotoTmpKey != "" {
			if photos == nil {
				return childErr(i, "photos not configured on server")
			}
			if !photos.IsValidChildPhotoTmpKey(userID, *c.PhotoTmpKey) {
				return childErr(i, "invalid photo_tmp_key")
			}
		}
	}

	switch in.Case {
	case CaseA:
		if !hasFetus || hasChild {
			return "case A requires fetus children only"
		}
	case CaseB:
		if !hasFetus || !hasChild {
			return "case B requires both fetus and child"
		}
	case CaseC:
		if !hasChild || hasFetus {
			return "case C requires child children only"
		}
	}
	return ""
}

func childErr(i int, msg string) string {
	return fmt.Sprintf("child %d: %s", i, msg)
}

func validISODate(s string) bool {
	if !isoDateRe.MatchString(s) {
		return false
	}
	if _, err := time.Parse("2006-01-02", s); err != nil {
		return false
	}
	return true
}

// SubmitCase handles POST /onboarding/case. Validates the payload,
// persists children + purposes + case_kind in a single transaction
// (with photo rename inline), then echoes the updated profile so the
// client can move from 'onboarding' to 'authenticated' without a
// follow-up /me call.
func (h *CaseHandlers) SubmitCase(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var in CaseOnboardingInput
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&in); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}

	if msg := validateCasePayload(in, h.Photos, uid); msg != "" {
		httpx.WriteError(w, http.StatusBadRequest, msg)
		return
	}

	// h.Photos may be nil in CI smoke environments; pass nil through
	// so SaveCaseOnboarding skips the rename step. Validation above
	// already rejected payloads that depend on photos when photos is
	// nil, so this is purely a "no photos to move" path.
	var mover PhotoMover
	if h.Photos != nil {
		mover = h.Photos
	}

	if err := h.Store.SaveCaseOnboarding(r.Context(), uid, in, mover); err != nil {
		slog.Error("save case onboarding failed", "err", err, "user_id", uid)
		httpx.WriteError(w, http.StatusInternalServerError, "save failed")
		return
	}

	if h.UsersUpdater == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	profile, err := h.UsersUpdater.GetProfileForUser(r.Context(), uid)
	if err != nil {
		slog.Error("fetch profile after save failed", "err", err, "user_id", uid)
		// Save committed; profile fetch is best-effort. Return 204 so
		// the client falls back to /me.
		w.WriteHeader(http.StatusNoContent)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, caseSubmitResponse{User: profile})
}
