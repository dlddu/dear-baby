package users

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
)

// Handlers exposes the user-scoped HTTP handlers.
type Handlers struct {
	Store           *Store
	UserIDFromCtxFn func(r *http.Request) (string, bool)
}

// Me returns the authenticated user's profile. Expects that an auth
// middleware has already injected the user id into the request context.
func (h *Handlers) Me(w http.ResponseWriter, r *http.Request) {
	id, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	u, err := h.Store.GetByID(r.Context(), id)
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, u)
}

// isoDateRe matches the YYYY-MM-DD shape we accept for due_date; we also
// validate the date is real (e.g., rejects 2025-02-31) below via time.Parse.
var isoDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// patchMeBody is the request body for PATCH /me.
//
// due_date: nullable. When present it must be an ISO date (YYYY-MM-DD).
// Sending {"due_date": null} marks the user as onboarded without a date
// (the onboarding "아직 정해지지 않았어요" escape hatch).
type patchMeBody struct {
	DueDate *string `json:"due_date"`
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

	if err := h.Store.UpdateOnboarding(r.Context(), id, body.DueDate); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}

	u, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, u)
}
