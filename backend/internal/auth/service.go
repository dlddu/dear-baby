package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/users"
)

// Service orchestrates Google/Apple sign-in, token refresh, and logout. It
// combines the OAuth verifiers, the users store, the refresh-token store,
// and the JWT issuer. Apple is optional — when AppleVerifier is nil the
// /auth/apple handler short-circuits with a 503-level error and clients
// fall back to Google.
type Service struct {
	Verifier   *GoogleVerifier
	Apple      *AppleVerifier
	Users      *users.Store
	Onboarding users.OnboardingEnsurer
	Refresh    *RefreshStore
	Issuer     *Issuer
}

// SessionResult bundles the artifacts returned by SignInWithGoogle and Refresh.
// User is the flat profile view matching GET /me so clients can hydrate
// AuthContext directly from the session response.
type SessionResult struct {
	AccessToken  string
	RefreshToken string
	User         *users.Profile
}

// SignInWithGoogle verifies a Google ID token, upserts the user, issues a
// new access/refresh pair, and persists the refresh hash.
func (s *Service) SignInWithGoogle(ctx context.Context, idToken string) (*SessionResult, error) {
	claims, err := s.Verifier.Verify(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("verify: %w", err)
	}
	u, err := s.Users.UpsertByOAuth(ctx, s.Onboarding, "google", claims.Sub, claims.Email, claims.Name, claims.Picture)
	if err != nil {
		return nil, fmt.Errorf("upsert: %w", err)
	}
	return s.issueSession(ctx, u.ID)
}

// SignInWithApple verifies an Apple identity token and upserts the user
// under provider="apple". The display name is supplied by the client
// (Apple only delivers it once, in the authorization response, never in
// the JWT), and the email may be missing on subsequent sign-ins — that's
// fine because UpsertByOAuth keys on (provider, sub) first and only falls
// back to email lookup when no oauth_accounts row matches.
func (s *Service) SignInWithApple(ctx context.Context, idToken, name string) (*SessionResult, error) {
	if s.Apple == nil {
		return nil, errors.New("apple sign-in not configured")
	}
	claims, err := s.Apple.Verify(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("verify apple: %w", err)
	}
	u, err := s.Users.UpsertByOAuth(ctx, s.Onboarding, "apple", claims.Sub, claims.Email, name, "")
	if err != nil {
		return nil, fmt.Errorf("upsert: %w", err)
	}
	return s.issueSession(ctx, u.ID)
}

// RefreshSession consumes and rotates a refresh token, returning a new pair.
func (s *Service) RefreshSession(ctx context.Context, refreshToken string) (*SessionResult, error) {
	hash := HashToken(refreshToken)
	userID, err := s.Refresh.Consume(ctx, hash)
	if err != nil {
		return nil, err
	}
	// Defense in depth: also verify the JWT signature and claim type.
	claims, err := s.Issuer.Parse(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("parse refresh: %w", err)
	}
	if err := ExpectType(claims, TypeRefresh); err != nil {
		return nil, err
	}
	if claims.UserID != userID {
		return nil, ErrRefreshInvalid
	}
	if err := s.Refresh.Revoke(ctx, hash); err != nil {
		return nil, err
	}
	return s.issueSession(ctx, userID)
}

// Logout revokes a refresh token if it exists. Always returns nil to avoid
// leaking existence.
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	hash := HashToken(refreshToken)
	_ = s.Refresh.Revoke(ctx, hash)
	return nil
}

// IssueSessionForUser mints a fresh access/refresh pair for an existing user
// without going through any OAuth verification. It is intended only for the
// test-login endpoint used by the E2E harness; production sign-in flows must
// route through SignInWithGoogle/RefreshSession.
func (s *Service) IssueSessionForUser(ctx context.Context, u *users.User) (*SessionResult, error) {
	return s.issueSession(ctx, u.ID)
}

func (s *Service) issueSession(ctx context.Context, userID string) (*SessionResult, error) {
	access, err := s.Issuer.IssueAccess(userID)
	if err != nil {
		return nil, fmt.Errorf("issue access: %w", err)
	}
	refresh, _, err := s.Issuer.IssueRefresh(userID)
	if err != nil {
		return nil, fmt.Errorf("issue refresh: %w", err)
	}
	exp := time.Now().Add(s.Issuer.RefreshTTL)
	if err := s.Refresh.Insert(ctx, userID, HashToken(refresh), exp); err != nil {
		return nil, err
	}
	p, err := s.Users.GetProfile(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("load profile: %w", err)
	}
	return &SessionResult{
		AccessToken:  access,
		RefreshToken: refresh,
		User:         p,
	}, nil
}
