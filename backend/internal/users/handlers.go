package users

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
)

// OnboardingUpdater is the minimal surface the users.Handlers need from
// the onboarding store. Declared as an interface so the users package does
// not import the onboarding package. The router wires in the concrete
// *onboarding.Store.
type OnboardingUpdater interface {
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

// patchMeBody is the request body for PATCH /me. Today only the voice
// coachmark dismissal flows through here; the case-branching onboarding
// completion lives at POST /onboarding/case.
type patchMeBody struct {
	DismissVoiceCoachmark *bool `json:"dismiss_voice_coachmark"`
}

// PatchMe updates the authenticated user's voice-coachmark dismissal.
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

	if body.DismissVoiceCoachmark == nil || !*body.DismissVoiceCoachmark {
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
}

func isOnboardingNotFound(err error, sentinel error) bool {
	if sentinel != nil && errors.Is(err, sentinel) {
		return true
	}
	return errors.Is(err, sql.ErrNoRows)
}
