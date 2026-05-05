package auth

import (
	"context"
	"database/sql"
	"testing"
	"time"

	_ "modernc.org/sqlite"

	"github.com/dlddu/dear-baby/backend/internal/users"
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
  case_kind                    TEXT,
  onboarded_at                 TEXT,
  voice_coachmark_dismissed_at TEXT,
  first_record_at              TEXT,
  ai_preview                   TEXT,
  updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE refresh_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
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

// testEnsurer inserts an empty onboarding row inside the upsert
// transaction — mirrors what onboarding.Store.EnsureRowTx does.
type testEnsurer struct{}

func (testEnsurer) EnsureRowTx(ctx context.Context, tx *sql.Tx, userID string) error {
	_, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)`, userID)
	return err
}

func TestJWTRoundtrip(t *testing.T) {
	iss := &Issuer{
		Secret:     []byte("test-secret"),
		AccessTTL:  5 * time.Minute,
		RefreshTTL: time.Hour,
	}
	access, err := iss.IssueAccess("user-123")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	claims, err := iss.Parse(access)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if claims.UserID != "user-123" {
		t.Errorf("uid: got %q want %q", claims.UserID, "user-123")
	}
	if claims.TokenType != TypeAccess {
		t.Errorf("typ: got %q want %q", claims.TokenType, TypeAccess)
	}
}

func TestExpectTypeRejectsWrongToken(t *testing.T) {
	iss := &Issuer{Secret: []byte("s"), AccessTTL: time.Minute, RefreshTTL: time.Minute}
	refresh, _, err := iss.IssueRefresh("u")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	claims, err := iss.Parse(refresh)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if err := ExpectType(claims, TypeAccess); err == nil {
		t.Error("expected refresh token to be rejected as access")
	}
}

func TestRefreshHashInsertAndConsume(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES ('u1', 'a@b.com')`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	store := &RefreshStore{DB: db}
	hash := HashToken("raw-refresh-token")
	if err := store.Insert(context.Background(), "u1", hash, time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("insert: %v", err)
	}
	uid, err := store.Consume(context.Background(), hash)
	if err != nil {
		t.Fatalf("consume: %v", err)
	}
	if uid != "u1" {
		t.Errorf("uid: got %q want %q", uid, "u1")
	}
}

func TestUpsertByOAuthNewAndExisting(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	store := &users.Store{DB: db}
	ctx := context.Background()

	u1, err := store.UpsertByOAuth(ctx, testEnsurer{}, "google", "g-sub-1", "a@b.com", "Alice", "http://p/a")
	if err != nil {
		t.Fatalf("insert: %v", err)
	}
	if u1.Email != "a@b.com" {
		t.Errorf("email: got %q", u1.Email)
	}
	u2, err := store.UpsertByOAuth(ctx, testEnsurer{}, "google", "g-sub-1", "a@b.com", "Alice Updated", "http://p/a2")
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if u2.ID != u1.ID {
		t.Errorf("id drifted: %q vs %q", u2.ID, u1.ID)
	}
	if u2.Name != "Alice Updated" {
		t.Errorf("name: got %q want Alice Updated", u2.Name)
	}
}
