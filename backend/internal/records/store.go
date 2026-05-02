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

// CreateResult is the outcome of Create. WasFirst is true when this
// INSERT flipped onboarding.first_record_at from null to non-null, i.e.
// the user has just completed their first record. Callers use it to
// decide whether side effects like AI-preview enqueue should fire — today
// that decision has moved to the client (the home screen observes the
// field transition), but the flag is preserved for server-side reasoning
// and future callers.
type CreateResult struct {
	Record   *Record
	Profile  *users.Profile
	WasFirst bool
}

// ErrNotFound is returned when a record lookup misses or PATCH targets a
// row owned by another user. We collapse "not found" and "not yours" so
// the API never leaks the existence of a record across users.
var ErrNotFound = errors.New("record not found")

// ErrAudioAlreadyAttached is returned by AttachAudio when the row already
// has a non-null audio_s3_key. It maps to HTTP 409 in the handler. This
// guards against two devices racing PATCH calls — the first one wins,
// the second cleans up its local copy.
var ErrAudioAlreadyAttached = errors.New("audio already attached")

// Create inserts a record (text or voice) for the given user. For voice
// records, audio_s3_key starts as null; the device attaches the audio
// later via PATCH /records/{id}. questionText is optional — pass nil
// when the caller has no question to associate (e.g. legacy paths or
// non-home entry points).
//
// In a single transaction it: (1) ensures the onboarding row exists,
// (2) inserts the row, (3) re-derives onboarding.first_record_at from
// the oldest record. Step 3 makes first_record_at always reflect the
// earliest record's created_at — even after an onboarding reset, where
// first_record_at is nulled but prior records are preserved.
//
// Returns the new record plus the updated flat profile so callers can
// skip a /me round-trip.
func (s *Store) Create(ctx context.Context, userStore *users.Store, userID, content string, source Source, questionText *string) (*CreateResult, error) {
	if !source.Valid() {
		return nil, fmt.Errorf("%w: source", ErrInvalidContent)
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	// Verify the user exists before inserting — preserves FK integrity
	// even if the caller forgot to run auth middleware.
	if _, err := userStore.GetByIDTx(ctx, tx, userID); err != nil {
		return nil, err
	}

	// Record whether this insert is the one that flips first_record_at.
	var prevFirstRecordAt sql.NullString
	if err := tx.QueryRowContext(ctx, `
		SELECT first_record_at FROM onboarding WHERE user_id = ?
	`, userID).Scan(&prevFirstRecordAt); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("read first_record_at: %w", err)
	}

	// Defensive: lazily create the onboarding row if missing. UpsertByOAuth
	// already seeds it on sign-in; this covers legacy rows.
	if _, err := tx.ExecContext(ctx, `
		INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)
	`, userID); err != nil {
		return nil, fmt.Errorf("ensure onboarding row: %w", err)
	}

	id := uuid.NewString()
	var questionArg any
	if questionText != nil {
		questionArg = *questionText
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO records (id, user_id, content, source, question_text) VALUES (?, ?, ?, ?, ?)
	`, id, userID, content, string(source), questionArg); err != nil {
		return nil, fmt.Errorf("insert record: %w", err)
	}

	// Re-derive first_record_at from the oldest record. Runs after the
	// INSERT above so the new row is included in the MIN.
	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET first_record_at = (SELECT MIN(created_at) FROM records WHERE user_id = ?),
		    updated_at = datetime('now')
		WHERE user_id = ?
	`, userID, userID); err != nil {
		return nil, fmt.Errorf("stamp first_record_at: %w", err)
	}

	rec := &Record{ID: id, UserID: userID, Content: content, Source: source, QuestionText: questionText}
	var createdAt string
	if err := tx.QueryRowContext(ctx, `
		SELECT created_at FROM records WHERE id = ?
	`, id).Scan(&createdAt); err != nil {
		return nil, fmt.Errorf("fetch record: %w", err)
	}
	if t, err := time.Parse(sqliteTimeLayout, createdAt); err == nil {
		rec.CreatedAt = t
	}

	profile, err := userStore.GetProfileTx(ctx, tx, userID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return &CreateResult{
		Record:   rec,
		Profile:  profile,
		WasFirst: !prevFirstRecordAt.Valid,
	}, nil
}

// CreateText is preserved as a convenience for the legacy text-only
// callers and tests. New code paths should use Create with an explicit
// source so the intent is visible at the call site.
func (s *Store) CreateText(ctx context.Context, userStore *users.Store, userID, content string) (*CreateResult, error) {
	return s.Create(ctx, userStore, userID, content, SourceText, nil)
}

// GetByIDForUser returns the record only if it belongs to userID. The
// "for user" suffix is intentional — every audio-related write needs the
// caller's id, and folding ownership into the lookup means handlers
// can't accidentally skip the check.
func (s *Store) GetByIDForUser(ctx context.Context, userID, recordID string) (*Record, error) {
	var (
		audioKey     sql.NullString
		questionText sql.NullString
		createdAt    string
		rec          Record
	)
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, user_id, source, content, question_text, audio_s3_key, created_at
		FROM records
		WHERE id = ? AND user_id = ?
	`, recordID, userID).Scan(&rec.ID, &rec.UserID, (*string)(&rec.Source), &rec.Content, &questionText, &audioKey, &createdAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("fetch record: %w", err)
	}
	if audioKey.Valid {
		v := audioKey.String
		rec.AudioS3Key = &v
	}
	if questionText.Valid {
		v := questionText.String
		rec.QuestionText = &v
	}
	if t, err := time.Parse(sqliteTimeLayout, createdAt); err == nil {
		rec.CreatedAt = t
	}
	return &rec, nil
}

// AttachAudio sets records.audio_s3_key for a record owned by userID,
// but only if it is currently null. Concurrent PATCH calls from two
// devices both trying to attach different keys: the first wins,
// subsequent attempts get ErrAudioAlreadyAttached. The losing client
// is then expected to clean up its local audio rather than overwrite.
func (s *Store) AttachAudio(ctx context.Context, userID, recordID, audioS3Key string) (*Record, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		UPDATE records
		SET audio_s3_key = ?
		WHERE id = ? AND user_id = ? AND audio_s3_key IS NULL
	`, audioS3Key, recordID, userID)
	if err != nil {
		return nil, fmt.Errorf("update audio_s3_key: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("rows affected: %w", err)
	}
	if n == 0 {
		// Distinguish "row doesn't exist / not yours" from "row exists,
		// already attached" so the handler can return 404 vs 409.
		var exists bool
		err := tx.QueryRowContext(ctx, `
			SELECT 1 FROM records WHERE id = ? AND user_id = ?
		`, recordID, userID).Scan(&exists)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		if err != nil {
			return nil, fmt.Errorf("recheck record: %w", err)
		}
		return nil, ErrAudioAlreadyAttached
	}

	var (
		audioKey     sql.NullString
		questionText sql.NullString
		createdAt    string
		rec          Record
	)
	if err := tx.QueryRowContext(ctx, `
		SELECT id, user_id, source, content, question_text, audio_s3_key, created_at
		FROM records WHERE id = ?
	`, recordID).Scan(&rec.ID, &rec.UserID, (*string)(&rec.Source), &rec.Content, &questionText, &audioKey, &createdAt); err != nil {
		return nil, fmt.Errorf("fetch record: %w", err)
	}
	if audioKey.Valid {
		v := audioKey.String
		rec.AudioS3Key = &v
	}
	if questionText.Valid {
		v := questionText.String
		rec.QuestionText = &v
	}
	if t, err := time.Parse(sqliteTimeLayout, createdAt); err == nil {
		rec.CreatedAt = t
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return &rec, nil
}

// sentinel errors surfaced to handlers.
var (
	ErrInvalidContent = errors.New("invalid content")
)
