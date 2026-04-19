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

// CreateText inserts a text record for the given user and, if this is the
// user's first record, stamps users.first_record_at with the current time.
// Both writes happen in a single transaction. Returns the new record and
// the (possibly updated) user so callers can avoid an extra /me round-trip.
//
// Idempotency: a second record preserves the original first_record_at —
// COALESCE(first_record_at, datetime('now')) is a no-op once set.
func (s *Store) CreateText(ctx context.Context, userStore *users.Store, userID, content string) (*Record, *users.User, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	// Verify the user exists before inserting — preserves FK integrity even
	// if the caller forgot to run auth middleware. Returns ErrNotFound from
	// the users package so the handler can map to 404.
	if _, err := userStore.GetByIDTx(ctx, tx, userID); err != nil {
		return nil, nil, err
	}

	id := uuid.NewString()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO records (id, user_id, content) VALUES (?, ?, ?)
	`, id, userID, content); err != nil {
		return nil, nil, fmt.Errorf("insert record: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE users
		SET first_record_at = COALESCE(first_record_at, datetime('now')),
		    updated_at = datetime('now')
		WHERE id = ?
	`, userID); err != nil {
		return nil, nil, fmt.Errorf("stamp first_record_at: %w", err)
	}

	rec := &Record{ID: id, UserID: userID, Content: content}
	var createdAt string
	if err := tx.QueryRowContext(ctx, `
		SELECT created_at FROM records WHERE id = ?
	`, id).Scan(&createdAt); err != nil {
		return nil, nil, fmt.Errorf("fetch record: %w", err)
	}
	if t, err := time.Parse(sqliteTimeLayout, createdAt); err == nil {
		rec.CreatedAt = t
	}

	u, err := userStore.GetByIDTx(ctx, tx, userID)
	if err != nil {
		return nil, nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, nil, fmt.Errorf("commit: %w", err)
	}
	return rec, u, nil
}

// sentinel errors surfaced to handlers.
var (
	ErrInvalidContent = errors.New("invalid content")
)
