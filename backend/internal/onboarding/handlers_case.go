package onboarding

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/google/uuid"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/storage"
)

// PhotoStorage is the subset of *storage.Client the case-branching
// onboarding handlers need. Declared as an interface so tests can swap
// in a stub without bringing up real S3.
type PhotoStorage interface {
	BuildChildPhotoTmpKey(userID, photoID string, format storage.ImageFormat) string
	PresignImagePut(ctx context.Context, key string, format storage.ImageFormat) (storage.PresignedPut, error)
	IsValidChildPhotoTmpKey(userID, key string) bool
	PhotoMover
}

// CaseHandlers exposes the case-branching onboarding endpoints.
//
//	POST /onboarding/children/photo/upload-url   → presigned PUT for an onboarding-tmp photo
//	POST /onboarding/case                        → final submit (case + children + purposes + photo rename)
//
// Kept on a separate struct from Handlers (which carries the AI-preview
// + SSE state) so wiring stays explicit and the optional Photo dependency
// can be omitted in environments without S3.
type CaseHandlers struct {
	Store           *Store
	Photo           PhotoStorage
	UserIDFromCtxFn func(r *http.Request) (string, bool)
}

// uploadURLBody narrows the wire input. format is required — unlike
// audio there is no historical default; the client always knows what it
// just picked from the system asset library.
type uploadURLBody struct {
	Format string `json:"format"`
}

// uploadURLResponse mirrors records.audioUploadURLResponse so the
// client's S3 PUT helper can be shared between audio and photo paths.
type uploadURLResponse struct {
	storage.PresignedPut
	PhotoTmpKey string `json:"photo_tmp_key"`
}

// CreateChildPhotoUploadURL handles POST /onboarding/children/photo/upload-url.
// Returns a short-lived presigned PUT URL bound to a freshly-generated
// onboarding-tmp key. The client uploads with the returned URL +
// Content-Type, keeps the photo_tmp_key, and includes it in the final
// POST /onboarding/case payload. If the user abandons before submit,
// reset-onboarding cleans up the orphaned tmp objects.
//
// Idempotent in the sense that repeated calls produce different (and
// equally-valid) tmp keys — the user could pre-fetch one before picking
// a photo and then never use it.
func (h *CaseHandlers) CreateChildPhotoUploadURL(w http.ResponseWriter, r *http.Request) {
	if h.Photo == nil {
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
	if err := dec.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	format, ok := storage.ParseImageFormat(body.Format)
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "unsupported format")
		return
	}

	photoID := uuid.NewString()
	key := h.Photo.BuildChildPhotoTmpKey(uid, photoID, format)
	put, err := h.Photo.PresignImagePut(r.Context(), key, format)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "presign failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, uploadURLResponse{
		PresignedPut: put,
		PhotoTmpKey:  key,
	})
}

// isoDateRe matches the YYYY-MM-DD shape we accept for child birth/due
// dates; we also validate the date is real (e.g., rejects 2025-02-31)
// via time.Parse below.
var isoDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// SubmitCase handles POST /onboarding/case. Validates the payload
// (case ↔ children kinds, required fields per kind, ≥1 purpose per
// child, photo_tmp_key ownership), then delegates to
// Store.SaveCaseOnboarding which runs the multi-step transaction.
//
// 4xx is reserved for client mistakes (validation failures, photo not
// uploaded, mismatched ownership). 5xx for genuine server problems
// (DB write failures, S3 outages on photo rename).
func (h *CaseHandlers) SubmitCase(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var payload SubmitCasePayload
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&payload); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if msg := validateCasePayload(uid, payload, h.Photo); msg != "" {
		httpx.WriteError(w, http.StatusBadRequest, msg)
		return
	}

	rows, err := h.Store.SaveCaseOnboarding(r.Context(), h.Photo, uid, payload)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		// Photo lookup failures (HEAD/Copy/Delete returning err) end up
		// here; treat them as 500 so retry is meaningful. The transaction
		// rolled back so a follow-up call sees an empty state.
		httpx.WriteError(w, http.StatusInternalServerError, fmt.Sprintf("save: %v", err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"case":     payload.Case,
		"children": rows,
	})
}

// validateCasePayload returns "" if the payload is valid, otherwise a
// short message suitable for the 4xx body. The validator is strict
// against AC-006-02/03/04 which dictate per-case child kind rules.
func validateCasePayload(userID string, p SubmitCasePayload, photo PhotoStorage) string {
	if _, ok := ParseCase(string(p.Case)); !ok {
		return "invalid case"
	}
	if len(p.Children) == 0 {
		return "children required"
	}

	hasFetus, hasChild := false, false
	for i, c := range p.Children {
		if _, ok := ParseChildKind(string(c.Kind)); !ok {
			return fmt.Sprintf("children[%d]: invalid kind", i)
		}
		if _, ok := ParseGender(string(c.Gender)); !ok {
			return fmt.Sprintf("children[%d]: invalid gender", i)
		}
		switch c.Kind {
		case ChildKindFetus:
			hasFetus = true
			if c.PregnancyWeeks == nil || *c.PregnancyWeeks < 0 || *c.PregnancyWeeks > 45 {
				return fmt.Sprintf("children[%d]: invalid pregnancy_weeks", i)
			}
			if c.DueDate == nil || !isValidISODate(*c.DueDate) {
				return fmt.Sprintf("children[%d]: invalid due_date", i)
			}
			if c.BirthDate != nil {
				return fmt.Sprintf("children[%d]: birth_date not allowed for fetus", i)
			}
		case ChildKindChild:
			hasChild = true
			if c.DisplayName == nil || *c.DisplayName == "" {
				return fmt.Sprintf("children[%d]: display_name required", i)
			}
			if c.BirthDate == nil || !isValidISODate(*c.BirthDate) {
				return fmt.Sprintf("children[%d]: invalid birth_date", i)
			}
			if c.PregnancyWeeks != nil {
				return fmt.Sprintf("children[%d]: pregnancy_weeks not allowed for child", i)
			}
			if c.DueDate != nil {
				return fmt.Sprintf("children[%d]: due_date not allowed for child", i)
			}
		}
		if len(c.Purposes) == 0 {
			return fmt.Sprintf("children[%d]: at least one purpose required", i)
		}
		seen := make(map[RecordPurpose]bool, len(c.Purposes))
		for _, p := range c.Purposes {
			if _, ok := ParseRecordPurpose(string(p)); !ok {
				return fmt.Sprintf("children[%d]: invalid purpose %q", i, p)
			}
			if seen[p] {
				return fmt.Sprintf("children[%d]: duplicate purpose %q", i, p)
			}
			seen[p] = true
		}
		if c.PhotoTmpKey != nil && *c.PhotoTmpKey != "" {
			if photo == nil || !photo.IsValidChildPhotoTmpKey(userID, *c.PhotoTmpKey) {
				return fmt.Sprintf("children[%d]: invalid photo_tmp_key", i)
			}
		}
	}

	switch p.Case {
	case CaseA:
		if hasChild {
			return "case A: only fetus children allowed"
		}
	case CaseB:
		if !hasFetus || !hasChild {
			return "case B: requires both fetus and child entries"
		}
	case CaseC:
		if hasFetus {
			return "case C: only child entries allowed"
		}
	}
	return ""
}

func isValidISODate(s string) bool {
	if !isoDateRe.MatchString(s) {
		return false
	}
	if _, err := time.Parse("2006-01-02", s); err != nil {
		return false
	}
	return true
}
