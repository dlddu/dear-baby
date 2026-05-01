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

// OnboardingEnsurer inserts an empty onboarding row for a new user inside
// an existing transaction. The users package wires this up to the
// onboarding.Store so every user has a companion onboarding row without
// introducing a circular import. Never returns nil — see NoopEnsurer for
// tests that do not care about the onboarding table.
type OnboardingEnsurer interface {
	EnsureRowTx(ctx context.Context, tx *sql.Tx, userID string) error
}

// NoopEnsurer is used in tests that exercise the users package without the
// onboarding schema in scope.
type NoopEnsurer struct{}

// EnsureRowTx implements OnboardingEnsurer as a no-op.
func (NoopEnsurer) EnsureRowTx(ctx context.Context, tx *sql.Tx, userID string) error {
	return nil
}

// sqliteTimeLayout is the format SQLite emits for datetime('now').
const sqliteTimeLayout = "2006-01-02 15:04:05"

// UpsertByOAuth finds an existing user by (provider, providerUserID),
// falling back to matching by email, and otherwise creating a new user.
// For new users it also seeds an onboarding row (idempotent) so every
// users row has a companion onboarding row.
func (s *Store) UpsertByOAuth(ctx context.Context, onb OnboardingEnsurer, provider, providerUserID, email, name, picture string) (*User, error) {
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
		// Existing oauth link — update profile. Empty incoming values
		// preserve the previously stored name/picture rather than
		// clobbering them: Apple withholds the display name on every
		// sign-in after the first, so a naive overwrite would wipe it
		// out for returning Apple users.
		if _, err := tx.ExecContext(ctx, `
			UPDATE users SET
			  name        = CASE WHEN ? = '' THEN name        ELSE ? END,
			  picture_url = CASE WHEN ? = '' THEN picture_url ELSE ? END,
			  updated_at  = datetime('now')
			WHERE id = ?
		`, name, name, picture, picture, userID); err != nil {
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
			// Same empty-preserves-existing semantics as the
			// oauth-link branch above.
			if _, err := tx.ExecContext(ctx, `
				UPDATE users SET
				  name        = CASE WHEN ? = '' THEN name        ELSE ? END,
				  picture_url = CASE WHEN ? = '' THEN picture_url ELSE ? END,
				  updated_at  = datetime('now')
				WHERE id = ?
			`, name, name, picture, picture, userID); err != nil {
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

	// Ensure the onboarding row exists for this user — runs for both new
	// and returning users to heal any historical rows missing a companion.
	if err := onb.EnsureRowTx(ctx, tx, userID); err != nil {
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

// GetByEmail returns a user by their unique email. Returns ErrNotFound
// when no row matches — callers (e.g., the password sign-in path)
// should map that to a uniform "invalid credentials" response so the
// endpoint cannot be used for account enumeration.
func (s *Store) GetByEmail(ctx context.Context, email string) (*User, error) {
	u := &User{}
	var name, picture sql.NullString
	var createdAt, updatedAt string
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, email, name, picture_url, created_at, updated_at
		FROM users WHERE email = ?
	`, email).Scan(&u.ID, &u.Email, &name, &picture, &createdAt, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("select user by email: %w", err)
	}
	u.Name = name.String
	u.PictureURL = picture.String
	u.CreatedAt, _ = time.Parse(sqliteTimeLayout, createdAt)
	u.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
	return u, nil
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

// GetProfile returns the flat view merging users + onboarding. LEFT JOIN
// so a missing onboarding row still yields a Profile (with null onboarding
// fields) rather than a 404 — this mirrors the pre-move behavior where all
// fields lived on users.
func (s *Store) GetProfile(ctx context.Context, id string) (*Profile, error) {
	return getProfile(ctx, s.DB, id)
}

// GetProfileTx mirrors GetProfile inside an existing transaction — used by
// the records package to return a consistent view alongside the new record.
func (s *Store) GetProfileTx(ctx context.Context, tx *sql.Tx, id string) (*Profile, error) {
	return getProfile(ctx, tx, id)
}

func getProfile(ctx context.Context, q rowScanner, id string) (*Profile, error) {
	p := &Profile{}
	var name, picture, dueDate, onboardedAt, voiceDismissedAt, firstRecordAt, aiPreview sql.NullString
	var createdAt, updatedAt string
	err := q.QueryRowContext(ctx, `
		SELECT u.id, u.email, u.name, u.picture_url,
		       o.due_date, o.onboarded_at, o.voice_coachmark_dismissed_at,
		       o.first_record_at, o.ai_preview,
		       u.created_at, u.updated_at
		FROM users u
		LEFT JOIN onboarding o ON o.user_id = u.id
		WHERE u.id = ?
	`, id).Scan(&p.ID, &p.Email, &name, &picture,
		&dueDate, &onboardedAt, &voiceDismissedAt,
		&firstRecordAt, &aiPreview,
		&createdAt, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("select profile: %w", err)
	}
	p.Name = name.String
	p.PictureURL = picture.String
	if dueDate.Valid {
		v := dueDate.String
		p.DueDate = &v
	}
	if onboardedAt.Valid {
		if t, err := time.Parse(sqliteTimeLayout, onboardedAt.String); err == nil {
			p.OnboardedAt = &t
		}
	}
	if voiceDismissedAt.Valid {
		if t, err := time.Parse(sqliteTimeLayout, voiceDismissedAt.String); err == nil {
			p.VoiceCoachmarkDismissedAt = &t
		}
	}
	if firstRecordAt.Valid {
		if t, err := time.Parse(sqliteTimeLayout, firstRecordAt.String); err == nil {
			p.FirstRecordAt = &t
		}
	}
	if aiPreview.Valid {
		v := aiPreview.String
		p.AIPreview = &v
	}
	p.CreatedAt, _ = time.Parse(sqliteTimeLayout, createdAt)
	p.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
	return p, nil
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
