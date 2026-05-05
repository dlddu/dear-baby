package onboarding

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/dlddu/dear-baby/backend/internal/storage"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

// fakePhotos satisfies PhotoStorage with simple maps. It records the
// call sequence so tests can assert rename order. The "missing object"
// case is exposed via the heads map: a key not present returns false
// from HeadObject.
type fakePhotos struct {
	prefix       string
	heads        map[string]bool
	copies       []string // "src->dst"
	deletes      []string
	headErr      error
	copyErr      error
	deleteErr    error
	presignErr   error
	presignedKey string // the key returned to PresignImagePut
}

func (p *fakePhotos) BuildChildPhotoTmpKey(userID, uuid string, format storage.ImageFormat) string {
	return p.prefix + "users/" + userID + "/onboarding-tmp/" + uuid + format.Extension()
}
func (p *fakePhotos) BuildChildPhotoKey(userID, childID string, format storage.ImageFormat) string {
	return p.prefix + "users/" + userID + "/children/" + childID + "/photo" + format.Extension()
}
func (p *fakePhotos) PresignImagePut(ctx context.Context, key string, format storage.ImageFormat) (storage.PresignedPut, error) {
	if p.presignErr != nil {
		return storage.PresignedPut{}, p.presignErr
	}
	p.presignedKey = key
	return storage.PresignedPut{URL: "https://example.com/upload", Method: "PUT", ContentType: format.ContentType(), MaxBytes: storage.MaxChildPhotoBytes}, nil
}
func (p *fakePhotos) IsValidChildPhotoTmpKey(userID, key string) bool {
	prefix := p.prefix + "users/" + userID + "/onboarding-tmp/"
	if !strings.HasPrefix(key, prefix) {
		return false
	}
	rest := key[len(prefix):]
	if rest == "" || strings.Contains(rest, "/") {
		return false
	}
	return strings.HasSuffix(strings.ToLower(rest), ".jpg") ||
		strings.HasSuffix(strings.ToLower(rest), ".heic") ||
		strings.HasSuffix(strings.ToLower(rest), ".png")
}
func (p *fakePhotos) HeadObject(ctx context.Context, key string) (bool, error) {
	if p.headErr != nil {
		return false, p.headErr
	}
	return p.heads[key], nil
}
func (p *fakePhotos) CopyObject(ctx context.Context, src, dst string) error {
	if p.copyErr != nil {
		return p.copyErr
	}
	p.copies = append(p.copies, src+"->"+dst)
	p.heads[dst] = true
	return nil
}
func (p *fakePhotos) DeleteObject(ctx context.Context, key string) error {
	if p.deleteErr != nil {
		return p.deleteErr
	}
	p.deletes = append(p.deletes, key)
	delete(p.heads, key)
	return nil
}

func newCaseHandlers(t *testing.T) (*Handlers, *fakePhotos, func()) {
	t.Helper()
	db := newTestDB(t)
	usersStore := &users.Store{DB: db}
	photos := &fakePhotos{prefix: "", heads: map[string]bool{}}
	gen := idGen()
	h := &Handlers{
		Store:  &Store{DB: db},
		Users:  usersStore,
		Photos: photos,
		IDGen:  gen,
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
	}
	return h, photos, func() { db.Close() }
}

func TestCreateChildPhotoUploadURL_Unauth(t *testing.T) {
	h, _, cleanup := newCaseHandlers(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodPost, "/onboarding/children/photo/upload-url", strings.NewReader(`{"format":"jpeg"}`))
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: %d want 401", rec.Code)
	}
}

