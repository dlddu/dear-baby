package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/users"
)

// ErrGoogleTokenInvalid and ErrAppleCodeInvalid mark genuine credential
// failures at the OAuth verification boundary. They let the HTTP layer
// answer 401 for a bad token/code while still returning 500 for
// infrastructure failures (DB writes, token signing, profile loads) that
// happen *after* verification succeeds. Without this split a broken
// dependency looks identical to a rejected credential — e.g. a corrupt
// SQLite file surfaced "insert refresh: database disk image is malformed"
// to clients as a 401 "invalid google token".
var (
	ErrGoogleTokenInvalid = errors.New("invalid google token")
	ErrAppleCodeInvalid   = errors.New("invalid apple code")
)

// AppleCodeVerifier is the contract Service relies on for Apple sign-in.
// The production implementation is *AppleVerifier, which exchanges the
// authorization code with Apple's token endpoint. Tests can substitute
// a stub that returns canned claims without making a network call or
// needing a real ECDSA private key.
type AppleCodeVerifier interface {
	Verify(ctx context.Context, code string) (*AppleClaims, error)
}

// Service orchestrates Google sign-in, Apple sign-in, password sign-in,
// token refresh, and logout. It combines the verifiers, the users
// store, the refresh-token store, and the JWT issuer. Apple is optional
// — leaving AppleVerifier nil keeps the Apple endpoint disabled without
// affecting Google sign-in. TestUser is optional too: nil disables
// password sign-in (every request returns 401), which is the seeded
// state when TEST_USER_EMAIL/TEST_USER_PASSWORD are not configured.
type Service struct {
	Verifier      *GoogleVerifier
	AppleVerifier AppleCodeVerifier
	Users         *users.Store
	Onboarding    users.OnboardingEnsurer
	Refresh       *RefreshStore
	Issuer        *Issuer
	TestUser      *TestUserCreds
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
		return nil, fmt.Errorf("%w: %w", ErrGoogleTokenInvalid, err)
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
		return nil, fmt.Errorf("%w: %w", ErrAppleCodeInvalid, err)
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

// SignInWithPassword verifies the email + password against the
// in-memory test-user credentials seeded at boot, then issues a new
// session. Returns ErrPasswordInvalid for "no test user configured",
// "wrong email", and "wrong password" alike so the endpoint cannot
// be used to enumerate accounts.
func (s *Service) SignInWithPassword(ctx context.Context, email, password string) (*SessionResult, error) {
	if s.TestUser == nil || email != s.TestUser.Email {
		return nil, ErrPasswordInvalid
	}
	if err := s.TestUser.Verify(password); err != nil {
		return nil, err
	}
	u, err := s.Users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			return nil, ErrPasswordInvalid
		}
		return nil, fmt.Errorf("lookup: %w", err)
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
	// Defense in depth: also verify the JWT signature and claim type. A
	// token that was found in the store but fails signature/type checks is
	// still an invalid refresh token (401), not a server fault — tag it so
	// the HTTP layer classifies it alongside the store's own rejections.
	claims, err := s.Issuer.Parse(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("%w: parse: %w", ErrRefreshInvalid, err)
	}
	if err := ExpectType(claims, TypeRefresh); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrRefreshInvalid, err)
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
