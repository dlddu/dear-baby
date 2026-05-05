package onboarding

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ErrNotFound is returned when no onboarding row matches the given user id.
var ErrNotFound = errors.New("onboarding row not found")

// sqliteTimeLayout is the format SQLite emits for datetime('now').
const sqliteTimeLayout = "2006-01-02 15:04:05"

// Store is a data-access layer over the onboarding-related tables
// (`onboarding`, `children`, `child_record_purposes`).
type Store struct {
	DB *sql.DB
}

type rowScanner interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// PhotoMover renames a child photo from its onboarding-tmp staging key
// to the canonical permanent key. Implementations live in the storage
// package; the store accepts an interface so it does not import the AWS
// SDK and so tests can substitute a fake. Returns the permanent key it
// just wrote (which the caller persists into children.photo_s3_key).
type PhotoMover interface {
	MoveChildPhoto(ctx context.Context, userID, childID, tmpKey string) (permKey string, err error)
}

// EnsureRowTx inserts an empty onboarding row for the given user if one
// does not already exist. Called from users.Store.UpsertByOAuth inside
// the same transaction so every users row has a matching onboarding row.
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
	var caseKind, onboardedAt, voiceDismissedAt, firstRecordAt, aiPreview sql.NullString
	var updatedAt string
	err := q.QueryRowContext(ctx, `
		SELECT case_kind, onboarded_at, voice_coachmark_dismissed_at, first_record_at, ai_preview, updated_at
		FROM onboarding WHERE user_id = ?
	`, userID).Scan(&caseKind, &onboardedAt, &voiceDismissedAt, &firstRecordAt, &aiPreview, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("select onboarding: %w", err)
	}
	if caseKind.Valid {
		c := Case(caseKind.String)
		o.CaseKind = &c
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

// SaveCaseOnboarding persists a fully-validated CaseOnboardingInput in a
// single transaction. Steps:
//
//  1. INSERT each child (generating an id) and capture the id list.
//  2. For children whose ChildInput has a PhotoTmpKey, ask the PhotoMover
//     to copy the staged S3 object to its permanent key (built from the
//     newly-minted child id), then UPDATE children.photo_s3_key. The
//     mover is also responsible for deleting the tmp object on success.
//  3. INSERT child_record_purposes for each child × purpose pair.
//  4. UPDATE onboarding.case_kind and stamp onboarded_at.
//
// PhotoMover may be nil — only the photo step is skipped, the rest of
// the save proceeds. This lets callers without S3 credentials (CI smoke
// tests) exercise the path without losing the rest of the contract.
//
// All field-level validation (kind/case alignment, required fields,
// purpose enum) must happen before this method is called; here we only
// check what we cannot recover from at write time (purposes ≥ 1).
func (s *Store) SaveCaseOnboarding(ctx context.Context, userID string, in CaseOnboardingInput, mover PhotoMover) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	// Defensive: lazily create the onboarding row. UpsertByOAuth already
	// seeds it, but this keeps SaveCaseOnboarding usable from CLI / test
	// paths that bypass the OAuth ensurer.
	if _, err := tx.ExecContext(ctx, `
		INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)
	`, userID); err != nil {
		return fmt.Errorf("ensure onboarding row: %w", err)
	}

	type childRename struct {
		childID string
		tmpKey  string
	}
	var renames []childRename

	for i, c := range in.Children {
		if len(c.Purposes) == 0 {
			return fmt.Errorf("child %d: at least one purpose required", i)
		}
		childID := uuid.NewString()

		if _, err := tx.ExecContext(ctx, `
			INSERT INTO children (
				id, user_id, kind, display_name, gender, introduction,
				birth_date, pregnancy_weeks, due_date, sort_order
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			childID, userID, string(c.Kind),
			nullString(c.DisplayName), string(c.Gender), nullString(c.Introduction),
			nullString(c.BirthDate), nullInt(c.PregnancyWeeks), nullString(c.DueDate),
			i,
		); err != nil {
			return fmt.Errorf("insert child %d: %w", i, err)
		}

		for _, p := range c.Purposes {
			if !p.Valid() {
				return fmt.Errorf("child %d: invalid purpose %q", i, p)
			}
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO child_record_purposes (child_id, purpose) VALUES (?, ?)
			`, childID, string(p)); err != nil {
				return fmt.Errorf("insert purpose: %w", err)
			}
		}

		if c.PhotoTmpKey != nil && *c.PhotoTmpKey != "" {
			renames = append(renames, childRename{childID: childID, tmpKey: *c.PhotoTmpKey})
		}
	}

	// Photo rename runs after all DB writes inside the same transaction.
	// On any failure (S3 missing, copy error) the tx rolls back, leaving
	// no partial children state. The tmp object stays around for retry —
	// the client can resubmit with the same payload + tmp key.
	if mover != nil && len(renames) > 0 {
		for _, r := range renames {
			permKey, err := mover.MoveChildPhoto(ctx, userID, r.childID, r.tmpKey)
			if err != nil {
				return fmt.Errorf("move photo for child %s: %w", r.childID, err)
			}
			if _, err := tx.ExecContext(ctx, `
				UPDATE children SET photo_s3_key = ?, updated_at = datetime('now')
				WHERE id = ?
			`, permKey, r.childID); err != nil {
				return fmt.Errorf("set photo key for child %s: %w", r.childID, err)
			}
		}
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET case_kind = ?, onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ?
	`, string(in.Case), userID); err != nil {
		return fmt.Errorf("set case: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// ListChildren returns every child row for the user, oldest-first by
// sort_order (which records the original onboarding entry order).
func (s *Store) ListChildren(ctx context.Context, userID string) ([]Child, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, user_id, kind, display_name, gender, introduction, photo_s3_key,
		       birth_date, pregnancy_weeks, due_date, sort_order, created_at, updated_at
		FROM children WHERE user_id = ?
		ORDER BY sort_order ASC, created_at ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list children: %w", err)
	}
	defer rows.Close()

	var out []Child
	for rows.Next() {
		var c Child
		var displayName, introduction, photoKey, birthDate, dueDate sql.NullString
		var pregnancyWeeks sql.NullInt64
		var createdAt, updatedAt string
		if err := rows.Scan(&c.ID, &c.UserID, (*string)(&c.Kind),
			&displayName, (*string)(&c.Gender), &introduction, &photoKey,
			&birthDate, &pregnancyWeeks, &dueDate,
			&c.SortOrder, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("scan child: %w", err)
		}
		if displayName.Valid {
			v := displayName.String
			c.DisplayName = &v
		}
		if introduction.Valid {
			v := introduction.String
			c.Introduction = &v
		}
		if photoKey.Valid {
			v := photoKey.String
			c.PhotoS3Key = &v
		}
		if birthDate.Valid {
			v := birthDate.String
			c.BirthDate = &v
		}
		if pregnancyWeeks.Valid {
			v := int(pregnancyWeeks.Int64)
			c.PregnancyWeeks = &v
		}
		if dueDate.Valid {
			v := dueDate.String
			c.DueDate = &v
		}
		c.CreatedAt, _ = time.Parse(sqliteTimeLayout, createdAt)
		c.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}

	// Hydrate purposes per child in a single follow-up query.
	if len(out) > 0 {
		byID := make(map[string]*Child, len(out))
		ids := make([]any, 0, len(out))
		placeholders := ""
		for i := range out {
			byID[out[i].ID] = &out[i]
			ids = append(ids, out[i].ID)
			if i > 0 {
				placeholders += ","
			}
			placeholders += "?"
		}
		q := "SELECT child_id, purpose FROM child_record_purposes WHERE child_id IN (" + placeholders + ")"
		prows, err := s.DB.QueryContext(ctx, q, ids...)
		if err != nil {
			return nil, fmt.Errorf("list purposes: %w", err)
		}
		defer prows.Close()
		for prows.Next() {
			var childID, purpose string
			if err := prows.Scan(&childID, &purpose); err != nil {
				return nil, fmt.Errorf("scan purpose: %w", err)
			}
			if c, ok := byID[childID]; ok {
				c.Purposes = append(c.Purposes, RecordPurpose(purpose))
			}
		}
		if err := prows.Err(); err != nil {
			return nil, fmt.Errorf("purposes rows: %w", err)
		}
	}

	return out, nil
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

// Reset clears all onboarding state for the given user — including any
// children rows the user filled in during case-branched onboarding.
// Records themselves are preserved so manual resets don't blow away the
// diary.
func (s *Store) Reset(ctx context.Context, userID string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	// child_record_purposes cascades from children, but we delete it
	// explicitly to keep behaviour identical regardless of FK pragma
	// state in tests.
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM child_record_purposes
		WHERE child_id IN (SELECT id FROM children WHERE user_id = ?)
	`, userID); err != nil {
		return fmt.Errorf("delete purposes: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM children WHERE user_id = ?
	`, userID); err != nil {
		return fmt.Errorf("delete children: %w", err)
	}

	res, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET case_kind = NULL,
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
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// ResetByEmail clears onboarding state for the user with the given email.
// Returns ErrNotFound if no user matches.
func (s *Store) ResetByEmail(ctx context.Context, email string) error {
	var userID string
	err := s.DB.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, email).Scan(&userID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("lookup user by email: %w", err)
	}
	return s.Reset(ctx, userID)
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

func nullString(p *string) any {
	if p == nil {
		return nil
	}
	return *p
}

func nullInt(p *int) any {
	if p == nil {
		return nil
	}
	return *p
}
