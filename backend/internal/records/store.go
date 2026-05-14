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
// non-home entry points). childKind/childOrdinal identify which
// 태아/양육 아이 the record belongs to and MUST resolve to a real row in
// fetuses/children for the inserting user; otherwise the insert is
// rejected with ErrChildNotFound.
//
// In a single transaction it: (1) ensures the onboarding row exists,
// (2) verifies the (kind, ordinal) row exists for this user,
// (3) inserts the row, (4) re-derives onboarding.first_record_at from
// the oldest record. Step 4 makes first_record_at always reflect the
// earliest record's created_at — even after an onboarding reset, where
// first_record_at is nulled but prior records are preserved.
//
// Returns the new record plus the updated flat profile so callers can
// skip a /me round-trip.
func (s *Store) Create(ctx context.Context, userStore *users.Store, userID, content string, source Source, questionText *string, childKind ChildKind, childOrdinal int) (*CreateResult, error) {
	if !source.Valid() {
		return nil, fmt.Errorf("%w: source", ErrInvalidContent)
	}
	if !childKind.Valid() {
		return nil, fmt.Errorf("%w: child_kind", ErrInvalidContent)
	}
	if childOrdinal < 1 {
		return nil, fmt.Errorf("%w: child_ordinal", ErrInvalidContent)
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

	// Verify (child_kind, child_ordinal) resolves to a real entity for this
	// user. SQLite cannot polymorphically FK a single column to two parent
	// tables, so we enforce the relationship in application code instead.
	if err := childRowExistsTx(ctx, tx, userID, childKind, childOrdinal); err != nil {
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
		INSERT INTO records (id, user_id, content, source, question_text, child_kind, child_ordinal) VALUES (?, ?, ?, ?, ?, ?, ?)
	`, id, userID, content, string(source), questionArg, string(childKind), childOrdinal); err != nil {
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

	rec := &Record{
		ID:           id,
		UserID:       userID,
		Content:      content,
		Source:       source,
		QuestionText: questionText,
		ChildKind:    childKind,
		ChildOrdinal: childOrdinal,
	}
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

// childRowExistsTx returns nil if (userID, ordinal) resolves to a row in
// the table matching kind (children for ChildKindChild, fetuses for
// ChildKindFetus). Returns ErrChildNotFound otherwise — callers map that
// to 400 so the API does not leak whether a row exists for another user.
func childRowExistsTx(ctx context.Context, tx *sql.Tx, userID string, kind ChildKind, ordinal int) error {
	var table string
	switch kind {
	case ChildKindChild:
		table = "children"
	case ChildKindFetus:
		table = "fetuses"
	default:
		return fmt.Errorf("%w: child_kind", ErrInvalidContent)
	}
	var n int
	if err := tx.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM `+table+` WHERE user_id = ? AND ordinal = ?`,
		userID, ordinal,
	).Scan(&n); err != nil {
		return fmt.Errorf("check %s row: %w", table, err)
	}
	if n == 0 {
		return ErrChildNotFound
	}
	return nil
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
		SELECT id, user_id, source, content, question_text, audio_s3_key, child_kind, child_ordinal, created_at
		FROM records
		WHERE id = ? AND user_id = ?
	`, recordID, userID).Scan(&rec.ID, &rec.UserID, (*string)(&rec.Source), &rec.Content, &questionText, &audioKey, (*string)(&rec.ChildKind), &rec.ChildOrdinal, &createdAt)
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
		SELECT id, user_id, source, content, question_text, audio_s3_key, child_kind, child_ordinal, created_at
		FROM records WHERE id = ?
	`, recordID).Scan(&rec.ID, &rec.UserID, (*string)(&rec.Source), &rec.Content, &questionText, &audioKey, (*string)(&rec.ChildKind), &rec.ChildOrdinal, &createdAt); err != nil {
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
	// ErrChildNotFound signals that the (child_kind, child_ordinal) pair on
	// a record write does not resolve to an existing row in fetuses/children
	// for the inserting user. Handlers map it to 400.
	ErrChildNotFound = errors.New("child not found")
)
