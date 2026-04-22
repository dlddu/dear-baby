package onboarding

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// ErrNotFound is returned when a lookup does not match any onboarding row.
var ErrNotFound = errors.New("onboarding not found")

// sqliteTimeLayout mirrors the SQLite datetime('now') format used across
// the other packages.
const sqliteTimeLayout = "2006-01-02 15:04:05"

// Store is a thin data-access layer over the onboarding table.
type Store struct {
	DB *sql.DB
}

type rowScanner interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Get loads the onboarding row for the given user.
func (s *Store) Get(ctx context.Context, userID string) (*Onboarding, error) {
	return getByUserID(ctx, s.DB, userID)
}

// GetTx loads the onboarding row for the given user inside an existing tx.
func (s *Store) GetTx(ctx context.Context, tx *sql.Tx, userID string) (*Onboarding, error) {
	return getByUserID(ctx, tx, userID)
}

func getByUserID(ctx context.Context, q rowScanner, userID string) (*Onboarding, error) {
	o := &Onboarding{UserID: userID}
	var dueDate, onboardedAt, voiceDismissedAt, firstRecordAt, aiPreview sql.NullString
	var updatedAt string
	err := q.QueryRowContext(ctx, `
		SELECT due_date, onboarded_at, voice_coachmark_dismissed_at,
		       first_record_at, ai_preview, updated_at
		FROM onboarding WHERE user_id = ?
	`, userID).Scan(&dueDate, &onboardedAt, &voiceDismissedAt, &firstRecordAt, &aiPreview, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("select onboarding: %w", err)
	}
	if dueDate.Valid {
		s := dueDate.String
		o.DueDate = &s
	}
	if onboardedAt.Valid {
		if t, err := time.Parse(sqliteTimeLayout, onboardedAt.String); err == nil {
			o.OnboardedAt = &t
		}
	}
	if voiceDismissedAt.Valid {
		if t, err := time.Parse(sqliteTimeLayout, voiceDismissedAt.String); err == nil {
			o.VoiceCoachmarkDismissedAt = &t
		}
	}
	if firstRecordAt.Valid {
		if t, err := time.Parse(sqliteTimeLayout, firstRecordAt.String); err == nil {
			o.FirstRecordAt = &t
		}
	}
	if aiPreview.Valid {
		s := aiPreview.String
		o.AIPreview = &s
	}
	o.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
	return o, nil
}

// EnsureRowTx inserts an empty onboarding row for the given user if one
// doesn't already exist. Called from the users upsert path so every newly
// created user has a matching onboarding row in the same transaction.
func EnsureRowTx(ctx context.Context, tx *sql.Tx, userID string) error {
	if _, err := tx.ExecContext(ctx, `
		INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)
	`, userID); err != nil {
		return fmt.Errorf("ensure onboarding row: %w", err)
	}
	return nil
}

