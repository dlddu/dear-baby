package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"

	"github.com/google/uuid"

	"github.com/dlddu/dear-baby/backend/internal/users"
)

// TestUserSeed describes the single password-backed account that boots
// alongside the server. Empty Email or Password skip seeding entirely
// — the password sign-in path stays mounted but every request gets
// 401, which is the intended behaviour in environments that have no
// use for the password path (local /health smoke tests, dev
// workstations).
type TestUserSeed struct {
	Email    string
	Password string
	Name     string
}

// SeedTestUser creates the password-backed test account if it does not
// already exist, hashes TEST_USER_PASSWORD, and returns the credentials
// for the auth Service to keep in memory. Returns (nil, nil) when
// seed.Email or seed.Password is empty — the deploy has opted out.
//
// The database stores only the user identity (users + onboarding
// rows). The password hash is intentionally not persisted: the env
// var is the source of truth, and computing the hash once at boot
// avoids drift on secret rotation (rotate the secret → restart the
// pod → new hash takes effect, no DB surgery needed).
//
// Idempotent: a returning boot finds the existing user by email and
// leaves the row alone (or refreshes the display name).
func SeedTestUser(
	ctx context.Context,
	db *sql.DB,
	onboarding users.OnboardingEnsurer,
	logger *slog.Logger,
	seed TestUserSeed,
) (*TestUserCreds, error) {
	if seed.Email == "" || seed.Password == "" {
		logger.Info("test user seed skipped",
			"reason", "TEST_USER_EMAIL or TEST_USER_PASSWORD unset")
		return nil, nil
	}

	hash, err := hashPassword(seed.Password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	userID, err := upsertTestUser(ctx, db, onboarding, seed)
	if err != nil {
		return nil, err
	}
	logger.Info("test user seeded", "email", seed.Email, "user_id", userID)
	return &TestUserCreds{Email: seed.Email, Hash: hash}, nil
}

// upsertTestUser ensures the users + onboarding rows exist for the
// configured test email. No oauth_accounts link is created — password
// sign-in keys off email alone, which keeps the table clean for the
// real OAuth providers.
func upsertTestUser(
	ctx context.Context,
	db *sql.DB,
	onboarding users.OnboardingEnsurer,
	seed TestUserSeed,
) (string, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	var userID string
	err = tx.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, seed.Email).Scan(&userID)
	switch {
	case err == nil:
		if seed.Name != "" {
			if _, err := tx.ExecContext(ctx, `
				UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?
			`, seed.Name, userID); err != nil {
				return "", fmt.Errorf("update user name: %w", err)
			}
		}
	case errors.Is(err, sql.ErrNoRows):
		userID = uuid.NewString()
		name := seed.Name
		if name == "" {
			name = seed.Email
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO users (id, email, name) VALUES (?, ?, ?)
		`, userID, seed.Email, name); err != nil {
			return "", fmt.Errorf("insert user: %w", err)
		}
	default:
		return "", fmt.Errorf("lookup user: %w", err)
	}

	if err := onboarding.EnsureRowTx(ctx, tx, userID); err != nil {
		return "", err
	}

	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("commit: %w", err)
	}
	return userID, nil
}
