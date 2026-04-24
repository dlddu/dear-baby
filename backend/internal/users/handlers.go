package users

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
)

// OnboardingUpdater is the minimal surface the users.Handlers need from
// the onboarding store. Declared as an interface so the users package does
// not import the onboarding package. The router wires in the concrete
// *onboarding.Store.
type OnboardingUpdater interface {
	UpdateDueDateAndOnboardedAt(ctx context.Context, userID string, dueDate *string) error
	DismissVoiceCoachmark(ctx context.Context, userID string) error
}

// Handlers exposes the user-scoped HTTP handlers.
type Handlers struct {
	Store                 *Store
	Onboarding            OnboardingUpdater
	OnboardingErrNotFound error // sentinel from the onboarding package, for error mapping
	UserIDFromCtxFn       func(r *http.Request) (string, bool)
}

// Me returns the authenticated user's profile — the flat view that merges
// users + onboarding.
func (h *Handlers) Me(w http.ResponseWriter, r *http.Request) {
	id, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	p, err := h.Store.GetProfile(r.Context(), id)
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

// isoDateRe matches the YYYY-MM-DD shape we accept for due_date; we also
// validate the date is real (e.g., rejects 2025-02-31) below via time.Parse.
var isoDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// patchMeBody is the request body for PATCH /me. Either due_date or
// dismiss_voice_coachmark is sent — never both in the same call.
type patchMeBody struct {
	DueDate               *string `json:"due_date"`
	DismissVoiceCoachmark *bool   `json:"dismiss_voice_coachmark"`
}

// PatchMe updates the authenticated user's onboarding fields. It accepts
// a single optional due_date and always stamps onboarded_at.
func (h *Handlers) PatchMe(w http.ResponseWriter, r *http.Request) {
	id, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var body patchMeBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}

	if body.DismissVoiceCoachmark != nil && *body.DismissVoiceCoachmark {
		if body.DueDate != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if err := h.Onboarding.DismissVoiceCoachmark(r.Context(), id); err != nil {
			if isOnboardingNotFound(err, h.OnboardingErrNotFound) {
				httpx.WriteError(w, http.StatusNotFound, "user not found")
				return
			}
			httpx.WriteError(w, http.StatusInternalServerError, "internal")
			return
		}
		p, err := h.Store.GetProfile(r.Context(), id)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				httpx.WriteError(w, http.StatusNotFound, "user not found")
				return
			}
			httpx.WriteError(w, http.StatusInternalServerError, "internal")
			return
		}
		httpx.WriteJSON(w, http.StatusOK, p)
		return
	}

	if body.DueDate != nil {
		s := *body.DueDate
		if !isoDateRe.MatchString(s) {
			httpx.WriteError(w, http.StatusBadRequest, "invalid date")
			return
		}
		if _, err := time.Parse("2006-01-02", s); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid date")
			return
		}
	}

	// Validate user exists before writing to onboarding — keeps 404
	// semantics consistent when the onboarding row is created lazily.
	if _, err := h.Store.GetByID(r.Context(), id); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}

	if err := h.Onboarding.UpdateDueDateAndOnboardedAt(r.Context(), id, body.DueDate); err != nil {
		if isOnboardingNotFound(err, h.OnboardingErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}

	p, err := h.Store.GetProfile(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

func isOnboardingNotFound(err error, sentinel error) bool {
	if sentinel != nil && errors.Is(err, sentinel) {
		return true
	}
	return errors.Is(err, sql.ErrNoRows)
}