// UpdateDueDateAndOnboardedAt persists the user's due date (nullable) and
// marks the account as onboarded by stamping onboarded_at with the current
// time. Returns ErrNotFound if no onboarding row exists.
func (s *Store) UpdateDueDateAndOnboardedAt(ctx context.Context, userID string, dueDate *string) error {
	var dueArg any
	if dueDate != nil {
		dueArg = *dueDate
	} else {
		dueArg = nil
	}
	res, err := s.DB.ExecContext(ctx, `
		UPDATE onboarding
		SET due_date = ?, onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ?
	`, dueArg, userID)
	if err != nil {
		return fmt.Errorf("update onboarding due_date: %w", err)
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

// DismissVoiceCoachmark stamps voice_coachmark_dismissed_at with the current
// time. Idempotent: the WHERE clause ensures a second call is a no-op so the
// original dismissal timestamp is preserved. Returns ErrNotFound if no
// onboarding row exists.
func (s *Store) DismissVoiceCoachmark(ctx context.Context, userID string) error {
	if _, err := getByUserID(ctx, s.DB, userID); err != nil {
		return err
	}
	if _, err := s.DB.ExecContext(ctx, `
		UPDATE onboarding
		SET voice_coachmark_dismissed_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ? AND voice_coachmark_dismissed_at IS NULL
	`, userID); err != nil {
		return fmt.Errorf("dismiss voice coachmark: %w", err)
	}
	return nil
}

// RecomputeFirstRecordAtTx re-derives onboarding.first_record_at from the
// oldest record the user has, in the given transaction. Called from the
// records create path so first_record_at always reflects the earliest
// existing record — including on re-entry after a reset where the field was
// nulled but records were preserved.
func RecomputeFirstRecordAtTx(ctx context.Context, tx *sql.Tx, userID string) error {
	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET first_record_at = (SELECT MIN(created_at) FROM records WHERE user_id = ?),
		    updated_at = datetime('now')
		WHERE user_id = ?
	`, userID, userID); err != nil {
		return fmt.Errorf("recompute first_record_at: %w", err)
	}
	return nil
}

// UpdateAIPreview overwrites the AI preview with the given text.
func (s *Store) UpdateAIPreview(ctx context.Context, userID, preview string) error {
	if _, err := getByUserID(ctx, s.DB, userID); err != nil {
		return err
	}
	if _, err := s.DB.ExecContext(ctx, `
		UPDATE onboarding
		SET ai_preview = ?, updated_at = datetime('now')
		WHERE user_id = ?
	`, preview, userID); err != nil {
		return fmt.Errorf("update ai_preview: %w", err)
	}
	return nil
}

// Reset clears the onboarding state for the given user (all nullable fields
// → NULL). Used by the test-login reset path so E2E runs can replay the
// onboarding funnel with the same user. Records themselves are preserved.
func (s *Store) Reset(ctx context.Context, userID string) error {
	res, err := s.DB.ExecContext(ctx, `
		UPDATE onboarding
		SET due_date = NULL,
		    onboarded_at = NULL,
		    voice_coachmark_dismissed_at = NULL,
		    first_record_at = NULL,
		    ai_preview = NULL,
		    updated_at = datetime('now')
		WHERE user_id = ?
	`, userID)
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

// PendingAIPreview describes a user awaiting their first AI preview.
type PendingAIPreview struct {
	UserID   string
	RecordID string
	Content  string
}

// ListPendingAIPreviews returns all users whose first_record_at is set but
// ai_preview is still NULL, each paired with their oldest record. Used by
// the worker's boot-time sync to self-heal missing AI previews after Redis
// loses the queue.
func (s *Store) ListPendingAIPreviews(ctx context.Context, limit int) ([]PendingAIPreview, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT o.user_id, r.id, r.content
		FROM onboarding o
		JOIN records r ON r.id = (
			SELECT id FROM records WHERE user_id = o.user_id
			ORDER BY created_at ASC LIMIT 1
		)
		WHERE o.first_record_at IS NOT NULL AND o.ai_preview IS NULL
		ORDER BY o.first_record_at ASC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("list pending ai previews: %w", err)
	}
	defer rows.Close()
	var out []PendingAIPreview
	for rows.Next() {
		var p PendingAIPreview
		if err := rows.Scan(&p.UserID, &p.RecordID, &p.Content); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// OldestRecord returns the first record for the user (oldest by created_at).
// Used by the AI-preview endpoint to fetch the content that must be edited.
type OldestRecord struct {
	ID      string
	Content string
}

// GetOldestRecord returns the user's earliest record if one exists.
func (s *Store) GetOldestRecord(ctx context.Context, userID string) (*OldestRecord, error) {
	r := &OldestRecord{}
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, content FROM records WHERE user_id = ?
		ORDER BY created_at ASC LIMIT 1
	`, userID).Scan(&r.ID, &r.Content)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("select oldest record: %w", err)
	}
	return r, nil
}
