package onboarding

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// ErrNotFound is returned when no onboarding row matches the given user id.
var ErrNotFound = errors.New("onboarding row not found")

// sqliteTimeLayout is the format SQLite emits for datetime('now').
const sqliteTimeLayout = "2006-01-02 15:04:05"

// Store is a data-access layer over the onboarding table.
type Store struct {
	DB *sql.DB
}

type rowScanner interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// EnsureRowTx inserts an empty onboarding row for the given user if one
// does not already exist. Called from users.Store.UpsertByOAuth inside the
// same transaction so every users row has a matching onboarding row.
// Idempotent — safe to call on repeat sign-ins.
func (s *Store) EnsureRowTx(ctx context.Context, tx *sql.Tx, userID string) error {
	if _, err := tx.ExecContext(ctx, `
		INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)
	`, userID); err != nil {
		return fmt.Errorf("ensure onboarding row: %w", err)
	}
	return nil
}

// GetByID returns the onboarding row for the given user.
func (s *Store) GetByID(ctx context.Context, userID string) (*Onboarding, error) {
	return getByID(ctx, s.DB, userID)
}

// GetByIDTx returns the onboarding row inside an existing transaction.
func (s *Store) GetByIDTx(ctx context.Context, tx *sql.Tx, userID string) (*Onboarding, error) {
	return getByID(ctx, tx, userID)
}

func getByID(ctx context.Context, q rowScanner, userID string) (*Onboarding, error) {
	o := &Onboarding{UserID: userID}
	var dueDate, onboardedAt, voiceDismissedAt, firstRecordAt, aiPreview sql.NullString
	var isPregnant, hasChildren, multiplePregnancy sql.NullBool
	var updatedAt string
	err := q.QueryRowContext(ctx, `
		SELECT due_date, onboarded_at, voice_coachmark_dismissed_at, first_record_at, ai_preview,
		       is_pregnant, has_children, multiple_pregnancy, updated_at
		FROM onboarding WHERE user_id = ?
	`, userID).Scan(&dueDate, &onboardedAt, &voiceDismissedAt, &firstRecordAt, &aiPreview,
		&isPregnant, &hasChildren, &multiplePregnancy, &updatedAt)
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
	if isPregnant.Valid {
		v := isPregnant.Bool
		o.IsPregnant = &v
	}
	if hasChildren.Valid {
		v := hasChildren.Bool
		o.HasChildren = &v
	}
	if multiplePregnancy.Valid {
		v := multiplePregnancy.Bool
		o.MultiplePregnancy = &v
	}
	o.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
	return o, nil
}

