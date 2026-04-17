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
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT,
  picture_url  TEXT,
  due_date     TEXT,
  onboarded_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE oauth_accounts (
  provider         TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, provider_user_id)
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
}
