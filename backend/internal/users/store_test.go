package users

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	_ "modernc.org/sqlite"
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
  due_date                        TEXT,
  onboarded_at                    TEXT,
  stage2_coachmark_dismissed_at   TEXT,
  first_record_at                 TEXT,
  created_at                      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                      TEXT NOT NULL DEFAULT (datetime('now'))
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
}

func TestUpdateOnboarding_WithDueDate(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	due := "2025-09-15"
	if err := store.UpdateOnboarding(ctx, "u1", &due); err != nil {
		t.Fatalf("update: %v", err)
	}

	u, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if u.DueDate == nil || *u.DueDate != "2025-09-15" {
		t.Errorf("due_date: got %v want 2025-09-15", u.DueDate)
	}
	if u.OnboardedAt == nil {
		t.Errorf("onboarded_at should be set")
	}
}

func TestUpdateOnboarding_NullDueDate(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	if err := store.UpdateOnboarding(ctx, "u1", nil); err != nil {
		t.Fatalf("update: %v", err)
	}

	u, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if u.DueDate != nil {
		t.Errorf("due_date: got %v want nil", *u.DueDate)
	}
	if u.OnboardedAt == nil {
		t.Errorf("onboarded_at should be set even when due_date is null")
	}
}

func TestUpdateOnboarding_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	err := store.UpdateOnboarding(context.Background(), "missing", nil)
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestResetOnboardingByEmail(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	due := "2025-09-15"
	if err := store.UpdateOnboarding(ctx, "u1", &due); err != nil {
		t.Fatalf("update: %v", err)
	}

	if err := store.ResetOnboardingByEmail(ctx, "a@b.com"); err != nil {
		t.Fatalf("reset: %v", err)
	}

	u, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if u.DueDate != nil {
		t.Errorf("due_date: got %v want nil", *u.DueDate)
	}
	if u.OnboardedAt != nil {
		t.Errorf("onboarded_at: got %v want nil", *u.OnboardedAt)
	}
}

func TestResetOnboardingByEmail_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	err := store.ResetOnboardingByEmail(context.Background(), "missing@example.com")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestGetByID_UnonboardedUserHasNilFields(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	u, err := store.GetByID(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if u.DueDate != nil {
		t.Errorf("due_date: got %v want nil", *u.DueDate)
	}
	if u.OnboardedAt != nil {
		t.Errorf("onboarded_at: got %v want nil", *u.OnboardedAt)
	}
	if u.Stage2CoachmarkDismissedAt != nil {
		t.Errorf("stage2_coachmark_dismissed_at: got %v want nil", *u.Stage2CoachmarkDismissedAt)
	}
}

func TestDismissStage2Coachmark(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()

	if err := store.DismissStage2Coachmark(ctx, "u1"); err != nil {
		t.Fatalf("dismiss: %v", err)
	}
	first, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if first.Stage2CoachmarkDismissedAt == nil {
		t.Fatal("stage2_coachmark_dismissed_at should be set after first dismiss")
	}
	stamped := *first.Stage2CoachmarkDismissedAt

	// Second call must be a no-op: the original timestamp is preserved.
	if err := store.DismissStage2Coachmark(ctx, "u1"); err != nil {
		t.Fatalf("second dismiss: %v", err)
	}
	second, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if second.Stage2CoachmarkDismissedAt == nil ||
		!second.Stage2CoachmarkDismissedAt.Equal(stamped) {
		t.Errorf("timestamp changed on second dismiss: got %v want %v",
			second.Stage2CoachmarkDismissedAt, stamped)
	}
}

func TestDismissStage2Coachmark_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	err := store.DismissStage2Coachmark(context.Background(), "missing")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestResetOnboarding_ClearsStage2Coachmark(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	if err := store.DismissStage2Coachmark(ctx, "u1"); err != nil {
		t.Fatalf("dismiss: %v", err)
	}
	if err := store.ResetOnboarding(ctx, "u1"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	u, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if u.Stage2CoachmarkDismissedAt != nil {
		t.Errorf("coachmark should be cleared on reset, got %v",
			*u.Stage2CoachmarkDismissedAt)
	}
}

func TestResetOnboarding_ClearsFirstRecordAtButPreservesRecords(t *testing.T) {
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
		UPDATE users SET first_record_at = datetime('now') WHERE id = 'u1';
	`); err != nil {
		t.Fatalf("seed first_record_at: %v", err)
	}

	store := &Store{DB: db}
	ctx := context.Background()
	if err := store.ResetOnboarding(ctx, "u1"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	u, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if u.FirstRecordAt != nil {
		t.Errorf("first_record_at should be cleared, got %v", *u.FirstRecordAt)
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
