package internalapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/dlddu/dear-baby/backend/internal/onboarding"
)

func newDB(t *testing.T) *sql.DB {
	t.Helper()
	// Unique DSN per test so modernc's shared cache does not bleed across
	// tests in the same process.
	dsn := "file:" + t.Name() + "?mode=memory&cache=private"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	db.SetMaxOpenConns(1)
	schema := `
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT, picture_url TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE onboarding (user_id TEXT PRIMARY KEY, due_date TEXT, onboarded_at TEXT, voice_coachmark_dismissed_at TEXT, first_record_at TEXT, ai_preview TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE records (id TEXT PRIMARY KEY, user_id TEXT, content TEXT, created_at TEXT DEFAULT (datetime('now')));
`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("schema: %v", err)
	}
	return db
}

func seedPending(t *testing.T, db *sql.DB) {
	t.Helper()
	if _, err := db.Exec(`
		INSERT INTO users (id, email) VALUES ('u1', 'a@b.com');
		INSERT INTO onboarding (user_id, first_record_at) VALUES ('u1', datetime('now'));
		INSERT INTO records (id, user_id, content) VALUES ('r1', 'u1', 'hello');
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}
}

func newHandlers(t *testing.T) *Handlers {
	t.Helper()
	db := newDB(t)
	return &Handlers{
		Onboarding: &onboarding.Store{DB: db},
		Token:      "s3cret",
	}
}

// wrap wires RequireToken around a handler so we test the middleware
// pair as callers see it.
func wrap(h *Handlers, fn http.HandlerFunc) http.Handler {
	return h.RequireToken(fn)
}

func TestListPendingAIPreviews_Happy(t *testing.T) {
	h := newHandlers(t)
	seedPending(t, h.Onboarding.DB)

	req := httptest.NewRequest(http.MethodGet, "/internal/tasks/ai-preview/pending", nil)
	req.Header.Set("X-Internal-Token", "s3cret")
	rec := httptest.NewRecorder()
	wrap(h, h.ListPendingAIPreviews).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	var out []pendingItem
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(out) != 1 || out[0].UserID != "u1" || out[0].RecordID != "r1" {
		t.Errorf("out: %+v", out)
	}
}

func TestListPendingAIPreviews_Empty(t *testing.T) {
	h := newHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/internal/tasks/ai-preview/pending", nil)
	req.Header.Set("X-Internal-Token", "s3cret")
	rec := httptest.NewRecorder()
	wrap(h, h.ListPendingAIPreviews).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d", rec.Code)
	}
	if strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Errorf("body: %q want []", rec.Body.String())
	}
}

func TestRequireToken_Missing(t *testing.T) {
	h := newHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/internal/tasks/ai-preview/pending", nil)
	rec := httptest.NewRecorder()
	wrap(h, h.ListPendingAIPreviews).ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: %d want 401", rec.Code)
	}
}

func TestRequireToken_Wrong(t *testing.T) {
	h := newHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/internal/tasks/ai-preview/pending", nil)
	req.Header.Set("X-Internal-Token", "wrong")
	rec := httptest.NewRecorder()
	wrap(h, h.ListPendingAIPreviews).ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: %d want 401", rec.Code)
	}
}

func TestRequireToken_NotConfigured(t *testing.T) {
	h := newHandlers(t)
	h.Token = ""
	req := httptest.NewRequest(http.MethodGet, "/internal/tasks/ai-preview/pending", nil)
	req.Header.Set("X-Internal-Token", "s3cret")
	rec := httptest.NewRecorder()
	wrap(h, h.ListPendingAIPreviews).ServeHTTP(rec, req)
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status: %d want 500", rec.Code)
	}
}

func TestSaveAIPreview_Happy(t *testing.T) {
	h := newHandlers(t)
	seedPending(t, h.Onboarding.DB)

	req := httptest.NewRequest(http.MethodPost, "/internal/onboarding/ai-preview",
		strings.NewReader(`{"user_id":"u1","preview":"the preview"}`))
	req.Header.Set("X-Internal-Token", "s3cret")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	wrap(h, h.SaveAIPreview).ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}

	var preview sql.NullString
	if err := h.Onboarding.DB.QueryRow(`SELECT ai_preview FROM onboarding WHERE user_id='u1'`).Scan(&preview); err != nil {
		t.Fatalf("query: %v", err)
	}
	if !preview.Valid || preview.String != "the preview" {
		t.Errorf("preview: %+v", preview)
	}
}

func TestSaveAIPreview_MissingFields(t *testing.T) {
	h := newHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/internal/onboarding/ai-preview",
		strings.NewReader(`{"user_id":""}`))
	req.Header.Set("X-Internal-Token", "s3cret")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	wrap(h, h.SaveAIPreview).ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestSaveAIPreview_UserMissing(t *testing.T) {
	h := newHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/internal/onboarding/ai-preview",
		strings.NewReader(`{"user_id":"nobody","preview":"x"}`))
	req.Header.Set("X-Internal-Token", "s3cret")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	wrap(h, h.SaveAIPreview).ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Errorf("status: %d want 404", rec.Code)
	}
}
