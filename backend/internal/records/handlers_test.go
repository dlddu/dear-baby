package records

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/dlddu/dear-baby/backend/internal/users"
)

type ctxKeyUser struct{}

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

func newHandlers(t *testing.T, uid string) (*Handlers, *sql.DB) {
	t.Helper()
	db := newTestDB(t)
	if uid != "" {
		seedUser(t, db, uid, uid+"@b.com")
	}
	return &Handlers{
		Store: &Store{DB: db},
		Users: &users.Store{DB: db},
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
	}, db
}

func withUser(r *http.Request, uid string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), ctxKeyUser{}, uid))
}

func post(t *testing.T, h *Handlers, uid, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/records", bytes.NewBufferString(body))
	if uid != "" {
		req = withUser(req, uid)
	}
	rec := httptest.NewRecorder()
	h.Create(rec, req)
	return rec
}

func TestCreate_HappyPath_StampsFirstRecordAt(t *testing.T) {
	h, db := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"엄마가 너에게 전하고 싶은 말"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got createResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Record == nil || got.Record.ID == "" {
		t.Error("record missing")
	}
	if got.Record.Content != "엄마가 너에게 전하고 싶은 말" {
		t.Errorf("content: got %q", got.Record.Content)
	}
	if got.User == nil || got.User.FirstRecordAt == nil {
		t.Fatal("user.first_record_at should be stamped")
	}
}

func TestCreate_SecondRecord_PreservesFirstRecordAt(t *testing.T) {
	h, db := newHandlers(t, "u1")
	defer db.Close()

	r1 := post(t, h, "u1", `{"content":"one"}`)
	if r1.Code != http.StatusCreated {
		t.Fatalf("first: %d %s", r1.Code, r1.Body.String())
	}
	var first createResponse
	if err := json.Unmarshal(r1.Body.Bytes(), &first); err != nil {
		t.Fatalf("decode first: %v", err)
	}
	stamped := *first.User.FirstRecordAt

	// Sleep would be flaky; instead rely on datetime('now') granularity. If
	// the second COALESCE accidentally overwrote, the value could only move
	// forward, so "not equal" is a stricter-than-necessary assertion.
	r2 := post(t, h, "u1", `{"content":"two"}`)
	if r2.Code != http.StatusCreated {
		t.Fatalf("second: %d %s", r2.Code, r2.Body.String())
	}
	var second createResponse
	if err := json.Unmarshal(r2.Body.Bytes(), &second); err != nil {
		t.Fatalf("decode second: %v", err)
	}
	if !second.User.FirstRecordAt.Equal(stamped) {
		t.Errorf("first_record_at changed on second record: got %v want %v",
			second.User.FirstRecordAt, stamped)
	}
}

func TestCreate_EmptyContent_400(t *testing.T) {
	h, db := newHandlers(t, "u1")
	defer db.Close()

	cases := []string{
		`{"content":""}`,
		`{"content":"   \n\t  "}`,
	}
	for _, body := range cases {
		rec := post(t, h, "u1", body)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("body %q: got %d want 400", body, rec.Code)
		}
	}
}

func TestCreate_TooLong_400(t *testing.T) {
	h, db := newHandlers(t, "u1")
	defer db.Close()

	long := strings.Repeat("가", 2001)
	body, _ := json.Marshal(map[string]string{"content": long})
	rec := post(t, h, "u1", string(body))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestCreate_Unauthorized_401(t *testing.T) {
	h, db := newHandlers(t, "")
	defer db.Close()

	req := httptest.NewRequest(http.MethodPost, "/records", bytes.NewBufferString(`{"content":"x"}`))
	rec := httptest.NewRecorder()
	h.Create(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d want 401", rec.Code)
	}
}

func TestCreate_InvalidBody_400(t *testing.T) {
	h, db := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `not json`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestCreate_UnknownField_400(t *testing.T) {
	h, db := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"ok","extra":1}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}
