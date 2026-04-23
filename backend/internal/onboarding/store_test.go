package onboarding

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	_ "modernc.org/sqlite"
)

// newTestDB creates an in-memory SQLite database with the post-migration
// schema (users + onboarding + records). Mirrors the real migration
// shape; kept in sync by the up migrations.
func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	db.SetMaxOpenConns(1)
	schema := `
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  picture_url TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE onboarding (
  user_id                      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  due_date                     TEXT,
  onboarded_at                 TEXT,
  voice_coachmark_dismissed_at TEXT,
  first_record_at              TEXT,
  ai_preview                   TEXT,
  updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE records (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("schema: %v", err)
	}
	return db
}

func seedUserWithOnboarding(t *testing.T, db *sql.DB, id, email string) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES (?, ?)`, id, email); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO onboarding (user_id) VALUES (?)`, id); err != nil {
		t.Fatalf("seed onboarding: %v", err)
	}
}

func TestUpdateDueDateAndOnboardedAt_WithDueDate(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	due := "2025-09-15"
	if err := store.UpdateDueDateAndOnboardedAt(ctx, "u1", &due); err != nil {
		t.Fatalf("update: %v", err)
	}
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate == nil || *o.DueDate != "2025-09-15" {
		t.Errorf("due_date: got %v want 2025-09-15", o.DueDate)
	}
	if o.OnboardedAt == nil {
		t.Errorf("onboarded_at should be set")
	}
}

func TestUpdateDueDateAndOnboardedAt_NullDueDate(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	if err := store.UpdateDueDateAndOnboardedAt(ctx, "u1", nil); err != nil {
		t.Fatalf("update: %v", err)
	}
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate != nil {
		t.Errorf("due_date: got %v want nil", *o.DueDate)
	}
	if o.OnboardedAt == nil {
		t.Errorf("onboarded_at should be set even when due_date is null")
	}
}

func TestUpdate_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	err := store.UpdateDueDateAndOnboardedAt(context.Background(), "missing", nil)
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestResetByEmail(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	due := "2025-09-15"
	if err := store.UpdateDueDateAndOnboardedAt(ctx, "u1", &due); err != nil {
		t.Fatalf("update: %v", err)
	}
	if err := store.ResetByEmail(ctx, "a@b.com"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate != nil || o.OnboardedAt != nil {
		t.Errorf("reset should clear: got due=%v onb=%v", o.DueDate, o.OnboardedAt)
	}
}

func TestResetByEmail_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	err := store.ResetByEmail(context.Background(), "missing@example.com")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestDismissVoiceCoachmark(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	if err := store.DismissVoiceCoachmark(ctx, "u1"); err != nil {
		t.Fatalf("dismiss: %v", err)
	}
	first, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if first.VoiceCoachmarkDismissedAt == nil {
		t.Fatal("voice_coachmark_dismissed_at should be set after first dismiss")
	}
	stamped := *first.VoiceCoachmarkDismissedAt

	if err := store.DismissVoiceCoachmark(ctx, "u1"); err != nil {
		t.Fatalf("second dismiss: %v", err)
	}
	second, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if second.VoiceCoachmarkDismissedAt == nil ||
		!second.VoiceCoachmarkDismissedAt.Equal(stamped) {
		t.Errorf("timestamp changed on second dismiss: got %v want %v",
			second.VoiceCoachmarkDismissedAt, stamped)
	}
}

func TestDismissVoiceCoachmark_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	err := store.DismissVoiceCoachmark(context.Background(), "missing")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestReset_ClearsAllFields(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	if err := store.DismissVoiceCoachmark(ctx, "u1"); err != nil {
		t.Fatalf("dismiss: %v", err)
	}
	if err := store.UpdateAIPreview(ctx, "u1", "preview text"); err != nil {
		t.Fatalf("update preview: %v", err)
	}
	if err := store.Reset(ctx, "u1"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.VoiceCoachmarkDismissedAt != nil ||
		o.AIPreview != nil ||
		o.OnboardedAt != nil ||
		o.DueDate != nil ||
		o.FirstRecordAt != nil {
		t.Errorf("reset should clear all onboarding fields: got %+v", o)
	}
}

func TestReset_PreservesRecords(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	if _, err := db.Exec(`INSERT INTO records (id, user_id, content) VALUES ('r1', 'u1', 'hello')`); err != nil {
		t.Fatalf("seed record: %v", err)
	}
	if _, err := db.Exec(`UPDATE onboarding SET first_record_at = datetime('now') WHERE user_id = ?`, "u1"); err != nil {
		t.Fatalf("seed first_record_at: %v", err)
	}

	store := &Store{DB: db}
	if err := store.Reset(context.Background(), "u1"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM records WHERE user_id = ?`, "u1").Scan(&n); err != nil {
		t.Fatalf("count records: %v", err)
	}
	if n != 1 {
		t.Errorf("records should be preserved on reset, got %d want 1", n)
	}
}

func TestListPendingAIPreviews(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")
	seedUserWithOnboarding(t, db, "u2", "c@d.com")

	// u1 has first record + pending preview.
	if _, err := db.Exec(`INSERT INTO records (id, user_id, content) VALUES ('r1', 'u1', 'hello')`); err != nil {
		t.Fatalf("seed r1: %v", err)
	}
	if _, err := db.Exec(`UPDATE onboarding SET first_record_at = datetime('now') WHERE user_id = 'u1'`); err != nil {
		t.Fatalf("stamp fr u1: %v", err)
	}

	// u2 has first record + preview already generated — excluded.
	if _, err := db.Exec(`INSERT INTO records (id, user_id, content) VALUES ('r2', 'u2', 'world')`); err != nil {
		t.Fatalf("seed r2: %v", err)
	}
	if _, err := db.Exec(`UPDATE onboarding SET first_record_at = datetime('now'), ai_preview = 'done' WHERE user_id = 'u2'`); err != nil {
		t.Fatalf("stamp u2: %v", err)
	}

	store := &Store{DB: db}
	pending, err := store.ListPendingAIPreviews(context.Background(), 10)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(pending) != 1 || pending[0].UserID != "u1" || pending[0].RecordID != "r1" {
		t.Errorf("pending: got %+v want one entry for u1/r1", pending)
	}
	if pending[0].Content != "hello" {
		t.Errorf("content: got %q want hello", pending[0].Content)
	}
}

func TestEnsureRowTx_Idempotent(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES ('u1', 'a@b.com')`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	store := &Store{DB: db}
	ctx := context.Background()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	if err := store.EnsureRowTx(ctx, tx, "u1"); err != nil {
		t.Fatalf("first ensure: %v", err)
	}
	if err := store.EnsureRowTx(ctx, tx, "u1"); err != nil {
		t.Fatalf("second ensure: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM onboarding WHERE user_id = ?`, "u1").Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 1 {
		t.Errorf("rows: got %d want 1", n)
	}
}
