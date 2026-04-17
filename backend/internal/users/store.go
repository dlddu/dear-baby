package users

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
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
// user.
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
		// Existing oauth link — update profile.
		if _, err := tx.ExecContext(ctx, `
			UPDATE users SET name = ?, picture_url = ?, updated_at = datetime('now') WHERE id = ?
		`, name, picture, userID); err != nil {
			return nil, fmt.Errorf("update user: %w", err)
		}
	case errors.Is(err, sql.ErrNoRows):
		// No oauth link — try to find a user by email, otherwise insert one.
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
	var name, picture, dueDate, onboardedAt sql.NullString
	var createdAt, updatedAt string
	err := q.QueryRowContext(ctx, `
		SELECT id, email, name, picture_url, due_date, onboarded_at, created_at, updated_at
		FROM users WHERE id = ?
	`, id).Scan(&u.ID, &u.Email, &name, &picture, &dueDate, &onboardedAt, &createdAt, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("select user: %w", err)
	}
	u.Name = name.String
	u.PictureURL = picture.String
	if dueDate.Valid {
		s := dueDate.String
		u.DueDate = &s
	}
	if onboardedAt.Valid {
		// onboarded_at is written by datetime('now'); parse with sqliteTimeLayout.
		if t, err := time.Parse(sqliteTimeLayout, onboardedAt.String); err == nil {
			u.OnboardedAt = &t
		}
	}
	u.CreatedAt, _ = time.Parse(sqliteTimeLayout, createdAt)
	u.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
	return u, nil
}

// UpdateOnboarding persists the user's due date (nullable) and marks the
// account as onboarded by stamping onboarded_at with the current time.
// Returns ErrNotFound if no row matched.
func (s *Store) UpdateOnboarding(ctx context.Context, id string, dueDate *string) error {
	var dueArg any
	if dueDate != nil {
		dueArg = *dueDate
	} else {
		dueArg = nil
	}
	res, err := s.DB.ExecContext(ctx, `
		UPDATE users
		SET due_date = ?, onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE id = ?
	`, dueArg, id)
	if err != nil {
		return fmt.Errorf("update onboarding: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ResetOnboarding clears the user's onboarding state by setting both
// onboarded_at and due_date to NULL. Used by the test-login handler so that
// successive E2E runs can re-enter the onboarding funnel with the same user.
func (s *Store) ResetOnboarding(ctx context.Context, id string) error {
	res, err := s.DB.ExecContext(ctx, `
		UPDATE users
		SET due_date = NULL, onboarded_at = NULL, updated_at = datetime('now')
		WHERE id = ?
	`, id)
	if err != nil {
		return fmt.Errorf("reset onboarding: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func getByIDTx(ctx context.Context, tx *sql.Tx, id string) (*User, error) {
	return getByID(ctx, tx, id)
}
