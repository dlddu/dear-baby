package onboarding

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"github.com/dlddu/dear-baby/backend/internal/tasks"
)

type ctxKeyUser struct{}

func withUser(r *http.Request, uid string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), ctxKeyUser{}, uid))
}

// newRequestHandlers spins up miniredis + tasks.Client so RequestAIPreview
// tests can observe the queue length without a real broker.
func newRequestHandlers(t *testing.T) (*Handlers, *miniredis.Miniredis, func()) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	rc := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	db := newTestDB(t)

	h := &Handlers{
		Store: &Store{DB: db},
		Tasks: &tasks.Client{Redis: rc},
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
	}
	return h, mr, func() { _ = rc.Close(); mr.Close(); db.Close() }
}

func TestRequestAIPreview_Happy(t *testing.T) {
	h, mr, cleanup := newRequestHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")
	if _, err := h.Store.DB.Exec(`INSERT INTO records (id, user_id, content) VALUES ('r1', 'u1', 'hello')`); err != nil {
		t.Fatalf("seed rec: %v", err)
	}
	if _, err := h.Store.DB.Exec(`UPDATE onboarding SET first_record_at = datetime('now') WHERE user_id='u1'`); err != nil {
		t.Fatalf("stamp: %v", err)
	}

	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/ai-preview", nil), "u1")
	rec := httptest.NewRecorder()
	h.RequestAIPreview(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	// Queue should have 1 entry.
	items, err := mr.DB(0).List("tasks:queue")
	if err != nil {
		t.Fatalf("list queue: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("queue length: %d want 1", len(items))
	}
	// Validate envelope shape.
	var env struct {
		Type    string `json:"type"`
		Payload struct {
			UserID   string `json:"user_id"`
			RecordID string `json:"record_id"`
			Content  string `json:"content"`
		} `json:"payload"`
		V int `json:"v"`
	}
	if err := json.Unmarshal([]byte(items[0]), &env); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if env.Type != "ai_preview" || env.Payload.UserID != "u1" ||
		env.Payload.RecordID != "r1" || env.Payload.Content != "hello" || env.V != 1 {
		t.Errorf("envelope: %+v", env)
	}
}

func TestRequestAIPreview_NoFirstRecord(t *testing.T) {
	h, _, cleanup := newRequestHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/ai-preview", nil), "u1")
	rec := httptest.NewRecorder()
	h.RequestAIPreview(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestRequestAIPreview_Unauth(t *testing.T) {
	h, _, cleanup := newRequestHandlers(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodPost, "/onboarding/ai-preview", nil)
	rec := httptest.NewRecorder()
	h.RequestAIPreview(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: %d want 401", rec.Code)
	}
}

func TestRequestAIPreview_NoRecord(t *testing.T) {
	// first_record_at is set but the records row is missing — pathological
	// but the handler must degrade to 400, not panic or 500.
	h, _, cleanup := newRequestHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")
	if _, err := h.Store.DB.Exec(`UPDATE onboarding SET first_record_at = datetime('now') WHERE user_id='u1'`); err != nil {
		t.Fatalf("stamp: %v", err)
	}

	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/ai-preview", nil), "u1")
	rec := httptest.NewRecorder()
	h.RequestAIPreview(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}
