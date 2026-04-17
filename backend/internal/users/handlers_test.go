package users

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newHandlersFor(t *testing.T, userID string) (*Handlers, func()) {
	t.Helper()
	db := newTestDB(t)
	if userID != "" {
		seedUser(t, db, userID, userID+"@b.com")
	}
	h := &Handlers{
		Store: &Store{DB: db},
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
	}
	return h, func() { db.Close() }
}

// ctxKeyUser is a private key used by the test fake auth shim.
type ctxKeyUser struct{}

func withUser(r *http.Request, uid string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), ctxKeyUser{}, uid))
}

func TestPatchMe_SetDueDate(t *testing.T) {
	h, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	body := strings.NewReader(`{"due_date":"2025-09-15"}`)
	req := withUser(httptest.NewRequest(http.MethodPatch, "/me", body), "u1")
	rec := httptest.NewRecorder()
	h.PatchMe(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got User
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.DueDate == nil || *got.DueDate != "2025-09-15" {
		t.Errorf("due_date: got %v", got.DueDate)
	}
	if got.OnboardedAt == nil {
		t.Error("onboarded_at should be set")
	}
}

func TestPatchMe_NullDueDate(t *testing.T) {
	h, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPatch, "/me",
		bytes.NewBufferString(`{"due_date":null}`)), "u1")
	rec := httptest.NewRecorder()
	h.PatchMe(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got User
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.DueDate != nil {
		t.Errorf("due_date: got %v want nil", *got.DueDate)
	}
	if got.OnboardedAt == nil {
		t.Error("onboarded_at should be set")
	}
}

func TestPatchMe_InvalidDateFormat(t *testing.T) {
	h, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	cases := []string{
		`{"due_date":"2025/09/15"}`,
		`{"due_date":"2025-9-15"}`,
		`{"due_date":"2025-02-31"}`,
		`{"due_date":"not-a-date"}`,
	}
	for _, body := range cases {
		req := withUser(httptest.NewRequest(http.MethodPatch, "/me",
			strings.NewReader(body)), "u1")
		rec := httptest.NewRecorder()
		h.PatchMe(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("body %q: got %d want 400", body, rec.Code)
		}
	}
}

func TestPatchMe_Unauthorized(t *testing.T) {
	h, cleanup := newHandlersFor(t, "")
	defer cleanup()

	req := httptest.NewRequest(http.MethodPatch, "/me",
		strings.NewReader(`{"due_date":null}`))
	rec := httptest.NewRecorder()
	h.PatchMe(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d want 401", rec.Code)
	}
}

func TestPatchMe_UserNotFound(t *testing.T) {
	h, cleanup := newHandlersFor(t, "")
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPatch, "/me",
		strings.NewReader(`{"due_date":null}`)), "missing")
	rec := httptest.NewRecorder()
	h.PatchMe(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Errorf("status: got %d want 404", rec.Code)
	}
}

func TestPatchMe_DismissStage2Coachmark(t *testing.T) {
	h, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPatch, "/me",
		strings.NewReader(`{"dismiss_stage2_coachmark":true}`)), "u1")
	rec := httptest.NewRecorder()
	h.PatchMe(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got User
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Stage2CoachmarkDismissedAt == nil {
		t.Error("stage2_coachmark_dismissed_at should be set")
	}
	// Dismissal is an independent action — onboarding fields are untouched.
	if got.OnboardedAt != nil {
		t.Error("onboarded_at should not be stamped by a coachmark dismissal")
	}
}

func TestPatchMe_DismissWithDueDateIsRejected(t *testing.T) {
	h, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPatch, "/me",
		strings.NewReader(`{"due_date":"2025-09-15","dismiss_stage2_coachmark":true}`)), "u1")
	rec := httptest.NewRecorder()
	h.PatchMe(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}
