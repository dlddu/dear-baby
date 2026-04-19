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
	var name, picture, dueDate, onboardedAt, stage2DismissedAt, firstRecordAt sql.NullString
	var createdAt, updatedAt string
	err := q.QueryRowContext(ctx, `
		SELECT id, email, name, picture_url, due_date, onboarded_at, stage2_coachmark_dismissed_at, first_record_at, created_at, updated_at
		FROM users WHERE id = ?
	`, id).Scan(&u.ID, &u.Email, &name, &picture, &dueDate, &onboardedAt, &stage2DismissedAt, &firstRecordAt, &createdAt, &updatedAt)
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
	if stage2DismissedAt.Valid {
		if t, err := time.Parse(sqliteTimeLayout, stage2DismissedAt.String); err == nil {
			u.Stage2CoachmarkDismissedAt = &t
		}
	}
	if firstRecordAt.Valid {
		if t, err := time.Parse(sqliteTimeLayout, firstRecordAt.String); err == nil {
			u.FirstRecordAt = &t
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

// DismissStage2Coachmark stamps stage2_coachmark_dismissed_at with the current
// time. Idempotent: the WHERE clause ensures a second call is a no-op so the
// original dismissal timestamp is preserved. Returns ErrNotFound if no user
// exists with the given id (but NOT if the coachmark was already dismissed —
// that is a successful no-op).
func (s *Store) DismissStage2Coachmark(ctx context.Context, id string) error {
	// Existence check first so "already dismissed" and "user missing" are
	// distinguishable even though both produce 0 rows affected.
	if _, err := getByID(ctx, s.DB, id); err != nil {
		return err
	}
	if _, err := s.DB.ExecContext(ctx, `
		UPDATE users
		SET stage2_coachmark_dismissed_at = datetime('now'), updated_at = datetime('now')
		WHERE id = ? AND stage2_coachmark_dismissed_at IS NULL
	`, id); err != nil {
		return fmt.Errorf("dismiss stage2 coachmark: %w", err)
	}
	return nil
}

// ResetOnboarding clears the user's onboarding state by setting onboarded_at,
// due_date, the Stage 2 coachmark dismissal, and first_record_at to NULL.
// Used by the test-login handler so successive E2E runs can re-enter the
// onboarding funnel with the same user. Records themselves are preserved —
// resetting is a UX-replay tool, not a data wipe. first_record_at cleared
// means the home-screen AI preview re-blurs; the next record re-stamps via
// COALESCE with the current time.
func (s *Store) ResetOnboarding(ctx context.Context, id string) error {
	res, err := s.DB.ExecContext(ctx, `
		UPDATE users
		SET due_date = NULL,
		    onboarded_at = NULL,
		    stage2_coachmark_dismissed_at = NULL,
		    first_record_at = NULL,
		    updated_at = datetime('now')
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

// ResetOnboardingByEmail clears the onboarding state for the user with the
// given email. Records are preserved — see ResetOnboarding. Returns
// ErrNotFound if no such user exists.
func (s *Store) ResetOnboardingByEmail(ctx context.Context, email string) error {
	res, err := s.DB.ExecContext(ctx, `
		UPDATE users
		SET due_date = NULL,
		    onboarded_at = NULL,
		    stage2_coachmark_dismissed_at = NULL,
		    first_record_at = NULL,
		    updated_at = datetime('now')
		WHERE email = ?
	`, email)
	if err != nil {
		return fmt.Errorf("reset onboarding by email: %w", err)
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

// GetByIDTx fetches a user inside an existing transaction. Exported so the
// records package can look up the user and commit its own writes in the
// same tx.
func (s *Store) GetByIDTx(ctx context.Context, tx *sql.Tx, id string) (*User, error) {
	return getByIDTx(ctx, tx, id)
}
