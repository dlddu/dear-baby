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

var _ OnboardingUpdater = (*fakeOnboardingUpdater)(nil)

// fakeOnboardingUpdater simulates the onboarding store for the users
// handler tests. It keeps the data-access layer out of scope so failures
// here point at handler logic, not SQL.
type fakeOnboardingUpdater struct {
	db             *sql.DB
	errDueDate     error
	errDismiss     error
	errCaseA       error
	errCaseC       error
	dismissCalled  int
	updateCalled   int
	caseACalled    int
	caseCCalled    int
	lastDueDate    *string
	lastCaseADue   *string
	lastFetuses    []OnboardingFetus
	lastChildren   []OnboardingChild
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

func (f *fakeOnboardingUpdater) UpsertCaseA(ctx context.Context, userID string, dueDate *string, fetuses []OnboardingFetus) error {
	f.caseACalled++
	f.lastCaseADue = dueDate
	f.lastFetuses = fetuses
	if f.errCaseA != nil {
		return f.errCaseA
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
	if _, err := f.db.ExecContext(ctx, `DELETE FROM fetuses WHERE user_id = ?`, userID); err != nil {
		return err
	}
	for i, fe := range fetuses {
		purposes, err := json.Marshal(fe.Purposes)
		if err != nil {
			return err
		}
		if _, err := f.db.ExecContext(ctx, `
			INSERT INTO fetuses (user_id, ordinal, nickname, gender, pregnancy_week, due_date, purposes_json)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, userID, i, nullStr(fe.Nickname), nullStr(fe.Gender), nullInt(fe.PregnancyWeek), nullStr(fe.DueDate), string(purposes)); err != nil {
			return err
		}
	}
	return nil
}

func (f *fakeOnboardingUpdater) UpsertCaseC(ctx context.Context, userID string, children []OnboardingChild) error {
	f.caseCCalled++
	f.lastChildren = children
	if f.errCaseC != nil {
		return f.errCaseC
	}
	if _, err := f.db.ExecContext(ctx, `
		UPDATE onboarding SET due_date = NULL, onboarded_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?
	`, userID); err != nil {
		return err
	}
	if _, err := f.db.ExecContext(ctx, `DELETE FROM children WHERE user_id = ?`, userID); err != nil {
		return err
	}
	for i, c := range children {
		purposes, err := json.Marshal(c.Purposes)
		if err != nil {
			return err
		}
		if _, err := f.db.ExecContext(ctx, `
			INSERT INTO children (user_id, ordinal, name, gender, birth_date, bio, purposes_json)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, userID, i, nullStr(c.Name), nullStr(c.Gender), nullStr(c.BirthDate), nullStr(c.Bio), string(purposes)); err != nil {
			return err
		}
	}
	return nil
}

func nullStr(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}

func nullInt(i *int) any {
	if i == nil {
		return nil
	}
	return *i
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

// ─────────────────────────────────────────────────────────────────────────────
// PostOnboardingCaseA
// ─────────────────────────────────────────────────────────────────────────────

func TestPostOnboardingCaseA_OK(t *testing.T) {
	h, onb, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	body := `{
		"due_date": "2025-09-15",
		"fetuses": [
			{"nickname": "콩이", "gender": "unknown", "pregnancy_week": 17, "due_date": "2025-09-15", "purposes": ["매일의 마음", "몸의 변화"]}
		]
	}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/me/onboarding/case-a",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.PostOnboardingCaseA(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	if onb.caseACalled != 1 {
		t.Errorf("caseA calls: got %d want 1", onb.caseACalled)
	}
	if len(onb.lastFetuses) != 1 || len(onb.lastFetuses[0].Purposes) != 2 {
		t.Errorf("lastFetuses: got %+v", onb.lastFetuses)
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
	if len(got.Fetuses) != 1 {
		t.Fatalf("fetuses: got %d want 1", len(got.Fetuses))
	}
	if len(got.Fetuses[0].Purposes) != 2 || got.Fetuses[0].Purposes[0] != "매일의 마음" {
		t.Errorf("purposes: got %+v", got.Fetuses[0].Purposes)
	}
}

func TestPostOnboardingCaseA_NullDueDate(t *testing.T) {
	h, _, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	body := `{"due_date": null, "fetuses": [{"purposes": ["매일의 마음"]}]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/me/onboarding/case-a",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.PostOnboardingCaseA(rec, req)

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

func TestPostOnboardingCaseA_InvalidBody(t *testing.T) {
	h, _, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	cases := []string{
		`{"fetuses": []}`,                                                                             // empty
		`{"fetuses": [{"due_date": "2025/09/15", "purposes": []}]}`,                                   // bad fetus date
		`{"due_date": "2025-09-31", "fetuses": [{"purposes": []}]}`,                                   // bad top-level date
		`{"fetuses": [{"purposes": [""]}]}`,                                                           // empty purpose label
		`{"fetuses": [{"purposes": ["` + strings.Repeat("ㅇ", 101) + `"]}]}`,                         // too long
		`{"fetuses": [{"purposes": ["x"]}], "extra": 1}`,                                              // unknown field
	}
	for _, body := range cases {
		req := withUser(httptest.NewRequest(http.MethodPost, "/me/onboarding/case-a",
			strings.NewReader(body)), "u1")
		rec := httptest.NewRecorder()
		h.PostOnboardingCaseA(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("body %q: got %d want 400 body=%s", body, rec.Code, rec.Body.String())
		}
	}
}

func TestPostOnboardingCaseA_UserNotFound(t *testing.T) {
	h, _, cleanup := newHandlersFor(t, "")
	defer cleanup()

	body := `{"due_date": "2025-09-15", "fetuses": [{"purposes": []}]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/me/onboarding/case-a",
		strings.NewReader(body)), "missing")
	rec := httptest.NewRecorder()
	h.PostOnboardingCaseA(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Errorf("status: got %d want 404", rec.Code)
	}
}

func TestPostOnboardingCaseA_Unauthorized(t *testing.T) {
	h, _, cleanup := newHandlersFor(t, "")
	defer cleanup()

	body := `{"fetuses": [{"purposes": []}]}`
	req := httptest.NewRequest(http.MethodPost, "/me/onboarding/case-a",
		strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.PostOnboardingCaseA(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d want 401", rec.Code)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// PostOnboardingCaseC
// ─────────────────────────────────────────────────────────────────────────────

func TestPostOnboardingCaseC_OK(t *testing.T) {
	h, onb, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	body := `{
		"children": [
			{"name": "민준", "gender": "male", "birth_date": "2023-04-01", "bio": "활발한 아이", "purposes": ["일상의 발견", "말과 행동의 성장"]}
		]
	}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/me/onboarding/case-c",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.PostOnboardingCaseC(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	if onb.caseCCalled != 1 {
		t.Errorf("caseC calls: got %d want 1", onb.caseCCalled)
	}
	var got Profile
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.DueDate != nil {
		t.Errorf("due_date should be null for Case C: got %v", *got.DueDate)
	}
	if got.OnboardedAt == nil {
		t.Error("onboarded_at should be set")
	}
	if len(got.Children) != 1 {
		t.Fatalf("children: got %d want 1", len(got.Children))
	}
	if len(got.Children[0].Purposes) != 2 || got.Children[0].Purposes[0] != "일상의 발견" {
		t.Errorf("purposes: got %+v", got.Children[0].Purposes)
	}
}

func TestPostOnboardingCaseC_InvalidBody(t *testing.T) {
	h, _, cleanup := newHandlersFor(t, "u1")
	defer cleanup()

	cases := []string{
		`{"children": []}`,
		`{"children": [{"birth_date": "1999/01/01", "purposes": []}]}`,
		`{"children": [{"purposes": [""]}]}`,
		`{"children": [{"purposes": ["` + strings.Repeat("ㅇ", 101) + `"]}]}`,
	}
	for _, body := range cases {
		req := withUser(httptest.NewRequest(http.MethodPost, "/me/onboarding/case-c",
			strings.NewReader(body)), "u1")
		rec := httptest.NewRecorder()
		h.PostOnboardingCaseC(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("body %q: got %d want 400 body=%s", body, rec.Code, rec.Body.String())
		}
	}
}

func TestPostOnboardingCaseC_UserNotFound(t *testing.T) {
	h, _, cleanup := newHandlersFor(t, "")
	defer cleanup()

	body := `{"children": [{"name": "민준", "purposes": []}]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/me/onboarding/case-c",
		strings.NewReader(body)), "missing")
	rec := httptest.NewRecorder()
	h.PostOnboardingCaseC(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Errorf("status: got %d want 404", rec.Code)
	}
}