// SetCase stores the two independent answers from AC-006-01 (임신 여부 / 양육
// 여부) idempotently. Each call replaces the prior values; passing nil for a
// flag preserves it. The pair acts as the routing key for Case A/B/C — the
// client decides which case it is from these flags, so the store does not
// validate combinations.
func (s *Store) SetCase(ctx context.Context, userID string, isPregnant, hasChildren *bool) error {
	if err := s.ensureRow(ctx, userID); err != nil {
		return err
	}
	res, err := s.DB.ExecContext(ctx, `
		UPDATE onboarding
		SET is_pregnant  = COALESCE(?, is_pregnant),
		    has_children = COALESCE(?, has_children),
		    updated_at   = datetime('now')
		WHERE user_id = ?
	`, nullableBool(isPregnant), nullableBool(hasChildren), userID)
	if err != nil {
		return fmt.Errorf("set case: %w", err)
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

// SetMultiplePregnancy persists the 단태(false)/다태(true) answer for Case A.
// Idempotent — the client may resubmit the same value when re-entering the
// step. Cleared by Reset.
func (s *Store) SetMultiplePregnancy(ctx context.Context, userID string, value bool) error {
	if err := s.ensureRow(ctx, userID); err != nil {
		return err
	}
	if _, err := s.DB.ExecContext(ctx, `
		UPDATE onboarding
		SET multiple_pregnancy = ?, updated_at = datetime('now')
		WHERE user_id = ?
	`, value, userID); err != nil {
		return fmt.Errorf("set multiple pregnancy: %w", err)
	}
	return nil
}

// Complete stamps onboarded_at, marking the case-branching funnel finished.
// Called from POST /onboarding/complete after the children batch has been
// persisted. Idempotent — a second call preserves the original timestamp.
func (s *Store) Complete(ctx context.Context, userID string) error {
	if _, err := s.GetByID(ctx, userID); err != nil {
		return err
	}
	if _, err := s.DB.ExecContext(ctx, `
		UPDATE onboarding
		SET onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ? AND onboarded_at IS NULL
	`, userID); err != nil {
		return fmt.Errorf("complete onboarding: %w", err)
	}
	return nil
}

func nullableBool(b *bool) any {
	if b == nil {
		return nil
	}
	return *b
}

// UpdateDueDateAndOnboardedAt persists the user's due date (nullable) and
// marks onboarding Stage 1 complete by stamping onboarded_at.
//
// Deprecated: PRD-006 케이스 분기 온보딩으로 대체됨. Per-child due dates
// 는 children.due_date 에 저장되며, complete 도 SetCase + ReplaceAll +
// Complete 시퀀스로 분리됐다. 본 메서드는 기존 테스트 호환을 위해 남아
// 있으며 신규 코드 경로에서 호출하지 않는다.
func (s *Store) UpdateDueDateAndOnboardedAt(ctx context.Context, userID string, dueDate *string) error {
	if err := s.ensureRow(ctx, userID); err != nil {
		return err
	}
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
		return fmt.Errorf("update due date: %w", err)
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

// DismissVoiceCoachmark stamps voice_coachmark_dismissed_at. Idempotent —
// a second call preserves the original timestamp. Returns ErrNotFound only
// if no onboarding row (and therefore no user) exists.
func (s *Store) DismissVoiceCoachmark(ctx context.Context, userID string) error {
	if _, err := s.GetByID(ctx, userID); err != nil {
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

// UpdateAIPreview stores the AI-edited preview text. Overwrites any prior
// value — callers (the worker) decide the semantics of retry.
func (s *Store) UpdateAIPreview(ctx context.Context, userID, preview string) error {
	if _, err := s.GetByID(ctx, userID); err != nil {
		return err
	}
	if _, err := s.DB.ExecContext(ctx, `
		UPDATE onboarding
		SET ai_preview = ?, updated_at = datetime('now')
		WHERE user_id = ?
	`, preview, userID); err != nil {
		return fmt.Errorf("update ai preview: %w", err)
	}
	return nil
}

// Reset clears all onboarding state for the given user. Used by the
// test-login handler so successive E2E runs re-enter the onboarding
// funnel. Records themselves are preserved. Children rows are not
// touched here — callers (reset-onboarding) clear them separately via
// children.Store.DeleteAll so this store's responsibility stays scoped
// to its own table.
func (s *Store) Reset(ctx context.Context, userID string) error {
	res, err := s.DB.ExecContext(ctx, `
		UPDATE onboarding
		SET due_date = NULL,
		    onboarded_at = NULL,
		    voice_coachmark_dismissed_at = NULL,
		    first_record_at = NULL,
		    ai_preview = NULL,
		    is_pregnant = NULL,
		    has_children = NULL,
		    multiple_pregnancy = NULL,
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

// ResetByEmail clears onboarding state for the user with the given email.
// Returns ErrNotFound if no user or onboarding row matches. As with Reset,
// children rows are out of scope — the reset-onboarding command wipes
// them via children.Store.DeleteAll.
func (s *Store) ResetByEmail(ctx context.Context, email string) error {
	res, err := s.DB.ExecContext(ctx, `
		UPDATE onboarding
		SET due_date = NULL,
		    onboarded_at = NULL,
		    voice_coachmark_dismissed_at = NULL,
		    first_record_at = NULL,
		    ai_preview = NULL,
		    is_pregnant = NULL,
		    has_children = NULL,
		    multiple_pregnancy = NULL,
		    updated_at = datetime('now')
		WHERE user_id = (SELECT id FROM users WHERE email = ?)
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

// PendingAIPreview is a single row returned by ListPendingAIPreviews —
// a user who has a first record but no AI preview yet, with their oldest
// record's id and content.
type PendingAIPreview struct {
	UserID   string
	RecordID string
	Content  string
}

// ListPendingAIPreviews returns users with first_record_at set but
// ai_preview still null, paired with their oldest record. Used by the
// worker's sync() on boot to recover jobs that Redis may have lost.
func (s *Store) ListPendingAIPreviews(ctx context.Context, limit int) ([]PendingAIPreview, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT o.user_id, r.id, r.content
		FROM onboarding o
		JOIN records r ON r.id = (
		    SELECT id FROM records
		    WHERE user_id = o.user_id
		    ORDER BY created_at ASC
		    LIMIT 1
		)
		WHERE o.first_record_at IS NOT NULL
		  AND o.ai_preview IS NULL
		ORDER BY o.first_record_at ASC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("list pending: %w", err)
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

// GetOldestRecord returns the id and content of the user's oldest record.
// Returns sql.ErrNoRows if the user has no records.
func (s *Store) GetOldestRecord(ctx context.Context, userID string) (recordID, content string, err error) {
	err = s.DB.QueryRowContext(ctx, `
		SELECT id, content FROM records
		WHERE user_id = ?
		ORDER BY created_at ASC
		LIMIT 1
	`, userID).Scan(&recordID, &content)
	return
}

// ensureRow inserts an empty onboarding row if missing. Used by updates
// that should succeed for any existing user — defensive, since
// UpsertByOAuth already creates the row on sign-in.
func (s *Store) ensureRow(ctx context.Context, userID string) error {
	var exists bool
	err := s.DB.QueryRowContext(ctx, `SELECT 1 FROM users WHERE id = ?`, userID).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("check user: %w", err)
	}
	if _, err := s.DB.ExecContext(ctx, `
		INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)
	`, userID); err != nil {
		return fmt.Errorf("ensure onboarding row: %w", err)
	}
	return nil
}
