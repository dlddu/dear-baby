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

// Store is a data-access layer over the onboarding + children tables.
type Store struct {
	DB *sql.DB
}

type rowScanner interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

type rowsScanner interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
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
		v := caseKind.String
		o.CaseKind = &v
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

// ChildPhotoFinalizer is invoked once per child that submitted a
// photo_tmp_key, inside the case-submission DB transaction. Implementers
// should validate the tmp key, confirm the S3 object exists, and Copy
// it to its permanent location, returning the permanent key. The tmp
// object is reaped by the caller AFTER the transaction commits so a
// rollback never leaves the user without a way to retry — the tmp blob
// remains addressable by the same key the client already holds.
//
// Returning an error rolls back the entire submission.
type ChildPhotoFinalizer func(ctx context.Context, childID string, child *ChildInput) (finalKey string, err error)

// SaveCaseOnboarding persists a complete case-branching onboarding
// submission in a single transaction:
//
//   - INSERT one children row per submitted entry, with a server-issued id
//   - Invoke finalizer for any child carrying a photo_tmp_key, and write
//     the returned permanent key into children.photo_s3_key
//   - INSERT child_record_purposes (M:N) for every selected purpose
//   - UPDATE onboarding.case_kind + stamp onboarded_at
//
// The submission is assumed to have passed Validate(); the store does
// not re-run cross-field validation. If finalizer is nil, photo_tmp_key
// fields are ignored — useful for tests and Case A flows where photos
// aren't part of the funnel.
func (s *Store) SaveCaseOnboarding(
	ctx context.Context,
	userID string,
	sub *CaseSubmission,
	finalizer ChildPhotoFinalizer,
) ([]ChildRow, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `SELECT 1 FROM users WHERE id = ?`, userID); err != nil {
		return nil, fmt.Errorf("user lookup: %w", err)
	}

	var rowExists int
	err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE id = ?`, userID).Scan(&rowExists)
	if err != nil {
		return nil, fmt.Errorf("user lookup: %w", err)
	}
	if rowExists == 0 {
		return nil, ErrNotFound
	}

	// Defensive: ensure the onboarding row exists. UpsertByOAuth seeds
	// it, but Reset can be called on a row that pre-dates the case
	// schema and an admin tool might create rogue users without one.
	if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)`, userID); err != nil {
		return nil, fmt.Errorf("ensure onboarding: %w", err)
	}

	rows := make([]ChildRow, 0, len(sub.Children))
	for i, c := range sub.Children {
		id := uuid.NewString()
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO children (
				id, user_id, kind, display_name, gender, introduction,
				birth_date, pregnancy_weeks, due_date, sort_order
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			id, userID, string(c.Kind),
			nullableString(c.DisplayName), string(c.Gender), nullableString(c.Introduction),
			nullableString(c.BirthDate), nullableInt(c.PregnancyWeeks),
			nullableString(c.DueDate), i,
		); err != nil {
			return nil, fmt.Errorf("insert child[%d]: %w", i, err)
		}

		var photoKey *string
		if c.PhotoTmpKey != "" && finalizer != nil {
			finalKey, err := finalizer(ctx, id, &sub.Children[i])
			if err != nil {
				return nil, err
			}
			if finalKey != "" {
				if _, err := tx.ExecContext(ctx, `
					UPDATE children SET photo_s3_key = ?, updated_at = datetime('now') WHERE id = ?
				`, finalKey, id); err != nil {
					return nil, fmt.Errorf("update child photo: %w", err)
				}
				k := finalKey
				photoKey = &k
			}
		}

		for _, p := range c.Purposes {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO child_record_purposes (child_id, purpose) VALUES (?, ?)
			`, id, string(p)); err != nil {
				return nil, fmt.Errorf("insert purpose: %w", err)
			}
		}

		row := ChildRow{
			ID:        id,
			UserID:    userID,
			Kind:      c.Kind,
			Gender:    c.Gender,
			SortOrder: i,
			Purposes:  append([]RecordPurpose(nil), c.Purposes...),
		}
		if c.DisplayName != "" {
			v := c.DisplayName
			row.DisplayName = &v
		}
		if c.Introduction != "" {
			v := c.Introduction
			row.Introduction = &v
		}
		row.PhotoS3Key = photoKey
		if c.BirthDate != "" {
			v := c.BirthDate
			row.BirthDate = &v
		}
		if c.PregnancyWeeks != nil {
			w := *c.PregnancyWeeks
			row.PregnancyWeeks = &w
		}
		if c.DueDate != "" {
			v := c.DueDate
			row.DueDate = &v
		}
		rows = append(rows, row)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET case_kind = ?, onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ?
	`, string(sub.Case), userID); err != nil {
		return nil, fmt.Errorf("update onboarding: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return rows, nil
}

// ListChildren returns every child belonging to the given user, sorted
// by sort_order. Purposes are populated in a separate query. Used by
// admin tooling and the reset path's S3 cleanup.
func (s *Store) ListChildren(ctx context.Context, userID string) ([]ChildRow, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, user_id, kind, display_name, gender, introduction,
		       photo_s3_key, birth_date, pregnancy_weeks, due_date,
		       sort_order, created_at, updated_at
		FROM children
		WHERE user_id = ?
		ORDER BY sort_order
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list children: %w", err)
	}
	defer rows.Close()

	var out []ChildRow
	ids := make([]string, 0)
	for rows.Next() {
		var (
			c                                                                                ChildRow
			displayName, introduction, photoKey, birthDate, dueDate, kindStr, genderStr      string
			displayNameValid, introductionValid, photoKeyValid, birthDateValid, dueDateValid bool
			pregnancyWeeks                                                                   sql.NullInt64
			createdAt, updatedAt                                                             string
		)
		if err := rows.Scan(
			&c.ID, &c.UserID, &kindStr,
			nullableScan(&displayName, &displayNameValid),
			&genderStr,
			nullableScan(&introduction, &introductionValid),
			nullableScan(&photoKey, &photoKeyValid),
			nullableScan(&birthDate, &birthDateValid),
			&pregnancyWeeks,
			nullableScan(&dueDate, &dueDateValid),
			&c.SortOrder, &createdAt, &updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan child: %w", err)
		}
		c.Kind = ChildKind(kindStr)
		c.Gender = Gender(genderStr)
		if displayNameValid {
			c.DisplayName = &displayName
		}
		if introductionValid {
			c.Introduction = &introduction
		}
		if photoKeyValid {
			c.PhotoS3Key = &photoKey
		}
		if birthDateValid {
			c.BirthDate = &birthDate
		}
		if dueDateValid {
			c.DueDate = &dueDate
		}
		if pregnancyWeeks.Valid {
			w := int(pregnancyWeeks.Int64)
			c.PregnancyWeeks = &w
		}
		c.CreatedAt, _ = time.Parse(sqliteTimeLayout, createdAt)
		c.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
		ids = append(ids, c.ID)
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate: %w", err)
	}
	if len(out) == 0 {
		return out, nil
	}

	purposes, err := loadPurposesForChildren(ctx, s.DB, ids)
	if err != nil {
		return nil, err
	}
	for i := range out {
		out[i].Purposes = purposes[out[i].ID]
	}
	return out, nil
}

// DeleteChildrenForUser removes every children + purposes row for the
// user. Used by the reset path so that successive E2E runs re-enter
// the case-branching funnel from a clean slate.
func (s *Store) DeleteChildrenForUser(ctx context.Context, userID string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM child_record_purposes WHERE child_id IN (SELECT id FROM children WHERE user_id = ?)
	`, userID); err != nil {
		return fmt.Errorf("delete purposes: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM children WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete children: %w", err)
	}
	return tx.Commit()
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

// Reset clears all onboarding state for the given user (case state,
// children, purposes). Records themselves are preserved.
func (s *Store) Reset(ctx context.Context, userID string) error {
	if _, err := s.DB.ExecContext(ctx, `
		DELETE FROM child_record_purposes WHERE child_id IN (SELECT id FROM children WHERE user_id = ?)
	`, userID); err != nil {
		return fmt.Errorf("reset purposes: %w", err)
	}
	if _, err := s.DB.ExecContext(ctx, `DELETE FROM children WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("reset children: %w", err)
	}
	res, err := s.DB.ExecContext(ctx, `
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

// loadPurposesForChildren returns a map of childID → purposes. Single
// query with an IN clause, so callers can bulk-hydrate ListChildren
// results.
func loadPurposesForChildren(ctx context.Context, q rowsScanner, ids []string) (map[string][]RecordPurpose, error) {
	if len(ids) == 0 {
		return map[string][]RecordPurpose{}, nil
	}
	placeholders := ""
	args := make([]any, len(ids))
	for i, id := range ids {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args[i] = id
	}
	rows, err := q.QueryContext(ctx, `
		SELECT child_id, purpose FROM child_record_purposes WHERE child_id IN (`+placeholders+`)
	`, args...)
	if err != nil {
		return nil, fmt.Errorf("query purposes: %w", err)
	}
	defer rows.Close()
	out := make(map[string][]RecordPurpose, len(ids))
	for rows.Next() {
		var childID, purpose string
		if err := rows.Scan(&childID, &purpose); err != nil {
			return nil, fmt.Errorf("scan purpose: %w", err)
		}
		out[childID] = append(out[childID], RecordPurpose(purpose))
	}
	return out, rows.Err()
}

func nullableString(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func nullableInt(p *int) any {
	if p == nil {
		return nil
	}
	return *p
}

// nullableScan returns a pointer SQL can write into; we use a small
// wrapper so the verbose sql.NullString → *string conversion lives in
// one place.
func nullableScan(dst *string, valid *bool) any {
	return &nullStringTarget{dst: dst, valid: valid}
}

type nullStringTarget struct {
	dst   *string
	valid *bool
}

func (t *nullStringTarget) Scan(value any) error {
	if value == nil {
		*t.valid = false
		*t.dst = ""
		return nil
	}
	switch v := value.(type) {
	case string:
		*t.dst = v
	case []byte:
		*t.dst = string(v)
	default:
		return fmt.Errorf("nullStringTarget: unexpected type %T", value)
	}
	*t.valid = true
	return nil
}
