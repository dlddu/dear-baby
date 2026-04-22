package records

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/dlddu/dear-baby/backend/internal/onboarding"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

// sqliteTimeLayout mirrors users.store — SQLite datetime('now') format.
const sqliteTimeLayout = "2006-01-02 15:04:05"

// Store is a thin data-access layer over the records table. It composes
// with users.Store and onboarding (for the "stamp first_record_at on first
// insert" behavior that drives the Stage 2 AI-preview unblur).
type Store struct {
	DB *sql.DB
}

// CreateResult bundles the new record with the updated user and onboarding
// row, plus a flag indicating whether this call was the user's first record
// (i.e. onboarding.first_record_at transitioned from NULL to a real time).
type CreateResult struct {
	Record     *Record
	User       *users.User
	Onboarding *onboarding.Onboarding
	WasFirst   bool
}

// CreateText inserts a text record for the given user and re-derives
// onboarding.first_record_at from the oldest existing record (including the
// one just inserted). The result: first_record_at always reflects the
// user's earliest record's created_at — even after an onboarding reset,
// where first_record_at is nulled but prior records are preserved.
//
// All writes happen in a single transaction. The returned CreateResult also
// carries `WasFirst=true` iff this call was the very first record after a
// null first_record_at — the onboarding AI-preview endpoint uses this to
// decide whether to kick off the OpenRouter edit.
func (s *Store) CreateText(ctx context.Context, userStore *users.Store, userID, content string) (*CreateResult, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	// Verify the user exists before inserting — preserves FK integrity even
	// if the caller forgot to run auth middleware. Returns ErrNotFound from
	// the users package so the handler can map to 404.
	if _, err := userStore.GetByIDTx(ctx, tx, userID); err != nil {
		return nil, err
	}

	// Snapshot the previous first_record_at so we can tell the handler
	// whether this call moved it from NULL to a real value.
	var prevFirst sql.NullString
	if err := tx.QueryRowContext(ctx, `
		SELECT first_record_at FROM onboarding WHERE user_id = ?
	`, userID).Scan(&prevFirst); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("read prev first_record_at: %w", err)
	}

	id := uuid.NewString()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO records (id, user_id, content) VALUES (?, ?, ?)
	`, id, userID, content); err != nil {
		return nil, fmt.Errorf("insert record: %w", err)
	}

	// Re-derive first_record_at on the onboarding row. Runs after the
	// INSERT so the new row is included in the MIN.
	if err := onboarding.RecomputeFirstRecordAtTx(ctx, tx, userID); err != nil {
		return nil, err
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

	u, err := userStore.GetByIDTx(ctx, tx, userID)
	if err != nil {
		return nil, err
	}

	onb, err := (&onboarding.Store{}).GetTx(ctx, tx, userID)
	if err != nil && !errors.Is(err, onboarding.ErrNotFound) {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	wasFirst := !prevFirst.Valid && onb != nil && onb.FirstRecordAt != nil
	return &CreateResult{Record: rec, User: u, Onboarding: onb, WasFirst: wasFirst}, nil
}

// sentinel errors surfaced to handlers.
var (
	ErrInvalidContent = errors.New("invalid content")
)
