package auth

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/dlddu/dear-baby/backend/internal/config"
	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

// Handlers exposes the auth HTTP endpoints.
type Handlers struct {
	Cfg     *config.Config
	Service *Service
}

type googleSignInRequest struct {
	IDToken string `json:"id_token"`
}

type sessionResponse struct {
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	User         *users.User `json:"user"`
}

// Google handles POST /auth/google.
func (h *Handlers) Google(w http.ResponseWriter, r *http.Request) {
	if err := h.Cfg.RequireAuthEnv(); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "auth not configured")
		return
	}
	var req googleSignInRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.IDToken == "" {
		httpx.WriteError(w, http.StatusBadRequest, "id_token required")
		return
	}
	result, err := h.Service.SignInWithGoogle(r.Context(), req.IDToken)
	if err != nil {
		slog.Warn("google sign-in failed", "error", err)
		httpx.WriteError(w, http.StatusUnauthorized, "invalid google token")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, sessionResponse{
		AccessToken:  result.AccessToken,
		RefreshToken: result.RefreshToken,
		User:         result.User,
	})
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// Refresh handles POST /auth/refresh.
func (h *Handlers) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		httpx.WriteError(w, http.StatusBadRequest, "refresh_token required")
		return
	}
	result, err := h.Service.RefreshSession(r.Context(), req.RefreshToken)
	if err != nil {
		if errors.Is(err, ErrRefreshInvalid) {
			httpx.WriteError(w, http.StatusUnauthorized, "invalid refresh token")
			return
		}
		httpx.WriteError(w, http.StatusUnauthorized, "refresh failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, sessionResponse{
		AccessToken:  result.AccessToken,
		RefreshToken: result.RefreshToken,
		User:         result.User,
	})
}

// Logout handles POST /auth/logout. Always 204 to avoid leaking whether the
// refresh token was valid.
func (h *Handlers) Logout(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	_ = h.Service.Logout(r.Context(), req.RefreshToken)
	w.WriteHeader(http.StatusNoContent)
}
