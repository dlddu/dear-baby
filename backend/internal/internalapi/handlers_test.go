package internalapi

import (
	"bytes"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/dlddu/dear-baby/backend/internal/onboarding"
)

func newDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	db.SetMaxOpenConns(1)
	schema := `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE onboarding (
  user_id                      TEXT PRIMARY KEY,
  due_date                     TEXT,
  onboarded_at                 TEXT,
  voice_coachmark_dismissed_at TEXT,
  first_record_at              TEXT,
  ai_preview                   TEXT,
  updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE records (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("schema: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES ('u1','a@b.com')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO onboarding (user_id) VALUES ('u1')`); err != nil {
		t.Fatalf("seed onboarding: %v", err)
	}
	return db
}

func TestTokenAuth_RejectsMissingToken(t *testing.T) {
	mw := TokenAuth("s3cret")
	h := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/internal/ping", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("missing token: got %d", rec.Code)
	}
}

func TestTokenAuth_RejectsWrongToken(t *testing.T) {
	mw := TokenAuth("s3cret")
	h := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/internal/ping", nil)
	req.Header.Set("X-Internal-Token", "nope")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("wrong token: got %d", rec.Code)
	}
}

func TestTokenAuth_AllowsCorrectToken(t *testing.T) {
	mw := TokenAuth("s3cret")
	h := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/internal/ping", nil)
	req.Header.Set("X-Internal-Token", "s3cret")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("good token: got %d", rec.Code)
	}
}

func TestSaveAIPreview_Persists(t *testing.T) {
	db := newDB(t)
	defer db.Close()
	onb := &onboarding.Store{DB: db}
	h := &Handlers{Onboarding: onb}

	rec := httptest.NewRecorder()
	body := bytes.NewBufferString(`{"user_id":"u1","preview":"따뜻한 한 줄"}`)
	h.SaveAIPreview(rec, httptest.NewRequest(http.MethodPost, "/internal/onboarding/ai-preview", body))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got string
	if err := db.QueryRow(`SELECT ai_preview FROM onboarding WHERE user_id='u1'`).Scan(&got); err != nil {
		t.Fatalf("read: %v", err)
	}
	if got != "따뜻한 한 줄" {
		t.Errorf("preview: got %q", got)
	}
}

func TestPendingAIPreviews_ReturnsReadyUsers(t *testing.T) {
	db := newDB(t)
	defer db.Close()
	// Seed a record + first_record_at so u1 is "pending".
	if _, err := db.Exec(`INSERT INTO records (id, user_id, content) VALUES ('r1','u1','hi')`); err != nil {
		t.Fatalf("seed record: %v", err)
	}
	if _, err := db.Exec(`UPDATE onboarding SET first_record_at=datetime('now') WHERE user_id='u1'`); err != nil {
		t.Fatalf("stamp first: %v", err)
	}
	onb := &onboarding.Store{DB: db}
	h := &Handlers{Onboarding: onb}

	rec := httptest.NewRecorder()
	h.PendingAIPreviews(rec, httptest.NewRequest(http.MethodGet, "/internal/tasks/ai-preview/pending", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d", rec.Code)
	}
	body := rec.Body.String()
	if !bytes.Contains([]byte(body), []byte(`"user_id":"u1"`)) {
		t.Errorf("missing u1: %s", body)
	}
	if !bytes.Contains([]byte(body), []byte(`"record_id":"r1"`)) {
		t.Errorf("missing r1: %s", body)
	}
}
