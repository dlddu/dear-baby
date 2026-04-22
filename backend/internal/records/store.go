package records

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/dlddu/dear-baby/backend/internal/users"
)

// sqliteTimeLayout mirrors users.store — SQLite datetime('now') format.
const sqliteTimeLayout = "2006-01-02 15:04:05"

// Store is a thin data-access layer over the records table. It composes
// with users.Store for the "stamp first_record_at on first insert" behavior
// that drives the Stage 2 AI-preview unblur.
type Store struct {
	DB *sql.DB
}

// CreateResult is the outcome of CreateText. WasFirst is true when this
// INSERT flipped onboarding.first_record_at from null to non-null, i.e.
// the user has just completed their first record. Callers use it to
// decide whether side effects like AI-preview enqueue should fire — today
// that decision has moved to the client (the home screen observes the
// field transition), but the flag is preserved for server-side reasoning
// and future callers.
type CreateResult struct {
	Record   *Record
	Profile  *users.Profile
	WasFirst bool
}

// CreateText inserts a text record for the given user and re-derives
// onboarding.first_record_at from the oldest existing record (including
// the one just inserted). The result: first_record_at always reflects the
// user's earliest record's created_at — even after an onboarding reset,
// where first_record_at is nulled but prior records are preserved. The
// next new record then re-stamps first_record_at to the oldest existing
// record's time rather than 'now'.
//
// Both writes happen in a single transaction. Returns the new record plus
// the updated flat profile so callers can skip a /me round-trip.
func (s *Store) CreateText(ctx context.Context, userStore *users.Store, userID, content string) (*CreateResult, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	// Verify the user exists before inserting — preserves FK integrity
	// even if the caller forgot to run auth middleware.
	if _, err := userStore.GetByIDTx(ctx, tx, userID); err != nil {
		return nil, err
	}

	// Record whether this insert is the one that flips first_record_at.
	var prevFirstRecordAt sql.NullString
	if err := tx.QueryRowContext(ctx, `
		SELECT first_record_at FROM onboarding WHERE user_id = ?
	`, userID).Scan(&prevFirstRecordAt); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("read first_record_at: %w", err)
	}

	// Defensive: lazily create the onboarding row if missing. UpsertByOAuth
	// already seeds it on sign-in; this covers legacy rows.
	if _, err := tx.ExecContext(ctx, `
		INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)
	`, userID); err != nil {
		return nil, fmt.Errorf("ensure onboarding row: %w", err)
	}

	id := uuid.NewString()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO records (id, user_id, content) VALUES (?, ?, ?)
	`, id, userID, content); err != nil {
		return nil, fmt.Errorf("insert record: %w", err)
	}

	// Re-derive first_record_at from the oldest record. Runs after the
	// INSERT above so the new row is included in the MIN.
	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET first_record_at = (SELECT MIN(created_at) FROM records WHERE user_id = ?),
		    updated_at = datetime('now')
		WHERE user_id = ?
	`, userID, userID); err != nil {
		return nil, fmt.Errorf("stamp first_record_at: %w", err)
	}

	rec := &Record{ID: id, UserID: userID, Content: content}
	var createdAt string
	if err := tx.QueryRowContext(ctx, `
		SELECT created_at FROM records WHERE id = ?
	`, id).Scan(&createdAt); err != nil {
		return nil, fmt.Errorf("fetch record: %w", err)
	}
	if t, err := time.Parse(sqliteTimeLayout, createdAt); err == nil {
		rec.CreatedAt = t
	}

	profile, err := userStore.GetProfileTx(ctx, tx, userID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return &CreateResult{
		Record:   rec,
		Profile:  profile,
		WasFirst: !prevFirstRecordAt.Valid,
	}, nil
}

// sentinel errors surfaced to handlers.
var (
	ErrInvalidContent = errors.New("invalid content")
)
