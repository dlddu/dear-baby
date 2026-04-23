package users

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// fakeOnboardingUpdater simulates the onboarding store for the users
// handler tests. It keeps the data-access layer out of scope so failures
// here point at handler logic, not SQL.
type fakeOnboardingUpdater struct {
	db            *sql.DB
	errDueDate    error
	errDismiss    error
	dismissCalled int
	updateCalled  int
	lastDueDate   *string
}

var fakeNotFound = errors.New("fake onboarding not found")

func (f *fakeOnboardingUpdater) UpdateDueDateAndOnboardedAt(ctx context.Context, userID string, dueDate *string) error {
	f.updateCalled++
	f.lastDueDate = dueDate
	if f.errDueDate != nil {
		return f.errDueDate
	}
	var dueArg any
	if dueDate != nil {
		dueArg = *dueDate
	}
	if _, err := f.db.ExecContext(ctx, `
		UPDATE onboarding SET due_date = ?, onboarded_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?
	`, dueArg, userID); err != nil {
		return err
	}
	return nil
}

func (f *fakeOnboardingUpdater) DismissVoiceCoachmark(ctx context.Context, userID string) error {
	f.dismissCalled++
	if f.errDismiss != nil {
		return f.errDismiss
	}
	if _, err := f.db.ExecContext(ctx, `
		UPDATE onboarding SET voice_coachmark_dismissed_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?
	`, userID); err != nil {
		return err
	}
	return nil
}

func newHandlersFor(t *testing.T, userID string) (*Handlers, *fakeOnboardingUpdater, func()) {
	t.Helper()
	db := newTestDB(t)
	if userID != "" {
		seedUser(t, db, userID, userID+"@b.com")
	}
	onb := &fakeOnboardingUpdater{db: db}
	h := &Handlers{
		Store:                 &Store{DB: db},
		Onboarding:            onb,
		OnboardingErrNotFound: fakeNotFound,
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
	}
	return h, onb, func() { db.Close() }
}

type ctxKeyUser struct{}

func withUser(r *http.Request, uid string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), ctxKeyUser{}, uid))
}

func TestPatchMe_SetDueDate(t *testing.T) {
	h, _, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	body := strings.NewReader(`{"due_date":"2025-09-15"}`)
	req := withUser(httptest.NewRequest(http.MethodPatch, "/me", body), "u1")
	rec := httptest.NewRecorder()
	h.PatchMe(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got Profile
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
	h, _, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPatch, "/me",
		bytes.NewBufferString(`{"due_date":null}`)), "u1")
	rec := httptest.NewRecorder()
	h.PatchMe(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got Profile
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
	h, _, cleanup := newHandlersFor(t, "u1")
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
	h, _, cleanup := newHandlersFor(t, "")
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
	h, _, cleanup := newHandlersFor(t, "")
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPatch, "/me",
		strings.NewReader(`{"due_date":null}`)), "missing")
	rec := httptest.NewRecorder()
	h.PatchMe(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Errorf("status: got %d want 404", rec.Code)
	}
}

func TestPatchMe_DismissVoiceCoachmark(t *testing.T) {
	h, onb, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPatch, "/me",
		strings.NewReader(`{"dismiss_voice_coachmark":true}`)), "u1")
	rec := httptest.NewRecorder()
	h.PatchMe(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	if onb.dismissCalled != 1 {
		t.Errorf("dismiss calls: got %d want 1", onb.dismissCalled)
	}
	var got Profile
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.VoiceCoachmarkDismissedAt == nil {
		t.Error("voice_coachmark_dismissed_at should be set")
	}
	if got.OnboardedAt != nil {
		t.Error("onboarded_at should not be stamped by a coachmark dismissal")
	}
	// Ensure the elapsed time makes sense; guards against pointer reuse.
	if got.VoiceCoachmarkDismissedAt.After(time.Now().Add(time.Minute)) {
		t.Errorf("stamp in future: %v", *got.VoiceCoachmarkDismissedAt)
	}
}

func TestPatchMe_DismissWithDueDateIsRejected(t *testing.T) {
	h, _, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPatch, "/me",
		strings.NewReader(`{"due_date":"2025-09-15","dismiss_voice_coachmark":true}`)), "u1")
	rec := httptest.NewRecorder()
	h.PatchMe(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}
