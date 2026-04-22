package users

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/dlddu/dear-baby/backend/internal/onboarding"
)

// ErrNotFound is returned when a lookup does not match any row.
var ErrNotFound = errors.New("user not found")

// Store is a thin data-access layer over the users and oauth_accounts tables.
type Store struct {
	DB *sql.DB
}

// sqliteTimeLayout is the format SQLite emits for datetime('now').
const sqliteTimeLayout = "2006-01-02 15:04:05"

// UpsertByOAuth finds an existing user by (provider, providerUserID),
// falling back to matching by email, and otherwise creating a new user.
// It also ensures an oauth_accounts row exists linking the provider to the
// user, and an onboarding row exists for the user — all in one transaction.
func (s *Store) UpsertByOAuth(ctx context.Context, provider, providerUserID, email, name, picture string) (*User, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	var userID string
	err = tx.QueryRowContext(ctx, `
		SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?
	`, provider, providerUserID).Scan(&userID)

	switch {
	case err == nil:
		if _, err := tx.ExecContext(ctx, `
			UPDATE users SET name = ?, picture_url = ?, updated_at = datetime('now') WHERE id = ?
		`, name, picture, userID); err != nil {
			return nil, fmt.Errorf("update user: %w", err)
		}
	case errors.Is(err, sql.ErrNoRows):
		err = tx.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, email).Scan(&userID)
		if errors.Is(err, sql.ErrNoRows) {
			userID = uuid.NewString()
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO users (id, email, name, picture_url) VALUES (?, ?, ?, ?)
			`, userID, email, name, picture); err != nil {
				return nil, fmt.Errorf("insert user: %w", err)
			}
		} else if err != nil {
			return nil, fmt.Errorf("lookup by email: %w", err)
		} else {
			if _, err := tx.ExecContext(ctx, `
				UPDATE users SET name = ?, picture_url = ?, updated_at = datetime('now') WHERE id = ?
			`, name, picture, userID); err != nil {
				return nil, fmt.Errorf("update user by email: %w", err)
			}
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO oauth_accounts (provider, provider_user_id, user_id) VALUES (?, ?, ?)
		`, provider, providerUserID, userID); err != nil {
			return nil, fmt.Errorf("insert oauth_account: %w", err)
		}
	default:
		return nil, fmt.Errorf("lookup oauth: %w", err)
	}

	// Every user must have an onboarding row. INSERT OR IGNORE keeps this
	// cheap and idempotent across repeated sign-ins.
	if err := onboarding.EnsureRowTx(ctx, tx, userID); err != nil {
		return nil, err
	}

	user, err := getByIDTx(ctx, tx, userID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return user, nil
}

// GetByID returns a user by primary key.
func (s *Store) GetByID(ctx context.Context, id string) (*User, error) {
	return getByID(ctx, s.DB, id)
}

type rowScanner interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func getByID(ctx context.Context, q rowScanner, id string) (*User, error) {
	u := &User{}
	var name, picture sql.NullString
	var createdAt, updatedAt string
	err := q.QueryRowContext(ctx, `
		SELECT id, email, name, picture_url, created_at, updated_at
		FROM users WHERE id = ?
	`, id).Scan(&u.ID, &u.Email, &name, &picture, &createdAt, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("select user: %w", err)
	}
	u.Name = name.String
	u.PictureURL = picture.String
	u.CreatedAt, _ = time.Parse(sqliteTimeLayout, createdAt)
	u.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
	return u, nil
}

// ResetOnboardingByEmail clears the onboarding state for the user with the
// given email by delegating to the onboarding store. Records themselves are
// preserved — resetting is a UX-replay tool, not a data wipe. Returns
// ErrNotFound if no such user exists.
func (s *Store) ResetOnboardingByEmail(ctx context.Context, email string, onb *onboarding.Store) error {
	var userID string
	err := s.DB.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, email).Scan(&userID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("lookup by email: %w", err)
	}
	return onb.Reset(ctx, userID)
}

func getByIDTx(ctx context.Context, tx *sql.Tx, id string) (*User, error) {
	return getByID(ctx, tx, id)
}

// GetByIDTx fetches a user inside an existing transaction. Exported so the
// records package can look up the user and commit its own writes in the
// same tx.
func (s *Store) GetByIDTx(ctx context.Context, tx *sql.Tx, id string) (*User, error) {
	return getByIDTx(ctx, tx, id)
}
