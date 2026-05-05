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
		c, ok := ParseCase(caseKind.String)
		if ok {
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

// PhotoMover is the subset of storage.Client that SaveCaseOnboarding
// needs for the photo rename step. Declared as an interface so the
// onboarding package doesn't import storage directly and tests can
// inject a stub. See storage.Client for the production implementation.
type PhotoMover interface {
	BuildChildPhotoKey(userID, childID, ext string) string
	HeadObject(ctx context.Context, key string) (bool, error)
	CopyObject(ctx context.Context, srcKey, dstKey string) error
	DeleteObject(ctx context.Context, key string) error
	PhotoExtensionFromTmpKey(key string) (string, bool)
}

// CaseOnboarding is the bundle GetCaseOnboarding returns: the onboarding
// row + the child rows (already grouped by sort_order). Purposes are
// loaded into a parallel map so callers can render aiд-by-child summaries
// without an O(N) round-trip.
type CaseOnboarding struct {
	Onboarding *Onboarding
	Children   []ChildRow
	Purposes   map[string][]RecordPurpose // child_id → purposes (preserves insertion order)
}

// SaveCaseOnboarding persists a complete case-branching onboarding payload
// in a single transaction:
//
//  1. UPDATE onboarding SET case_kind, onboarded_at = now()
//  2. INSERT one children row per ChildInput (server-generated UUIDs)
//  3. For each child with a photo_tmp_key, copy the temp object to the
//     permanent key (`users/{uid}/children/{child_id}/photo.{ext}`),
//     delete the temp object, and update children.photo_s3_key
//  4. INSERT child_record_purposes rows
//
// On any failure the transaction rolls back. The S3 copy/delete is part
// of the transaction-flagged work because failure to move the photo
// must surface as 4xx/5xx — not a partially-saved row that points at a
// dangling temp key. Idempotent at the photo layer: the same input
// payload retried after a partial failure attempts the rename again
// against (presumably) the still-present temp key.
//
// Callers must validate the payload first (see handlers_case.go).
func (s *Store) SaveCaseOnboarding(ctx context.Context, mover PhotoMover, userID string, payload SubmitCasePayload) ([]ChildRow, error) {
	if err := s.ensureRow(ctx, userID); err != nil {
		return nil, err
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	// (1) onboarding row.
	res, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET case_kind = ?, onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ?
	`, string(payload.Case), userID)
	if err != nil {
		return nil, fmt.Errorf("update onboarding: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("rows affected: %w", err)
	}
	if n == 0 {
		return nil, ErrNotFound
	}

	// (2) children rows. Generate IDs upfront so we can compute photo
	// keys and refer back to them when inserting purposes.
	rows := make([]ChildRow, 0, len(payload.Children))
	for i, in := range payload.Children {
		id := uuid.NewString()
		row := ChildRow{
			ID:             id,
			UserID:         userID,
			Kind:           in.Kind,
			DisplayName:    in.DisplayName,
			Gender:         in.Gender,
			Introduction:   in.Introduction,
			BirthDate:      in.BirthDate,
			PregnancyWeeks: in.PregnancyWeeks,
			DueDate:        in.DueDate,
			SortOrder:      i,
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO children (
			  id, user_id, kind, display_name, gender, introduction,
			  birth_date, pregnancy_weeks, due_date, sort_order
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			row.ID, row.UserID, string(row.Kind), nullableString(row.DisplayName),
			string(row.Gender), nullableString(row.Introduction),
			nullableString(row.BirthDate), nullableInt(row.PregnancyWeeks),
			nullableString(row.DueDate), row.SortOrder,
		); err != nil {
			return nil, fmt.Errorf("insert child: %w", err)
		}
		rows = append(rows, row)
	}

	// (3) photos. Each tmp key is renamed to the permanent location by
	// copy + delete (S3 has no native rename). The mover is allowed to
	// be nil for tests that do not exercise the photo path.
	if mover != nil {
		for i, in := range payload.Children {
			if in.PhotoTmpKey == nil || *in.PhotoTmpKey == "" {
				continue
			}
			ext, ok := mover.PhotoExtensionFromTmpKey(*in.PhotoTmpKey)
			if !ok {
				return nil, fmt.Errorf("invalid photo tmp key: %s", *in.PhotoTmpKey)
			}
			exists, err := mover.HeadObject(ctx, *in.PhotoTmpKey)
			if err != nil {
				return nil, fmt.Errorf("head photo: %w", err)
			}
			if !exists {
				return nil, fmt.Errorf("photo not uploaded: %s", *in.PhotoTmpKey)
			}
			dst := mover.BuildChildPhotoKey(userID, rows[i].ID, ext)
			if err := mover.CopyObject(ctx, *in.PhotoTmpKey, dst); err != nil {
				return nil, fmt.Errorf("copy photo: %w", err)
			}
			if err := mover.DeleteObject(ctx, *in.PhotoTmpKey); err != nil {
				return nil, fmt.Errorf("delete photo tmp: %w", err)
			}
			if _, err := tx.ExecContext(ctx, `
				UPDATE children SET photo_s3_key = ?, updated_at = datetime('now')
				WHERE id = ?
			`, dst, rows[i].ID); err != nil {
				return nil, fmt.Errorf("update photo key: %w", err)
			}
			d := dst
			rows[i].PhotoS3Key = &d
		}
	}

	// (4) per-child purposes.
	for i, in := range payload.Children {
		for _, p := range in.Purposes {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO child_record_purposes (child_id, purpose) VALUES (?, ?)
			`, rows[i].ID, string(p)); err != nil {
				return nil, fmt.Errorf("insert purpose: %w", err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return rows, nil
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

// GetCaseOnboarding returns the onboarding row, the children sorted by
// sort_order, and the purpose map. Used by the /me-style endpoint and
// by tests to assert the full snapshot of saved state.
func (s *Store) GetCaseOnboarding(ctx context.Context, userID string) (*CaseOnboarding, error) {
	o, err := s.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, user_id, kind, display_name, gender, introduction,
		       photo_s3_key, birth_date, pregnancy_weeks, due_date,
		       sort_order, created_at, updated_at
		FROM children WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("select children: %w", err)
	}
	defer rows.Close()
	var children []ChildRow
	for rows.Next() {
		var c ChildRow
		var displayName, introduction, photoKey, birthDate, dueDate sql.NullString
		var weeks sql.NullInt64
		var createdAt, updatedAt string
		var kindStr, genderStr string
		if err := rows.Scan(&c.ID, &c.UserID, &kindStr, &displayName, &genderStr,
			&introduction, &photoKey, &birthDate, &weeks, &dueDate,
			&c.SortOrder, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("scan child: %w", err)
		}
		c.Kind = ChildKind(kindStr)
		c.Gender = Gender(genderStr)
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
		if weeks.Valid {
			w := int(weeks.Int64)
			c.PregnancyWeeks = &w
		}
		c.CreatedAt, _ = time.Parse(sqliteTimeLayout, createdAt)
		c.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
		children = append(children, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}

	purposes := make(map[string][]RecordPurpose, len(children))
	if len(children) > 0 {
		ids := make([]any, len(children))
		placeholders := make([]byte, 0, len(children)*2)
		for i, c := range children {
			ids[i] = c.ID
			if i > 0 {
				placeholders = append(placeholders, ',')
			}
			placeholders = append(placeholders, '?')
		}
		query := "SELECT child_id, purpose FROM child_record_purposes WHERE child_id IN (" + string(placeholders) + ") ORDER BY child_id, ROWID"
		prows, err := s.DB.QueryContext(ctx, query, ids...)
		if err != nil {
			return nil, fmt.Errorf("select purposes: %w", err)
		}
		defer prows.Close()
		for prows.Next() {
			var childID, purpose string
			if err := prows.Scan(&childID, &purpose); err != nil {
				return nil, fmt.Errorf("scan purpose: %w", err)
			}
			purposes[childID] = append(purposes[childID], RecordPurpose(purpose))
		}
		if err := prows.Err(); err != nil {
			return nil, fmt.Errorf("purposes rows: %w", err)
		}
	}

	return &CaseOnboarding{Onboarding: o, Children: children, Purposes: purposes}, nil
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

// Reset clears onboarding state for the given user — including all
// children, their photos (in DB, not S3), and per-child purposes. The
// caller is responsible for cleaning up S3 prefixes (see
// cmd/reset-onboarding/main.go). Records themselves are preserved.
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

	// child_record_purposes is cleared via ON DELETE CASCADE on the
	// child_id FK, so deleting children alone is enough.
	if _, err := tx.ExecContext(ctx, `DELETE FROM children WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete children: %w", err)
	}
	return tx.Commit()
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
		return fmt.Errorf("lookup user: %w", err)
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
