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
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  picture_url TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE oauth_accounts (
  provider         TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, provider_user_id)
);
CREATE TABLE onboarding (
  user_id                      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  due_date                     TEXT,
  onboarded_at                 TEXT,
  voice_coachmark_dismissed_at TEXT,
  first_record_at              TEXT,
  ai_preview                   TEXT,
  is_pregnant                  BOOLEAN,
  has_children                 BOOLEAN,
  multiple_pregnancy           BOOLEAN,
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

func seedUser(t *testing.T, db *sql.DB, id, email string) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES (?, ?)`, id, email); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO onboarding (user_id) VALUES (?)`, id); err != nil {
		t.Fatalf("seed onboarding: %v", err)
	}
}

// fakeEnsurer records invocations for tests that want to verify
// UpsertByOAuth wires the ensurer through.
type fakeEnsurer struct {
	calls int
}

func (f *fakeEnsurer) EnsureRowTx(ctx context.Context, tx *sql.Tx, userID string) error {
	f.calls++
	_, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)`, userID)
	return err
}

func TestGetByID_CoreFieldsOnly(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	u, err := store.GetByID(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if u.Email != "a@b.com" {
		t.Errorf("email: got %q", u.Email)
	}
}

func TestGetByID_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	_, err := store.GetByID(context.Background(), "missing")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestGetProfile_MergesOnboardingFields(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	if _, err := db.Exec(`
		UPDATE onboarding SET onboarded_at = datetime('now'),
		                      is_pregnant = 1, has_children = 0, multiple_pregnancy = 0
		WHERE user_id = 'u1'
	`); err != nil {
		t.Fatalf("stamp onboarding: %v", err)
	}

	store := &Store{DB: db}
	p, err := store.GetProfile(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get profile: %v", err)
	}
	// PRD-006: due_date is no longer surfaced from onboarding — it lives
	// per-child on Profile.Children.
	if p.DueDate != nil {
		t.Errorf("due_date should always be nil after PRD-006: got %v", *p.DueDate)
	}
	if p.OnboardedAt == nil {
		t.Error("onboarded_at should be set")
	}
	if p.IsPregnant == nil || !*p.IsPregnant {
		t.Errorf("is_pregnant: %v", p.IsPregnant)
	}
	if p.HasChildren == nil || *p.HasChildren {
		t.Errorf("has_children: %v", p.HasChildren)
	}
	if p.MultiplePregnancy == nil || *p.MultiplePregnancy {
		t.Errorf("multiple_pregnancy: %v", p.MultiplePregnancy)
	}
}

func TestGetProfile_NilOnboardingFieldsWhenRowMissing(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES ('u1', 'a@b.com')`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	store := &Store{DB: db}
	p, err := store.GetProfile(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get profile: %v", err)
	}
	if p.DueDate != nil || p.OnboardedAt != nil || p.VoiceCoachmarkDismissedAt != nil || p.FirstRecordAt != nil || p.AIPreview != nil {
		t.Errorf("missing onboarding row should give all-nil onboarding fields: got %+v", p)
	}
}

func TestUpsertByOAuth_InvokesEnsurer(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	f := &fakeEnsurer{}
	u, err := store.UpsertByOAuth(context.Background(), f, "google", "g-sub-1", "a@b.com", "Alice", "")
	if err != nil {
		t.Fatalf("insert: %v", err)
	}
	if f.calls != 1 {
		t.Errorf("ensurer calls: got %d want 1", f.calls)
	}

	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM onboarding WHERE user_id = ?`, u.ID).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 1 {
		t.Errorf("onboarding rows: got %d want 1", n)
	}
}
