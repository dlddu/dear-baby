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
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  onboarded_at    TEXT,
  first_record_at TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE records (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE fetuses (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ordinal        INTEGER NOT NULL,
  nickname       TEXT,
  gender         TEXT,
  pregnancy_week INTEGER,
  due_date       TEXT,
  purposes_json  TEXT NOT NULL DEFAULT '[]',
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, ordinal)
);
CREATE TABLE children (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ordinal        INTEGER NOT NULL,
  name           TEXT,
  gender         TEXT,
  birth_date     TEXT,
  bio            TEXT,
  purposes_json  TEXT NOT NULL DEFAULT '[]',
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, ordinal)
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
		UPDATE onboarding SET onboarded_at = datetime('now')
		WHERE user_id = 'u1'
	`); err != nil {
		t.Fatalf("stamp onboarding: %v", err)
	}

	store := &Store{DB: db}
	p, err := store.GetProfile(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get profile: %v", err)
	}
	if p.OnboardedAt == nil {
		t.Error("onboarded_at should be set")
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
	if p.OnboardedAt != nil || p.FirstRecordAt != nil {
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
