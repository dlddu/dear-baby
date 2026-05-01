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

// passwordProvider is the oauth_accounts provider value used for the
// seeded test user. Kept distinct from "google" / "apple" so the OAuth
// namespaces stay untouched by the password-based path.
const passwordProvider = "password"

// Handlers exposes the auth HTTP endpoints.
type Handlers struct {
	Cfg     *config.Config
	Service *Service
}

type googleSignInRequest struct {
	IDToken string `json:"id_token"`
}

// appleSignInRequest is the payload from POST /auth/apple. The iOS Sign in
// with Apple flow returns an authorization code we exchange server-side
// (see Service.SignInWithApple). given_name/family_name are only present
// on the very first sign-in — clients can omit them on subsequent calls.
type appleSignInRequest struct {
	Code       string `json:"code"`
	GivenName  string `json:"given_name"`
	FamilyName string `json:"family_name"`
}

type sessionResponse struct {
	AccessToken  string         `json:"access_token"`
	RefreshToken string         `json:"refresh_token"`
	User         *users.Profile `json:"user"`
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

// Apple handles POST /auth/apple. The body carries the authorization code
// returned by the iOS Sign in with Apple flow plus the given/family name
// fields (present on the first sign-in only). 503 means Apple sign-in is
// not configured for this deploy; 401 means the code did not validate.
func (h *Handlers) Apple(w http.ResponseWriter, r *http.Request) {
	if err := h.Cfg.RequireAppleEnv(); err != nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "apple sign-in not configured")
		return
	}
	var req appleSignInRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		httpx.WriteError(w, http.StatusBadRequest, "code required")
		return
	}
	result, err := h.Service.SignInWithApple(r.Context(), AppleSignInInput{
		Code:       req.Code,
		GivenName:  req.GivenName,
		FamilyName: req.FamilyName,
	})
	if err != nil {
		slog.Warn("apple sign-in failed", "error", err)
		httpx.WriteError(w, http.StatusUnauthorized, "invalid apple code")
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

// passwordLoginRequest is the body for POST /auth/password-login.
type passwordLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// PasswordLogin handles POST /auth/password-login. The endpoint is
// mounted unconditionally — it backs the seeded test account that
// Apple beta reviewers and the Maestro E2E flow use to enter the app.
// Access is gated by knowledge of the seeded password (which is
// distributed only to the App Store reviewer and to CI), and there is
// no signup path: the only user who can authenticate via this route
// is the one seeded at boot from TEST_USER_EMAIL/TEST_USER_PASSWORD.
func (h *Handlers) PasswordLogin(w http.ResponseWriter, r *http.Request) {
	var req passwordLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil ||
		req.Email == "" ||
		req.Password == "" {
		httpx.WriteError(w, http.StatusBadRequest, "email and password required")
		return
	}
	ctx := r.Context()
	result, err := h.Service.SignInWithPassword(ctx, req.Email, req.Password)
	if err != nil {
		// Single error code for "user not found" and "wrong password"
		// so the endpoint cannot be used to enumerate accounts.
		slog.Warn("password sign-in failed", "error", err)
		httpx.WriteError(w, http.StatusUnauthorized, "invalid credentials")
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
