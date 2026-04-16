package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/dlddu/dear-baby/backend/internal/config"
	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

// testProvider is the oauth_accounts provider value used for users created
// through POST /auth/test-login. Kept distinct from "google" so the Google
// namespace stays untouched by the E2E harness.
const testProvider = "test"

// defaultTestEmail is used when the test-login request omits an email.
const (
	defaultTestEmail = "e2e-test@dear-baby.test"
	defaultTestName  = "E2E Test"
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

// testLoginRequest is the body for POST /auth/test-login. All fields are
// optional. `onboarded` controls whether the returned user already has
// `onboarded_at` set so the E2E flow can test both the onboarding funnel
// and the post-onboarding tabs without seeding data out-of-band.
type testLoginRequest struct {
	Email     string `json:"email"`
	Name      string `json:"name"`
	Onboarded bool   `json:"onboarded"`
}

// TestLogin handles POST /auth/test-login. This handler is only mounted
// when config.Config.TestAuthEnabled is true (see router.go). It upserts a
// test user under provider="test" and issues a real session. Never mount
// this in production — it bypasses OAuth verification entirely.
func (h *Handlers) TestLogin(w http.ResponseWriter, r *http.Request) {
	var req testLoginRequest
	if r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid body")
			return
		}
	}
	email := req.Email
	if email == "" {
		email = defaultTestEmail
	}
	name := req.Name
	if name == "" {
		name = defaultTestName
	}

	ctx := r.Context()
	u, err := h.Service.Users.UpsertByOAuth(ctx, testProvider, email, email, name, "")
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "upsert failed")
		return
	}
	if req.Onboarded && u.OnboardedAt == nil {
		if err := h.Service.Users.UpdateOnboarding(ctx, u.ID, nil); err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "onboarding failed")
			return
		}
		u, err = h.Service.Users.GetByID(ctx, u.ID)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "reload failed")
			return
		}
	}
	result, err := h.Service.IssueSessionForUser(ctx, u)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "issue failed")
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
