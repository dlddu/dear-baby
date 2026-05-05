package users

import (
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
// handler tests. Keeps the data-access layer out of scope so failures
// here point at handler logic, not SQL.
type fakeOnboardingUpdater struct {
	db            *sql.DB
	errDismiss    error
	dismissCalled int
}

var fakeNotFound = errors.New("fake onboarding not found")

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

func TestPatchMe_DueDateRejected(t *testing.T) {
	h, _, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	// The legacy due_date path is gone — any payload that doesn't carry
	// dismiss_voice_coachmark=true must 400.
	for _, body := range []string{
		`{"due_date":"2025-09-15"}`,
		`{"due_date":null}`,
	} {
		req := withUser(httptest.NewRequest(http.MethodPatch, "/me", strings.NewReader(body)), "u1")
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
		strings.NewReader(`{"dismiss_voice_coachmark":true}`))
	rec := httptest.NewRecorder()
	h.PatchMe(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d want 401", rec.Code)
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
	if got.VoiceCoachmarkDismissedAt.After(time.Now().Add(time.Minute)) {
		t.Errorf("stamp in future: %v", *got.VoiceCoachmarkDismissedAt)
	}
}

func TestPatchMe_DismissFalseRejected(t *testing.T) {
	h, _, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPatch, "/me",
		strings.NewReader(`{"dismiss_voice_coachmark":false}`)), "u1")
	rec := httptest.NewRecorder()
	h.PatchMe(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestPatchMe_UnknownFieldRejected(t *testing.T) {
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
