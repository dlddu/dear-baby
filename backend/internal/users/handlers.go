package users

import (
	"errors"
	"net/http"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
)

// Handlers exposes the user-scoped HTTP handlers.
type Handlers struct {
	Store            *Store
	UserIDFromCtxFn  func(r *http.Request) (string, bool)
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
