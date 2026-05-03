package onboarding

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/dlddu/dear-baby/backend/internal/children"
)

// fakeCaseStore captures calls so handler tests can assert behavior
// without booting SQLite.
type fakeCaseStore struct {
	caseCalls       int
	lastIsPregnant  *bool
	lastHasChildren *bool

	multiCalls    int
	lastMultiple  bool
	completeCalls int

	caseErr     error
	multiErr    error
	completeErr error
}

func (f *fakeCaseStore) SetCase(_ context.Context, _ string, isPregnant, hasChildren *bool) error {
	f.caseCalls++
	f.lastIsPregnant = isPregnant
	f.lastHasChildren = hasChildren
	return f.caseErr
}

func (f *fakeCaseStore) SetMultiplePregnancy(_ context.Context, _ string, value bool) error {
	f.multiCalls++
	f.lastMultiple = value
	return f.multiErr
}

func (f *fakeCaseStore) Complete(_ context.Context, _ string) error {
	f.completeCalls++
	return f.completeErr
}

type fakeChildrenStore struct {
	calls       int
	lastInputs  []children.ChildInput
	replaceErr  error
	replaceOut  []children.Child
}

func (f *fakeChildrenStore) ReplaceAll(_ context.Context, _ string, inputs []children.ChildInput) ([]children.Child, error) {
	f.calls++
	f.lastInputs = inputs
	return f.replaceOut, f.replaceErr
}

func newCaseHandlers() (*CaseHandlers, *fakeCaseStore, *fakeChildrenStore) {
	cs := &fakeCaseStore{}
	chs := &fakeChildrenStore{}
	h := &CaseHandlers{
		Onboarding: cs,
		Children:   chs,
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
	}
	return h, cs, chs
}

func TestSetCase_HappyPath(t *testing.T) {
	h, cs, _ := newCaseHandlers()
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(`{"is_pregnant":true,"has_children":false}`)), "u1")
	rec := httptest.NewRecorder()
	h.SetCase(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if cs.caseCalls != 1 {
		t.Errorf("calls: %d", cs.caseCalls)
	}
	if cs.lastIsPregnant == nil || !*cs.lastIsPregnant {
		t.Errorf("is_pregnant: %v", cs.lastIsPregnant)
	}
	if cs.lastHasChildren == nil || *cs.lastHasChildren {
		t.Errorf("has_children: %v", cs.lastHasChildren)
	}
}

func TestSetCase_MissingFields(t *testing.T) {
	h, _, _ := newCaseHandlers()
	cases := []string{
		`{"is_pregnant":true}`,
		`{"has_children":false}`,
		`{}`,
	}
	for _, body := range cases {
		req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
			strings.NewReader(body)), "u1")
		rec := httptest.NewRecorder()
		h.SetCase(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("body %q: %d want 400", body, rec.Code)
		}
	}
}

func TestSetCase_Unauthorized(t *testing.T) {
	h, _, _ := newCaseHandlers()
	req := httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(`{"is_pregnant":true,"has_children":false}`))
	rec := httptest.NewRecorder()
	h.SetCase(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: %d want 401", rec.Code)
	}
}

func TestSetCaseHandler_NotFound(t *testing.T) {
	h, cs, _ := newCaseHandlers()
	cs.caseErr = ErrNotFound
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(`{"is_pregnant":true,"has_children":false}`)), "missing")
	rec := httptest.NewRecorder()
	h.SetCase(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Errorf("status: %d want 404", rec.Code)
	}
}

func TestSetMultiplePregnancy_HappyPath(t *testing.T) {
	h, cs, _ := newCaseHandlers()
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/multiple-pregnancy",
		strings.NewReader(`{"value":true}`)), "u1")
	rec := httptest.NewRecorder()
	h.SetMultiplePregnancy(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if cs.multiCalls != 1 || !cs.lastMultiple {
		t.Errorf("multi: %d %v", cs.multiCalls, cs.lastMultiple)
	}
}

