package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/users"
)

// AppleCodeVerifier is the contract Service relies on for Apple sign-in.
// The production implementation is *AppleVerifier, which exchanges the
// authorization code with Apple's token endpoint. Tests can substitute
// a stub that returns canned claims without making a network call or
// needing a real ECDSA private key.
type AppleCodeVerifier interface {
	Verify(ctx context.Context, code string) (*AppleClaims, error)
}

// Service orchestrates Google sign-in, Apple sign-in, token refresh, and
// logout. It combines the verifiers, the users store, the refresh-token
// store, and the JWT issuer. Apple is optional — leaving AppleVerifier nil
// keeps the Apple endpoint disabled without affecting Google sign-in.
type Service struct {
	Verifier      *GoogleVerifier
	AppleVerifier AppleCodeVerifier
	Users         *users.Store
	Onboarding    users.OnboardingEnsurer
	Refresh       *RefreshStore
	Issuer        *Issuer
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

// AppleSignInInput carries the fields the iOS Sign in with Apple flow
// returns to the client. Code is the authorization_code that the backend
// exchanges with Apple. FullName is delivered by Apple only on the first
// sign-in (and only if the user did not opt out), so we keep it optional
// and let the caller pass empty strings.
type AppleSignInInput struct {
	Code       string
	GivenName  string
	FamilyName string
}

// SignInWithApple exchanges an Apple authorization code for an id_token,
// upserts the user under provider="apple", and returns a fresh session.
//
// Apple's identity token never includes a display name — the client is the
// only source. To preserve the name across re-installs we only overwrite
// the stored name when the client sends a non-empty GivenName/FamilyName,
// and we leave the previous value in place otherwise (handled inside
// users.Store.UpsertByOAuth via the empty-string semantics it already uses
// for Google's missing fields).
func (s *Service) SignInWithApple(ctx context.Context, in AppleSignInInput) (*SessionResult, error) {
	if s.AppleVerifier == nil {
		return nil, fmt.Errorf("apple sign-in not configured")
	}
	claims, err := s.AppleVerifier.Verify(ctx, in.Code)
	if err != nil {
		return nil, fmt.Errorf("apple verify: %w", err)
	}

	email := claims.Email
	if email == "" {
		// Apple withholds email on subsequent sign-ins. Use a stable
		// per-account placeholder so the unique-email constraint on
		// the users table never blocks the upsert. The placeholder is
		// scoped to Apple's `sub` so a returning user always lands on
		// the same row.
		email = claims.Sub + "@privaterelay.appleid.local"
	}

	name := joinName(in.GivenName, in.FamilyName)

	u, err := s.Users.UpsertByOAuth(ctx, s.Onboarding, "apple", claims.Sub, email, name, "")
	if err != nil {
		return nil, fmt.Errorf("upsert: %w", err)
	}
	return s.issueSession(ctx, u.ID)
}

func joinName(given, family string) string {
	switch {
	case given != "" && family != "":
		return given + " " + family
	case given != "":
		return given
	default:
		return family
	}
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