func TestCreateChildPhotoUploadURL_Happy(t *testing.T) {
	h, _, cleanup := newCaseHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/children/photo/upload-url", strings.NewReader(`{"format":"heic"}`)), "u1")
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	var body struct {
		PhotoTmpKey string `json:"photo_tmp_key"`
		ContentType string `json:"content_type"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !strings.HasPrefix(body.PhotoTmpKey, "users/u1/onboarding-tmp/") {
		t.Errorf("key: %q", body.PhotoTmpKey)
	}
	if !strings.HasSuffix(body.PhotoTmpKey, ".heic") {
		t.Errorf("expected .heic suffix, got %q", body.PhotoTmpKey)
	}
	if body.ContentType != "image/heic" {
		t.Errorf("content_type: %q", body.ContentType)
	}
}

func TestSubmitCase_Unauth(t *testing.T) {
	h, _, cleanup := newCaseHandlers(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodPost, "/onboarding/case", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: %d want 401", rec.Code)
	}
}

func TestSubmitCase_HappyCaseA(t *testing.T) {
	h, _, cleanup := newCaseHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	body := `{"case":"A","children":[{"kind":"fetus","gender":"undecided","display_name":"튼튼이","pregnancy_weeks":17,"due_date":"2026-09-30","purposes":["book_making","memory_keeping"]}]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case", strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	var resp submitCaseResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.User == nil || resp.User.OnboardedAt == nil {
		t.Errorf("user.onboarded_at should be set")
	}
	if resp.User.CaseKind == nil || *resp.User.CaseKind != "A" {
		t.Errorf("case_kind: %v", resp.User.CaseKind)
	}
	if len(resp.Children) != 1 {
		t.Fatalf("children: %d", len(resp.Children))
	}
}

func TestSubmitCase_HappyCaseBWithPhoto(t *testing.T) {
	h, photos, cleanup := newCaseHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	// Pre-populate the head map so the rename succeeds.
	photos.heads["users/u1/onboarding-tmp/abc.jpg"] = true
	body := `{"case":"B","children":[
		{"kind":"child","gender":"female","display_name":"지유","birth_date":"2023-04-12","photo_tmp_key":"users/u1/onboarding-tmp/abc.jpg","purposes":["book_making"]},
		{"kind":"fetus","gender":"undecided","pregnancy_weeks":20,"due_date":"2026-10-01","purposes":["emotion_diary"]}
	]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case", strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if len(photos.copies) != 1 {
		t.Errorf("copies: %v want 1", photos.copies)
	}
	if len(photos.deletes) != 1 {
		t.Errorf("deletes: %v want 1", photos.deletes)
	}
}

func TestSubmitCase_RejectsForeignTmpKey(t *testing.T) {
	h, _, cleanup := newCaseHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")
	seedUserWithOnboarding(t, h.Store.DB, "u2", "c@d.com")

	body := `{"case":"C","children":[
		{"kind":"child","gender":"female","display_name":"지유","birth_date":"2023-04-12","photo_tmp_key":"users/u2/onboarding-tmp/abc.jpg","purposes":["book_making"]}
	]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case", strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestSubmitCase_HeadObjectMissingRollsBack(t *testing.T) {
	h, photos, cleanup := newCaseHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	// Pretend the upload never happened — head returns false.
	photos.heads = map[string]bool{}
	body := `{"case":"C","children":[
		{"kind":"child","gender":"female","display_name":"지유","birth_date":"2023-04-12","photo_tmp_key":"users/u1/onboarding-tmp/abc.jpg","purposes":["book_making"]}
	]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case", strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code == http.StatusOK {
		t.Errorf("expected error, got 200 body=%s", rec.Body.String())
	}

	// Verify nothing was committed.
	rows, err := h.Store.GetChildren(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get children: %v", err)
	}
	if len(rows) != 0 {
		t.Errorf("children should be rolled back, got %d", len(rows))
	}
}

func TestSubmitCase_RejectsBadCaseShape(t *testing.T) {
	h, _, cleanup := newCaseHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	body := `{"case":"A","children":[{"kind":"child","gender":"female","display_name":"x","birth_date":"2023-01-01","purposes":["book_making"]}]}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case", strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

// Avoid lint complaint about errors import being unused while letting the
// file evolve with new error-checking tests later.
var _ = errors.New
