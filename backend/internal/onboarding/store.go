package onboarding

import (
	"context"
	"database/sql"
	"encoding/json"
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
	var updatedAt string
	err := q.QueryRowContext(ctx, `
		SELECT due_date, onboarded_at, voice_coachmark_dismissed_at, first_record_at, ai_preview, updated_at
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

// UpdateDueDateAndOnboardedAt persists the user's due date (nullable) and
// marks onboarding Stage 1 complete by stamping onboarded_at. When dueDate
// is non-null and the user has no children row yet, this also synthesizes
// a `fetuses` ordinal=1 row carrying the same due_date — that way the
// legacy `completeOnboarding(dueDate)` path produces the same backing row
// that migration 0009 synthesizes for pre-existing users, so subsequent
// `POST /records` calls can attribute the record to a real (kind, ordinal)
// pair.
func (s *Store) UpdateDueDateAndOnboardedAt(ctx context.Context, userID string, dueDate *string) error {
	if err := s.ensureRow(ctx, userID); err != nil {
		return err
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	var dueArg any
	if dueDate != nil {
		dueArg = *dueDate
	} else {
		dueArg = nil
	}
	res, err := tx.ExecContext(ctx, `
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

	if dueDate != nil {
		// Mirror migration 0009 synthesis: every user on the legacy
		// due-date path needs a real fetuses ordinal=1 row so records
		// can resolve to (fetus, 1). INSERT OR IGNORE avoids clobbering
		// Case A users who already have richer fetus data; gating on
		// "no children row exists" leaves 양육-first then due_date flows
		// alone so we don't accidentally attribute their records to a
		// phantom fetus.
		if _, err := tx.ExecContext(ctx, `
			INSERT OR IGNORE INTO fetuses (user_id, ordinal, due_date)
			SELECT ?, 1, ?
			WHERE NOT EXISTS (SELECT 1 FROM children WHERE user_id = ?)
		`, userID, *dueDate, userID); err != nil {
			return fmt.Errorf("synthesize fetus row: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
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
// funnel. Records themselves are preserved.
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

// ResetByEmail clears onboarding state for the user with the given email.
// Returns ErrNotFound if no user or onboarding row matches.
func (s *Store) ResetByEmail(ctx context.Context, email string) error {
	res, err := s.DB.ExecContext(ctx, `
		UPDATE onboarding
		SET due_date = NULL,
		    onboarded_at = NULL,
		    voice_coachmark_dismissed_at = NULL,
		    first_record_at = NULL,
		    ai_preview = NULL,
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

// UpsertCaseA atomically replaces the user's fetuses with the provided list
// and stamps onboarded_at + due_date in a single transaction. The client is
// responsible for replicating the chosen purposes to every fetus before
// calling — the server stores what it receives. Existing fetus rows for
// this user are deleted before the new rows are inserted, so the call is
// idempotent across retries.
func (s *Store) UpsertCaseA(ctx context.Context, userID string, dueDate *string, fetuses []Fetus) error {
	if err := s.ensureRow(ctx, userID); err != nil {
		return err
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	var dueArg any
	if dueDate != nil {
		dueArg = *dueDate
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET due_date = ?, onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ?
	`, dueArg, userID); err != nil {
		return fmt.Errorf("update onboarding: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM fetuses WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete fetuses: %w", err)
	}
	for i, f := range fetuses {
		purposes, err := json.Marshal(f.Purposes)
		if err != nil {
			return fmt.Errorf("marshal purposes: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO fetuses (user_id, ordinal, nickname, gender, pregnancy_week, due_date, purposes_json)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, userID, i, nullableString(f.Nickname), nullableString(f.Gender), nullableInt(f.PregnancyWeek), nullableString(f.DueDate), string(purposes)); err != nil {
			return fmt.Errorf("insert fetus %d: %w", i, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// UpsertCaseB atomically replaces the user's children + fetuses with the
// provided lists in a single transaction, copies dueDate into
// onboarding.due_date, and stamps onboarded_at. Unlike Case A·C, the
// caller provides per-child / per-fetus purposes (B2-purpose 1:1, B6
// 일괄) — the server stores what it receives.
func (s *Store) UpsertCaseB(ctx context.Context, userID string, dueDate *string, children []Child, fetuses []Fetus) error {
	if err := s.ensureRow(ctx, userID); err != nil {
		return err
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	var dueArg any
	if dueDate != nil {
		dueArg = *dueDate
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET due_date = ?, onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ?
	`, dueArg, userID); err != nil {
		return fmt.Errorf("update onboarding: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM children WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete children: %w", err)
	}
	for i, c := range children {
		purposes, err := json.Marshal(c.Purposes)
		if err != nil {
			return fmt.Errorf("marshal purposes: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO children (user_id, ordinal, name, gender, birth_date, bio, purposes_json)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, userID, i, nullableString(c.Name), nullableString(c.Gender), nullableString(c.BirthDate), nullableString(c.Bio), string(purposes)); err != nil {
			return fmt.Errorf("insert child %d: %w", i, err)
		}
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM fetuses WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete fetuses: %w", err)
	}
	for i, f := range fetuses {
		purposes, err := json.Marshal(f.Purposes)
		if err != nil {
			return fmt.Errorf("marshal purposes: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO fetuses (user_id, ordinal, nickname, gender, pregnancy_week, due_date, purposes_json)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, userID, i, nullableString(f.Nickname), nullableString(f.Gender), nullableInt(f.PregnancyWeek), nullableString(f.DueDate), string(purposes)); err != nil {
			return fmt.Errorf("insert fetus %d: %w", i, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// UpsertCaseC atomically replaces the user's children with the provided
// list and stamps onboarded_at (with due_date null since Case C has no
// pregnancy). Same purposes-replication contract as UpsertCaseA.
func (s *Store) UpsertCaseC(ctx context.Context, userID string, children []Child) error {
	if err := s.ensureRow(ctx, userID); err != nil {
		return err
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET due_date = NULL, onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ?
	`, userID); err != nil {
		return fmt.Errorf("update onboarding: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM children WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete children: %w", err)
	}
	for i, c := range children {
		purposes, err := json.Marshal(c.Purposes)
		if err != nil {
			return fmt.Errorf("marshal purposes: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO children (user_id, ordinal, name, gender, birth_date, bio, purposes_json)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, userID, i, nullableString(c.Name), nullableString(c.Gender), nullableString(c.BirthDate), nullableString(c.Bio), string(purposes)); err != nil {
			return fmt.Errorf("insert child %d: %w", i, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// ListFetuses returns all fetus rows for the user, ordered by ordinal.
func (s *Store) ListFetuses(ctx context.Context, userID string) ([]Fetus, error) {
	return listFetuses(ctx, s.DB, userID)
}

// ListChildren returns all child rows for the user, ordered by ordinal.
func (s *Store) ListChildren(ctx context.Context, userID string) ([]Child, error) {
	return listChildren(ctx, s.DB, userID)
}

func listFetuses(ctx context.Context, q rowQuerier, userID string) ([]Fetus, error) {
	rows, err := q.QueryContext(ctx, `
		SELECT ordinal, nickname, gender, pregnancy_week, due_date, purposes_json
		FROM fetuses WHERE user_id = ? ORDER BY ordinal ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("select fetuses: %w", err)
	}
	defer rows.Close()
	var out []Fetus
	for rows.Next() {
		var f Fetus
		var nickname, gender, dueDate sql.NullString
		var pregnancyWeek sql.NullInt64
		var purposesJSON string
		if err := rows.Scan(&f.Ordinal, &nickname, &gender, &pregnancyWeek, &dueDate, &purposesJSON); err != nil {
			return nil, fmt.Errorf("scan fetus: %w", err)
		}
		if nickname.Valid {
			v := nickname.String
			f.Nickname = &v
		}
		if gender.Valid {
			v := gender.String
			f.Gender = &v
		}
		if pregnancyWeek.Valid {
			v := int(pregnancyWeek.Int64)
			f.PregnancyWeek = &v
		}
		if dueDate.Valid {
			v := dueDate.String
			f.DueDate = &v
		}
		f.Purposes = parsePurposes(purposesJSON)
		out = append(out, f)
	}
	return out, rows.Err()
}

func listChildren(ctx context.Context, q rowQuerier, userID string) ([]Child, error) {
	rows, err := q.QueryContext(ctx, `
		SELECT ordinal, name, gender, birth_date, bio, purposes_json
		FROM children WHERE user_id = ? ORDER BY ordinal ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("select children: %w", err)
	}
	defer rows.Close()
	var out []Child
	for rows.Next() {
		var c Child
		var name, gender, birthDate, bio sql.NullString
		var purposesJSON string
		if err := rows.Scan(&c.Ordinal, &name, &gender, &birthDate, &bio, &purposesJSON); err != nil {
			return nil, fmt.Errorf("scan child: %w", err)
		}
		if name.Valid {
			v := name.String
			c.Name = &v
		}
		if gender.Valid {
			v := gender.String
			c.Gender = &v
		}
		if birthDate.Valid {
			v := birthDate.String
			c.BirthDate = &v
		}
		if bio.Valid {
			v := bio.String
			c.Bio = &v
		}
		c.Purposes = parsePurposes(purposesJSON)
		out = append(out, c)
	}
	return out, rows.Err()
}

type rowQuerier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

func parsePurposes(raw string) []string {
	if raw == "" {
		return []string{}
	}
	var out []string
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return []string{}
	}
	if out == nil {
		return []string{}
	}
	return out
}

func nullableString(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}

func nullableInt(i *int) any {
	if i == nil {
		return nil
	}
	return *i
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