func TestSetMultiplePregnancy_MissingValue(t *testing.T) {
	h, _, _ := newCaseHandlers()
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/multiple-pregnancy",
		strings.NewReader(`{}`)), "u1")
	rec := httptest.NewRecorder()
	h.SetMultiplePregnancy(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestSubmitChildren_HappyPath_Pregnancy(t *testing.T) {
	h, _, chs := newCaseHandlers()
	body := `{"children":[{"status":"pregnancy","gender":"unknown","due_date":"2026-09-15","pregnancy_week":12,"name":"콩이","is_due_date_undecided":false,"purposes":["letter","diary"]}]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/children",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitChildren(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if chs.calls != 1 || len(chs.lastInputs) != 1 {
		t.Fatalf("calls=%d inputs=%+v", chs.calls, chs.lastInputs)
	}
	in := chs.lastInputs[0]
	if in.Status != children.StatusPregnancy || in.Gender != children.GenderUnknown {
		t.Errorf("status/gender: %+v", in)
	}
	if in.DueDate == nil || *in.DueDate != "2026-09-15" {
		t.Errorf("due_date: %v", in.DueDate)
	}
	if len(in.Purposes) != 2 || in.Purposes[0] != "letter" {
		t.Errorf("purposes: %+v", in.Purposes)
	}
}

func TestSubmitChildren_HappyPath_Parenting(t *testing.T) {
	h, _, _ := newCaseHandlers()
	body := `{"children":[{"status":"parenting","gender":"female","birth_date":"2023-04-21","name":"서윤","bio":"잘 웃는 우리 아이","purposes":["growth"]}]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/children",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitChildren(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestSubmitChildren_InvalidStatus(t *testing.T) {
	h, _, _ := newCaseHandlers()
	body := `{"children":[{"status":"alien","gender":"female","birth_date":"2023-04-21"}]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/children",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitChildren(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestSubmitChildren_InvalidDate(t *testing.T) {
	h, _, _ := newCaseHandlers()
	body := `{"children":[{"status":"parenting","gender":"female","birth_date":"2023/04/21"}]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/children",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitChildren(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestSubmitChildren_EmptyArrayRejected(t *testing.T) {
	h, _, _ := newCaseHandlers()
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/children",
		strings.NewReader(`{"children":[]}`)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitChildren(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestSubmitChildren_StoreInvalid(t *testing.T) {
	// Validation that only the store can catch (status/birth-date interaction)
	// surfaces as 400 with the specific error message.
	h, _, chs := newCaseHandlers()
	chs.replaceErr = errors.New("invalid child: birth_date required for parenting")
	// Wrap with sentinel so handler maps to 400.
	chs.replaceErr = &wrapErr{children.ErrInvalidChild, chs.replaceErr.Error()}
	body := `{"children":[{"status":"parenting","gender":"female","birth_date":"2023-04-21"}]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/children",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitChildren(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

// wrapErr lets us synthesize an error chain that errors.Is matches against
// children.ErrInvalidChild without depending on fmt.Errorf's chain order.
type wrapErr struct {
	sentinel error
	msg      string
}

func (e *wrapErr) Error() string { return e.msg }
func (e *wrapErr) Unwrap() error { return e.sentinel }

func TestComplete_HappyPath(t *testing.T) {
	h, cs, _ := newCaseHandlers()
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/complete", nil), "u1")
	rec := httptest.NewRecorder()
	h.Complete(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if cs.completeCalls != 1 {
		t.Errorf("calls: %d", cs.completeCalls)
	}
}

func TestCompleteHandler_NotFound(t *testing.T) {
	h, cs, _ := newCaseHandlers()
	cs.completeErr = ErrNotFound
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/complete", nil), "u1")
	rec := httptest.NewRecorder()
	h.Complete(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Errorf("status: %d want 404", rec.Code)
	}
}

// Round-trip JSON shape sanity — the wire format the mobile client
// sends must decode back to identical inputs after handler validation.
func TestSubmitChildren_PreservesPurposeOrder(t *testing.T) {
	h, _, chs := newCaseHandlers()
	body := `{"children":[
		{"status":"parenting","gender":"female","birth_date":"2023-04-21","purposes":["a","b","c"]},
		{"status":"pregnancy","gender":"unknown","due_date":"2026-11-02","purposes":["x","y"]}
	]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/children",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitChildren(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: %d", rec.Code)
	}
	if len(chs.lastInputs) != 2 {
		t.Fatalf("inputs: %+v", chs.lastInputs)
	}
	wantA := []string{"a", "b", "c"}
	wantX := []string{"x", "y"}
	if !equal(chs.lastInputs[0].Purposes, wantA) || !equal(chs.lastInputs[1].Purposes, wantX) {
		t.Errorf("purposes: %+v %+v", chs.lastInputs[0].Purposes, chs.lastInputs[1].Purposes)
	}
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// JSON null handling: the server should accept explicit null for optional
// fields without erroring. Encoded round-trip to verify.
func TestSubmitChildren_NullableFieldsPassThrough(t *testing.T) {
	h, _, chs := newCaseHandlers()
	type wire struct {
		Status             string   `json:"status"`
		Gender             string   `json:"gender"`
		BirthDate          *string  `json:"birth_date"`
		Name               *string  `json:"name"`
		Bio                *string  `json:"bio"`
		PhotoS3Key         *string  `json:"photo_s3_key"`
		Purposes           []string `json:"purposes"`
		IsDueDateUndecided bool     `json:"is_due_date_undecided"`
	}
	birth := "2023-04-21"
	body, _ := json.Marshal(map[string]any{
		"children": []wire{
			{Status: "parenting", Gender: "female", BirthDate: &birth, Purposes: []string{"d"}},
		},
	})
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/children",
		strings.NewReader(string(body))), "u1")
	rec := httptest.NewRecorder()
	h.SubmitChildren(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if chs.lastInputs[0].Name != nil || chs.lastInputs[0].Bio != nil || chs.lastInputs[0].PhotoS3Key != nil {
		t.Errorf("optional fields should be nil when omitted: %+v", chs.lastInputs[0])
	}
}
