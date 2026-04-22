package users

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/dlddu/dear-baby/backend/internal/onboarding"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	db.SetMaxOpenConns(1)
	schema := `
CREATE TABLE users (
  id                              TEXT PRIMARY KEY,
  email                           TEXT NOT NULL UNIQUE,
  name                            TEXT,
  picture_url                     TEXT,
  created_at                      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                      TEXT NOT NULL DEFAULT (datetime('now'))
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
CREATE TABLE oauth_accounts (
  provider         TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, provider_user_id)
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

func seedUser(t *testing.T, db *sql.DB, id, email string) {
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
	seedUser(t, db, "u1", "a@b.com")

	onb := &onboarding.Store{DB: db}
	ctx := context.Background()
	due := "2025-09-15"
	if err := onb.UpdateDueDateAndOnboardedAt(ctx, "u1", &due); err != nil {
		t.Fatalf("update: %v", err)
	}

	o, err := onb.Get(ctx, "u1")
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
	seedUser(t, db, "u1", "a@b.com")

	onb := &onboarding.Store{DB: db}
	ctx := context.Background()
	if err := onb.UpdateDueDateAndOnboardedAt(ctx, "u1", nil); err != nil {
		t.Fatalf("update: %v", err)
	}

	o, err := onb.Get(ctx, "u1")
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

func TestUpdateDueDateAndOnboardedAt_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	onb := &onboarding.Store{DB: db}
	err := onb.UpdateDueDateAndOnboardedAt(context.Background(), "missing", nil)
	if !errors.Is(err, onboarding.ErrNotFound) {
		t.Errorf("err: got %v want onboarding.ErrNotFound", err)
	}
}

func TestResetOnboardingByEmail(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	onb := &onboarding.Store{DB: db}
	ctx := context.Background()
	due := "2025-09-15"
	if err := onb.UpdateDueDateAndOnboardedAt(ctx, "u1", &due); err != nil {
		t.Fatalf("update: %v", err)
	}

	if err := store.ResetOnboardingByEmail(ctx, "a@b.com", onb); err != nil {
		t.Fatalf("reset: %v", err)
	}

	o, err := onb.Get(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate != nil {
		t.Errorf("due_date: got %v want nil", *o.DueDate)
	}
	if o.OnboardedAt != nil {
		t.Errorf("onboarded_at: got %v want nil", *o.OnboardedAt)
	}
}

func TestResetOnboardingByEmail_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	onb := &onboarding.Store{DB: db}
	err := store.ResetOnboardingByEmail(context.Background(), "missing@example.com", onb)
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestGetByID_UnonboardedUserHasNilFields(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	onb := &onboarding.Store{DB: db}
	o, err := onb.Get(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate != nil {
		t.Errorf("due_date: got %v want nil", *o.DueDate)
	}
	if o.OnboardedAt != nil {
		t.Errorf("onboarded_at: got %v want nil", *o.OnboardedAt)
	}
	if o.VoiceCoachmarkDismissedAt != nil {
		t.Errorf("voice_coachmark_dismissed_at: got %v want nil", *o.VoiceCoachmarkDismissedAt)
	}
}

func TestDismissVoiceCoachmark(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	onb := &onboarding.Store{DB: db}
	ctx := context.Background()

	if err := onb.DismissVoiceCoachmark(ctx, "u1"); err != nil {
		t.Fatalf("dismiss: %v", err)
	}
	first, err := onb.Get(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if first.VoiceCoachmarkDismissedAt == nil {
		t.Fatal("voice_coachmark_dismissed_at should be set after first dismiss")
	}
	stamped := *first.VoiceCoachmarkDismissedAt

	// Second call must be a no-op: the original timestamp is preserved.
	if err := onb.DismissVoiceCoachmark(ctx, "u1"); err != nil {
		t.Fatalf("second dismiss: %v", err)
	}
	second, err := onb.Get(ctx, "u1")
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

	onb := &onboarding.Store{DB: db}
	err := onb.DismissVoiceCoachmark(context.Background(), "missing")
	if !errors.Is(err, onboarding.ErrNotFound) {
		t.Errorf("err: got %v want onboarding.ErrNotFound", err)
	}
}

func TestReset_ClearsVoiceCoachmark(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	onb := &onboarding.Store{DB: db}
	ctx := context.Background()
	if err := onb.DismissVoiceCoachmark(ctx, "u1"); err != nil {
		t.Fatalf("dismiss: %v", err)
	}
	if err := onb.Reset(ctx, "u1"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	o, err := onb.Get(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.VoiceCoachmarkDismissedAt != nil {
		t.Errorf("coachmark should be cleared on reset, got %v",
			*o.VoiceCoachmarkDismissedAt)
	}
}

func TestReset_ClearsFirstRecordAtButPreservesRecords(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	// Seed a record + first_record_at directly to avoid depending on the
	// records package from this test.
	if _, err := db.Exec(`
		INSERT INTO records (id, user_id, content) VALUES ('r1', 'u1', 'hello');
	`); err != nil {
		t.Fatalf("seed record: %v", err)
	}
	if _, err := db.Exec(`
		UPDATE onboarding SET first_record_at = datetime('now') WHERE user_id = 'u1';
	`); err != nil {
		t.Fatalf("seed first_record_at: %v", err)
	}

	onb := &onboarding.Store{DB: db}
	ctx := context.Background()
	if err := onb.Reset(ctx, "u1"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	o, err := onb.Get(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.FirstRecordAt != nil {
		t.Errorf("first_record_at should be cleared, got %v", *o.FirstRecordAt)
	}
	// Records themselves must survive reset — the replay is a UX flow, not
	// a data wipe.
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM records WHERE user_id = ?`, "u1").Scan(&n); err != nil {
		t.Fatalf("count records: %v", err)
	}
	if n != 1 {
		t.Errorf("records should be preserved on reset, got %d want 1", n)
	}
}
