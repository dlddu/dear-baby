package auth

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ErrRefreshInvalid is returned when a refresh token does not match a stored,
// un-revoked, un-expired row.
var ErrRefreshInvalid = errors.New("refresh token invalid")

// RefreshStore persists refresh tokens by their SHA-256 hash so the raw
// token is never stored in plaintext.
type RefreshStore struct {
	DB *sql.DB
}

const sqliteTimeLayout = "2006-01-02 15:04:05"

// HashToken returns the hex SHA-256 digest of a raw refresh token string.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// Insert stores a new refresh token row.
func (s *RefreshStore) Insert(ctx context.Context, userID, tokenHash string, expiresAt time.Time) error {
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
		VALUES (?, ?, ?, ?)
	`, uuid.NewString(), userID, tokenHash, expiresAt.UTC().Format(sqliteTimeLayout))
	if err != nil {
		return fmt.Errorf("insert refresh: %w", err)
	}
	return nil
}

// Consume looks up a refresh token by hash, verifies it is not expired or
// revoked, and returns the associated user id. This does not revoke the row
// — callers (e.g. the refresh handler) must call Revoke to rotate.
func (s *RefreshStore) Consume(ctx context.Context, tokenHash string) (string, error) {
	var userID, expiresAt string
	var revokedAt sql.NullString
	err := s.DB.QueryRowContext(ctx, `
		SELECT user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?
	`, tokenHash).Scan(&userID, &expiresAt, &revokedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrRefreshInvalid
	}
	if err != nil {
		return "", fmt.Errorf("select refresh: %w", err)
	}
	if revokedAt.Valid {
		return "", ErrRefreshInvalid
	}
	exp, err := time.Parse(sqliteTimeLayout, expiresAt)
	if err != nil {
		return "", fmt.Errorf("parse expires_at: %w", err)
	}
	if time.Now().After(exp) {
		return "", ErrRefreshInvalid
	}
	return userID, nil
}

// Revoke marks a refresh token row revoked. No error if the row does not
// exist — logout should be idempotent and not leak existence.
func (s *RefreshStore) Revoke(ctx context.Context, tokenHash string) error {
	_, err := s.DB.ExecContext(ctx, `
		UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL
	`, tokenHash)
	if err != nil {
		return fmt.Errorf("revoke refresh: %w", err)
	}
	return nil
}
