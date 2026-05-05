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

// ErrInvalidCasePayload is returned when the case-branching submission
// fails server-side validation (case mismatch, missing required fields,
// unknown enum values).
var ErrInvalidCasePayload = errors.New("invalid case onboarding payload")

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
		if c.Valid() {
			o.CaseKind = &c
		}
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
// reset-onboarding command so the user re-enters the case-branching
// funnel. Records themselves are preserved; children rows are wiped
// alongside the onboarding columns so the next pass starts clean.
func (s *Store) Reset(ctx context.Context, userID string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin reset: %w", err)
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM child_record_purposes WHERE child_id IN (SELECT id FROM children WHERE user_id = ?)`, userID); err != nil {
		return fmt.Errorf("delete purposes: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM children WHERE user_id = ?`, userID); err != nil {
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
		return fmt.Errorf("commit reset: %w", err)
	}
	return nil
}

// ResetByEmail clears onboarding state for the user with the given email.
// Returns ErrNotFound if no user or onboarding row matches.
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

// CaseSubmission is the result of a successful POST /onboarding/case —
// the persisted children rows in the order they were inserted, ready
// for the response body.
type CaseSubmission struct {
	Children []ChildRow
}

// SaveCaseOnboarding writes the case bucket + children + per-child
// purposes in a single transaction, stamps onboarded_at, and rotates
// any temporary photo S3 keys to their permanent home (callers pass an
// optional renamer that knows how to copy + delete in S3). Returns the
// inserted children with their generated IDs in submission order so
// the caller can build the response.
func (s *Store) SaveCaseOnboarding(
	ctx context.Context,
	userID string,
	req SubmitCaseRequest,
	idGen func() string,
	renamePhoto func(ctx context.Context, userID, childID, tmpKey string) (permKey string, err error),
) (*CaseSubmission, error) {
	if !req.Case.Valid() {
		return nil, fmt.Errorf("%w: case", ErrInvalidCasePayload)
	}
	if len(req.Children) == 0 {
		return nil, fmt.Errorf("%w: children empty", ErrInvalidCasePayload)
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	// Make sure the onboarding row exists; the OAuth flow seeds it but
	// we keep this defensive in case a manual user is created elsewhere.
	if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)`, userID); err != nil {
		return nil, fmt.Errorf("ensure row: %w", err)
	}

	out := &CaseSubmission{Children: make([]ChildRow, 0, len(req.Children))}
	for i, c := range req.Children {
		childID := idGen()
		row := ChildRow{
			ID:             childID,
			UserID:         userID,
			Kind:           c.Kind,
			DisplayName:    c.DisplayName,
			Gender:         c.Gender,
			Introduction:   c.Introduction,
			BirthDate:      c.BirthDate,
			PregnancyWeeks: c.PregnancyWeeks,
			DueDate:        c.DueDate,
			SortOrder:      i,
			Purposes:       append([]RecordPurpose(nil), c.Purposes...),
		}

		// Photo rename runs INSIDE the transaction so a failure rolls
		// back the children inserts. The renamer is responsible for
		// HEAD-checking the source object and either copying/deleting or
		// returning a typed error if the tmp key is missing.
		if c.PhotoTmpKey != nil && *c.PhotoTmpKey != "" {
			if renamePhoto == nil {
				return nil, fmt.Errorf("%w: photo provided without renamer", ErrInvalidCasePayload)
			}
			permKey, err := renamePhoto(ctx, userID, childID, *c.PhotoTmpKey)
			if err != nil {
				return nil, fmt.Errorf("rename photo: %w", err)
			}
			row.PhotoS3Key = &permKey
		}

		if _, err := tx.ExecContext(ctx, `
			INSERT INTO children (
				id, user_id, kind, display_name, gender, introduction,
				photo_s3_key, birth_date, pregnancy_weeks, due_date, sort_order
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			row.ID, row.UserID, string(row.Kind), nullString(row.DisplayName),
			string(row.Gender), nullString(row.Introduction),
			nullString(row.PhotoS3Key), nullString(row.BirthDate),
			nullInt(row.PregnancyWeeks), nullString(row.DueDate),
			row.SortOrder,
		); err != nil {
			return nil, fmt.Errorf("insert child: %w", err)
		}

		for _, p := range c.Purposes {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO child_record_purposes (child_id, purpose) VALUES (?, ?)
			`, childID, string(p)); err != nil {
				return nil, fmt.Errorf("insert purpose: %w", err)
			}
		}
		out.Children = append(out.Children, row)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET case_kind = ?, onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ?
	`, string(req.Case), userID); err != nil {
		return nil, fmt.Errorf("update onboarding: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return out, nil
}

// GetChildren returns all children for a user in submission order. Used
// by tests and follow-up endpoints to verify the funnel persisted what
// the client sent.
func (s *Store) GetChildren(ctx context.Context, userID string) ([]ChildRow, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, kind, display_name, gender, introduction, photo_s3_key,
		       birth_date, pregnancy_weeks, due_date, sort_order, created_at, updated_at
		FROM children
		WHERE user_id = ?
		ORDER BY sort_order ASC, created_at ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("select children: %w", err)
	}
	defer rows.Close()
	out := make([]ChildRow, 0)
	for rows.Next() {
		var c ChildRow
		c.UserID = userID
		var displayName, introduction, photoKey, birthDate, dueDate sql.NullString
		var pregnancyWeeks sql.NullInt64
		var kind, gender, createdAt, updatedAt string
		if err := rows.Scan(&c.ID, &kind, &displayName, &gender, &introduction,
			&photoKey, &birthDate, &pregnancyWeeks, &dueDate, &c.SortOrder,
			&createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("scan child: %w", err)
		}
		c.Kind = ChildKind(kind)
		c.Gender = Gender(gender)
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
		if dueDate.Valid {
			v := dueDate.String
			c.DueDate = &v
		}
		if pregnancyWeeks.Valid {
			v := int(pregnancyWeeks.Int64)
			c.PregnancyWeeks = &v
		}
		c.CreatedAt, _ = time.Parse(sqliteTimeLayout, createdAt)
		c.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate children: %w", err)
	}
	if len(out) == 0 {
		return out, nil
	}
	pRows, err := s.DB.QueryContext(ctx, `
		SELECT child_id, purpose FROM child_record_purposes
		WHERE child_id IN (SELECT id FROM children WHERE user_id = ?)
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("select purposes: %w", err)
	}
	defer pRows.Close()
	idx := make(map[string]int, len(out))
	for i, c := range out {
		idx[c.ID] = i
	}
	for pRows.Next() {
		var childID, purpose string
		if err := pRows.Scan(&childID, &purpose); err != nil {
			return nil, fmt.Errorf("scan purpose: %w", err)
		}
		i, ok := idx[childID]
		if !ok {
			continue
		}
		out[i].Purposes = append(out[i].Purposes, RecordPurpose(purpose))
	}
	return out, pRows.Err()
}

func nullString(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}

func nullInt(i *int) any {
	if i == nil {
		return nil
	}
	return *i
}
