package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

// ErrPasswordInvalid is returned when no user matches the given email
// or the supplied password fails to verify against the stored hash.
// Both cases share the same error so callers can return a single
// "invalid credentials" status without leaking whether an account
// exists.
var ErrPasswordInvalid = errors.New("invalid credentials")

// PasswordStore wraps the password_credentials table.
type PasswordStore struct {
	DB *sql.DB
}

// Upsert stores (or replaces) the bcrypt hash for the given user. The
// caller is expected to have already created the users row.
func (s *PasswordStore) Upsert(ctx context.Context, userID, passwordHash string) error {
	if _, err := s.DB.ExecContext(ctx, `
		INSERT INTO password_credentials (user_id, password_hash)
		VALUES (?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
		  password_hash = excluded.password_hash,
		  updated_at    = datetime('now')
	`, userID, passwordHash); err != nil {
		return fmt.Errorf("upsert password: %w", err)
	}
	return nil
}

// Verify looks up the bcrypt hash for the given user and compares it
// to the provided plaintext password. Returns ErrPasswordInvalid for
// any mismatch — including the no-row case — so the caller surfaces a
// uniform error to the client.
func (s *PasswordStore) Verify(ctx context.Context, userID, password string) error {
	var hash string
	err := s.DB.QueryRowContext(ctx, `
		SELECT password_hash FROM password_credentials WHERE user_id = ?
	`, userID).Scan(&hash)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrPasswordInvalid
	}
	if err != nil {
		return fmt.Errorf("select password: %w", err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return ErrPasswordInvalid
	}
	return nil
}

// HashPassword runs bcrypt at the default cost. Exposed so the boot-
// time seeder can hash the configured plaintext once and reuse the
// store's Upsert path.
func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("bcrypt: %w", err)
	}
	return string(b), nil
}
