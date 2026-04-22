package onboarding

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"

	_ "modernc.org/sqlite"
)

type ctxKeyUser struct{}

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
	return db
}

func withUser(r *http.Request, uid string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), ctxKeyUser{}, uid))
}

func TestCreateAIPreview_Unauthorized(t *testing.T) {
	db := newDB(t)
	defer db.Close()
	store := &Store{DB: db}
	h := &Handlers{
		Store: store,
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
	}
	rec := httptest.NewRecorder()
	h.CreateAIPreview(rec, httptest.NewRequest(http.MethodPost, "/onboarding/ai-preview", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("got %d want 401", rec.Code)
	}
}

func TestCreateAIPreview_NoFirstRecord_400(t *testing.T) {
	db := newDB(t)
	defer db.Close()
	if _, err := db.Exec(`INSERT INTO users (id,email) VALUES ('u1','a@b.com')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO onboarding (user_id) VALUES ('u1')`); err != nil {
		t.Fatalf("seed onb: %v", err)
	}
	store := &Store{DB: db}
	h := &Handlers{
		Store: store,
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
	}
	rec := httptest.NewRecorder()
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/ai-preview", nil), "u1")
	h.CreateAIPreview(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}
