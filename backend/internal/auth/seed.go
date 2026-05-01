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
// alongside the server. Empty Email or Password skip seeding, which is
// the intended behaviour in environments that have no use for the
// password sign-in path (CI without E2E, local /health smoke tests).
type TestUserSeed struct {
	Email    string
	Password string
	Name     string
}

// SeedTestUser creates the password-backed test account if it does not
// already exist, and refreshes the password hash on every boot so a
// rotated secret takes effect without manual surgery. Returns nil
// without doing any work when seed.Email or seed.Password is empty —
// the deploy has opted out of the password sign-in path.
//
// Idempotent: a returning boot finds the existing user via the
// oauth_accounts(provider="password") link, leaves the users row
// alone, and only re-upserts the bcrypt hash.
func SeedTestUser(
	ctx context.Context,
	db *sql.DB,
	usersStore *users.Store,
	passwordStore *PasswordStore,
	onboarding users.OnboardingEnsurer,
	logger *slog.Logger,
	seed TestUserSeed,
) error {
	if seed.Email == "" || seed.Password == "" {
		logger.Info("test user seed skipped",
			"reason", "TEST_USER_EMAIL or TEST_USER_PASSWORD unset")
		return nil
	}

	hash, err := HashPassword(seed.Password)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	userID, err := upsertPasswordUser(ctx, db, usersStore, onboarding, seed)
	if err != nil {
		return err
	}
	if err := passwordStore.Upsert(ctx, userID, hash); err != nil {
		return err
	}
	logger.Info("test user seeded", "email", seed.Email, "user_id", userID)
	return nil
}

// upsertPasswordUser links the seed email to a users row through an
// oauth_accounts entry under provider=password. Mirrors users.Store
// .UpsertByOAuth's "lookup-then-insert-or-update" flow but pinned to
// the password provider so a returning seed boot always finds the
// same user even if Apple/Google signed someone in with the same
// email later.
func upsertPasswordUser(
	ctx context.Context,
	db *sql.DB,
	usersStore *users.Store,
	onboarding users.OnboardingEnsurer,
	seed TestUserSeed,
) (string, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	var userID string
	err = tx.QueryRowContext(ctx, `
		SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?
	`, passwordProvider, seed.Email).Scan(&userID)

	switch {
	case err == nil:
		// Existing seed link — refresh the display name if provided.
		if seed.Name != "" {
			if _, err := tx.ExecContext(ctx, `
				UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?
			`, seed.Name, userID); err != nil {
				return "", fmt.Errorf("update user name: %w", err)
			}
		}
	case errors.Is(err, sql.ErrNoRows):
		// First-time seed (or first time this email is seeded). Match
		// by email so a manual users-row insert in dev still hooks up
		// to the password row instead of failing the UNIQUE(email)
		// constraint.
		err = tx.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, seed.Email).Scan(&userID)
		if errors.Is(err, sql.ErrNoRows) {
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
		} else if err != nil {
			return "", fmt.Errorf("lookup by email: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO oauth_accounts (provider, provider_user_id, user_id) VALUES (?, ?, ?)
		`, passwordProvider, seed.Email, userID); err != nil {
			return "", fmt.Errorf("insert oauth_account: %w", err)
		}
	default:
		return "", fmt.Errorf("lookup oauth: %w", err)
	}

	if err := onboarding.EnsureRowTx(ctx, tx, userID); err != nil {
		return "", err
	}

	// Use the existing read helper to make sure the row is fully
	// hydrated (catches cases where the insert raced with a parallel
	// boot somehow).
	if _, err := usersStore.GetByIDTx(ctx, tx, userID); err != nil {
		return "", err
	}

	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("commit: %w", err)
	}
	return userID, nil
}
