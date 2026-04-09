package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/users"
)

// Service orchestrates Google sign-in, token refresh, and logout. It
// combines the Google verifier, the users store, the refresh-token store,
// and the JWT issuer.
type Service struct {
	Verifier *GoogleVerifier
	Users    *users.Store
	Refresh  *RefreshStore
	Issuer   *Issuer
}

// SessionResult bundles the artifacts returned by SignInWithGoogle and Refresh.
type SessionResult struct {
	AccessToken  string
	RefreshToken string
	User         *users.User
}

// SignInWithGoogle verifies a Google ID token, upserts the user, issues a
// new access/refresh pair, and persists the refresh hash.
func (s *Service) SignInWithGoogle(ctx context.Context, idToken string) (*SessionResult, error) {
	claims, err := s.Verifier.Verify(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("verify: %w", err)
	}
	u, err := s.Users.UpsertByOAuth(ctx, "google", claims.Sub, claims.Email, claims.Name, claims.Picture)
	if err != nil {
		return nil, fmt.Errorf("upsert: %w", err)
	}
	return s.issueSession(ctx, u)
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
	u, err := s.Users.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.issueSession(ctx, u)
}

// Logout revokes a refresh token if it exists. Always returns nil to avoid
// leaking existence.
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	hash := HashToken(refreshToken)
	_ = s.Refresh.Revoke(ctx, hash)
	return nil
}

func (s *Service) issueSession(ctx context.Context, u *users.User) (*SessionResult, error) {
	access, err := s.Issuer.IssueAccess(u.ID)
	if err != nil {
		return nil, fmt.Errorf("issue access: %w", err)
	}
	refresh, _, err := s.Issuer.IssueRefresh(u.ID)
	if err != nil {
		return nil, fmt.Errorf("issue refresh: %w", err)
	}
	exp := time.Now().Add(s.Issuer.RefreshTTL)
	if err := s.Refresh.Insert(ctx, u.ID, HashToken(refresh), exp); err != nil {
		return nil, err
	}
	return &SessionResult{
		AccessToken:  access,
		RefreshToken: refresh,
		User:         u,
	}, nil
}
