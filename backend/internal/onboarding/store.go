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

// ErrInvalidPayload signals a malformed CaseSubmission. Handlers map this
// to 400. Granular reasons are surfaced via the wrapped error string for
// logging; the wire response stays generic.
var ErrInvalidPayload = errors.New("invalid onboarding payload")

// sqliteTimeLayout is the format SQLite emits for datetime('now').
const sqliteTimeLayout = "2006-01-02 15:04:05"

// Store is a data-access layer over the onboarding + children tables.
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

// SaveCaseOnboarding persists a full case-branching submission in a
// single transaction:
//
//  1. INSERT children rows (one per ChildInput) and capture the new IDs.
//  2. INSERT child_record_purposes for each child.
//  3. UPDATE onboarding.case_kind + stamp onboarded_at.
//
// The handler drives the photo rename(copy + delete) step around this
// store call — it needs the child IDs to build the permanent S3 keys
// and may fail mid-rename, in which case it rolls back. To keep the
// store layer free of S3 concerns, we accept a renamePhoto callback
// that runs inside the same transaction. The callback receives the
// generated child id and the input's tmp key, and returns the final
// photo_s3_key (or empty when the input has no photo).
type renamePhotoFn func(ctx context.Context, childID string, in ChildInput) (string, error)

// SaveCaseOnboarding writes the full submission and returns the new
// children rows in submission order. Returns ErrNotFound if the user
// has no onboarding row, ErrInvalidPayload on validation failure.
func (s *Store) SaveCaseOnboarding(ctx context.Context, userID string, sub CaseSubmission, renamePhoto renamePhotoFn) ([]ChildRow, error) {
	if err := validateSubmission(sub); err != nil {
		return nil, err
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	var exists bool
	err = tx.QueryRowContext(ctx, `SELECT 1 FROM onboarding WHERE user_id = ?`, userID).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("check onboarding row: %w", err)
	}

	out := make([]ChildRow, 0, len(sub.Children))
	for i, in := range sub.Children {
		childID := uuid.NewString()
		var photoKey string
		if renamePhoto != nil {
			photoKey, err = renamePhoto(ctx, childID, in)
			if err != nil {
				return nil, err
			}
		}
		row := ChildRow{
			ID:             childID,
			UserID:         userID,
			Kind:           in.Kind,
			DisplayName:    nilIfBlank(in.DisplayName),
			Gender:         in.Gender,
			Introduction:   nilIfBlank(in.Introduction),
			PhotoS3Key:     stringPtrNonEmpty(photoKey),
			BirthDate:      in.BirthDate,
			PregnancyWeeks: in.PregnancyWeeks,
			DueDate:        in.DueDate,
			SortOrder:      i,
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO children (
				id, user_id, kind, display_name, gender, introduction,
				photo_s3_key, birth_date, pregnancy_weeks, due_date, sort_order
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, row.ID, row.UserID, string(row.Kind),
			nullableString(row.DisplayName),
			string(row.Gender),
			nullableString(row.Introduction),
			nullableString(row.PhotoS3Key),
			nullableString(row.BirthDate),
			nullableInt(row.PregnancyWeeks),
			nullableString(row.DueDate),
			row.SortOrder,
		); err != nil {
			return nil, fmt.Errorf("insert child: %w", err)
		}
		// Dedupe purposes silently — a sloppy client that sends the same
		// purpose twice should still get a clean response.
		seen := make(map[RecordPurpose]struct{}, len(in.Purposes))
		for _, p := range in.Purposes {
			if _, dup := seen[p]; dup {
				continue
			}
			seen[p] = struct{}{}
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO child_record_purposes (child_id, purpose) VALUES (?, ?)
			`, childID, string(p)); err != nil {
				return nil, fmt.Errorf("insert purpose: %w", err)
			}
		}
		out = append(out, row)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET case_kind = ?,
		    onboarded_at = COALESCE(onboarded_at, datetime('now')),
		    updated_at = datetime('now')
		WHERE user_id = ?
	`, string(sub.Case), userID); err != nil {
		return nil, fmt.Errorf("update onboarding: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return out, nil
}

// validateSubmission enforces the per-case + per-kind rules from §4.3
// of the implementation plan.
func validateSubmission(sub CaseSubmission) error {
	if !sub.Case.Valid() {
		return fmt.Errorf("%w: case", ErrInvalidPayload)
	}
	if len(sub.Children) == 0 {
		return fmt.Errorf("%w: children empty", ErrInvalidPayload)
	}
	hasFetus, hasChild := false, false
	for i, c := range sub.Children {
		if !c.Kind.Valid() {
			return fmt.Errorf("%w: children[%d].kind", ErrInvalidPayload, i)
		}
		if !c.Gender.Valid() {
			return fmt.Errorf("%w: children[%d].gender", ErrInvalidPayload, i)
		}
		if len(c.Purposes) == 0 {
			return fmt.Errorf("%w: children[%d].purposes empty", ErrInvalidPayload, i)
		}
		for j, p := range c.Purposes {
			if !p.Valid() {
				return fmt.Errorf("%w: children[%d].purposes[%d]", ErrInvalidPayload, i, j)
			}
		}
		switch c.Kind {
		case KindFetus:
			hasFetus = true
			if c.PregnancyWeeks == nil || *c.PregnancyWeeks < 1 || *c.PregnancyWeeks > 45 {
				return fmt.Errorf("%w: children[%d].pregnancy_weeks", ErrInvalidPayload, i)
			}
			if c.DueDate == nil || !isISODate(*c.DueDate) {
				return fmt.Errorf("%w: children[%d].due_date", ErrInvalidPayload, i)
			}
			if c.BirthDate != nil {
				return fmt.Errorf("%w: children[%d].birth_date forbidden for fetus", ErrInvalidPayload, i)
			}
		case KindChild:
			hasChild = true
			if c.DisplayName == nil || len(*c.DisplayName) == 0 {
				return fmt.Errorf("%w: children[%d].display_name", ErrInvalidPayload, i)
			}
			if c.BirthDate == nil || !isISODate(*c.BirthDate) {
				return fmt.Errorf("%w: children[%d].birth_date", ErrInvalidPayload, i)
			}
			if c.PregnancyWeeks != nil || c.DueDate != nil {
				return fmt.Errorf("%w: children[%d].pregnancy fields forbidden for child", ErrInvalidPayload, i)
			}
		}
	}
	switch sub.Case {
	case CaseA:
		if !hasFetus || hasChild {
			return fmt.Errorf("%w: case A requires fetus-only children", ErrInvalidPayload)
		}
	case CaseB:
		if !hasFetus || !hasChild {
			return fmt.Errorf("%w: case B requires both fetus and child", ErrInvalidPayload)
		}
	case CaseC:
		if hasFetus || !hasChild {
			return fmt.Errorf("%w: case C requires child-only children", ErrInvalidPayload)
		}
	}
	return nil
}

// isISODate is intentionally permissive — the SQL layer doesn't reject
// fictional dates like 2026-02-31, but for our purposes a YYYY-MM-DD
// shape that parses cleanly is enough; the picker enforces real dates
// on the client.
func isISODate(s string) bool {
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

func nilIfBlank(p *string) *string {
	if p == nil {
		return nil
	}
	if *p == "" {
		return nil
	}
	return p
}

func stringPtrNonEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func nullableString(p *string) any {
	if p == nil {
		return nil
	}
	return *p
}

func nullableInt(p *int) any {
	if p == nil {
		return nil
	}
	return *p
}

// GetCaseOnboarding returns the case_kind and the children rows in
// sort_order. Used by reset-onboarding for cleanup and (later) the home
// screen to render the active-child context.
func (s *Store) GetCaseOnboarding(ctx context.Context, userID string) (caseKind *Case, children []ChildRow, err error) {
	o, err := s.GetByID(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, user_id, kind, display_name, gender, introduction,
		       photo_s3_key, birth_date, pregnancy_weeks, due_date,
		       sort_order, created_at, updated_at
		FROM children WHERE user_id = ? ORDER BY sort_order ASC
	`, userID)
	if err != nil {
		return nil, nil, fmt.Errorf("select children: %w", err)
	}
	defer rows.Close()
	out := []ChildRow{}
	for rows.Next() {
		var r ChildRow
		var displayName, intro, photoKey, birthDate, dueDate sql.NullString
		var weeks sql.NullInt64
		var createdAt, updatedAt string
		if err := rows.Scan(&r.ID, &r.UserID, &r.Kind, &displayName, &r.Gender,
			&intro, &photoKey, &birthDate, &weeks, &dueDate,
			&r.SortOrder, &createdAt, &updatedAt); err != nil {
			return nil, nil, fmt.Errorf("scan child: %w", err)
		}
		if displayName.Valid {
			s := displayName.String
			r.DisplayName = &s
		}
		if intro.Valid {
			s := intro.String
			r.Introduction = &s
		}
		if photoKey.Valid {
			s := photoKey.String
			r.PhotoS3Key = &s
		}
		if birthDate.Valid {
			s := birthDate.String
			r.BirthDate = &s
		}
		if dueDate.Valid {
			s := dueDate.String
			r.DueDate = &s
		}
		if weeks.Valid {
			n := int(weeks.Int64)
			r.PregnancyWeeks = &n
		}
		r.CreatedAt, _ = time.Parse(sqliteTimeLayout, createdAt)
		r.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("iter children: %w", err)
	}
	return o.CaseKind, out, nil
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

// Reset clears all onboarding state for the given user, including the
// children rows + their record purposes. Used by the test-login handler
// + reset-onboarding tool so successive E2E runs re-enter the funnel.
// Records (the diary entries) themselves are preserved.
func (s *Store) Reset(ctx context.Context, userID string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

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
	// SQLite needs foreign keys to be enabled per-connection for the
	// child_record_purposes ON DELETE CASCADE to fire; rather than
	// depending on PRAGMA being on, drop the M:N rows explicitly first.
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM child_record_purposes
		WHERE child_id IN (SELECT id FROM children WHERE user_id = ?)
	`, userID); err != nil {
		return fmt.Errorf("delete purposes: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM children WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete children: %w", err)
	}
	return tx.Commit()
}

// ResetByEmail clears onboarding state (including children) for the
// user with the given email. Returns ErrNotFound if no user matches.
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
