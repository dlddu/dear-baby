package onboarding

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/storage"
)

// stubPhoto is a PhotoStorage that records calls and consults a small
// in-memory key set for HEAD checks. Lets handler tests run without
// real S3.
type stubPhoto struct {
	prefix     string
	exists     map[string]bool
	copies     map[string]string
	deleted    []string
	tmpHandled string
}

func newStubPhoto() *stubPhoto {
	return &stubPhoto{
		exists:  make(map[string]bool),
		copies:  make(map[string]string),
		deleted: []string{},
	}
}

func (s *stubPhoto) BuildChildPhotoTmpKey(userID, photoID string, format storage.ImageFormat) string {
	return userID + "/onboarding-tmp/" + photoID + format.Extension()
}

func (s *stubPhoto) BuildChildPhotoKey(userID, childID, ext string) string {
	return userID + "/children/" + childID + "/photo." + ext
}

func (s *stubPhoto) PresignImagePut(_ context.Context, key string, format storage.ImageFormat) (storage.PresignedPut, error) {
	return storage.PresignedPut{
		URL:         "https://s3.example/" + key,
		Method:      "PUT",
		ExpiresAt:   time.Now().Add(5 * time.Minute),
		ContentType: format.ContentType(),
		MaxBytes:    storage.MaxChildPhotoBytes,
	}, nil
}

func (s *stubPhoto) IsValidChildPhotoTmpKey(userID, key string) bool {
	return strings.HasPrefix(key, userID+"/onboarding-tmp/")
}

func (s *stubPhoto) HeadObject(_ context.Context, key string) (bool, error) {
	return s.exists[key], nil
}

func (s *stubPhoto) CopyObject(_ context.Context, src, dst string) error {
	s.copies[src] = dst
	s.exists[dst] = true
	s.tmpHandled = src
	return nil
}

func (s *stubPhoto) DeleteObject(_ context.Context, key string) error {
	delete(s.exists, key)
	s.deleted = append(s.deleted, key)
	return nil
}

func (s *stubPhoto) PhotoExtensionFromTmpKey(key string) (string, bool) {
	idx := strings.LastIndexByte(key, '.')
	if idx < 0 || idx == len(key)-1 {
		return "", false
	}
	return strings.ToLower(key[idx+1:]), true
}

func newCaseHandlers(t *testing.T) (*CaseHandlers, *stubPhoto) {
	t.Helper()
	db := newTestDB(t)
	t.Cleanup(func() { db.Close() })
	photo := newStubPhoto()
	return &CaseHandlers{
		Store: &Store{DB: db},
		Photo: photo,
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
	}, photo
}

func TestCreateChildPhotoUploadURL_Happy(t *testing.T) {
	h, _ := newCaseHandlers(t)
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/children/photo/upload-url",
		strings.NewReader(`{"format":"jpeg"}`)), "u1")
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	var got struct {
		URL         string `json:"upload_url"`
		ContentType string `json:"content_type"`
		PhotoTmpKey string `json:"photo_tmp_key"`
		MaxBytes    int64  `json:"max_bytes"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.ContentType != "image/jpeg" {
		t.Errorf("content_type: %q", got.ContentType)
	}
	if !strings.HasPrefix(got.PhotoTmpKey, "u1/onboarding-tmp/") {
		t.Errorf("photo_tmp_key: %q", got.PhotoTmpKey)
	}
	if got.MaxBytes != storage.MaxChildPhotoBytes {
		t.Errorf("max_bytes: %d", got.MaxBytes)
	}
}

func TestCreateChildPhotoUploadURL_Unauthorized(t *testing.T) {
	h, _ := newCaseHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/onboarding/children/photo/upload-url",
		strings.NewReader(`{"format":"jpeg"}`))
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: %d want 401", rec.Code)
	}
}

func TestCreateChildPhotoUploadURL_BadFormat(t *testing.T) {
	h, _ := newCaseHandlers(t)
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")
	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/children/photo/upload-url",
		strings.NewReader(`{"format":"gif"}`)), "u1")
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestSubmitCase_CaseA(t *testing.T) {
	h, _ := newCaseHandlers(t)
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	body := `{
	  "case": "A",
	  "children": [{
	    "kind": "fetus",
	    "display_name": "튼튼이",
	    "gender": "undecided",
	    "pregnancy_weeks": 17,
	    "due_date": "2026-09-30",
	    "purposes": ["book_making", "emotion_diary"]
	  }]
	}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	got, err := h.Store.GetCaseOnboarding(req.Context(), "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Onboarding.CaseKind == nil || *got.Onboarding.CaseKind != CaseA {
		t.Errorf("case_kind: %v", got.Onboarding.CaseKind)
	}
	if got.Onboarding.OnboardedAt == nil {
		t.Error("onboarded_at should be set")
	}
	if len(got.Children) != 1 || got.Children[0].Kind != ChildKindFetus {
		t.Errorf("children: %+v", got.Children)
	}
}

func TestSubmitCase_CaseB_RequiresBoth(t *testing.T) {
	h, _ := newCaseHandlers(t)
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	// case=B but only one fetus → should fail validation.
	body := `{
	  "case": "B",
	  "children": [{
	    "kind": "fetus",
	    "gender": "undecided",
	    "pregnancy_weeks": 17,
	    "due_date": "2026-09-30",
	    "purposes": ["book_making"]
	  }]
	}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestSubmitCase_CaseC(t *testing.T) {
	h, _ := newCaseHandlers(t)
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	body := `{
	  "case": "C",
	  "children": [
	    {"kind":"child","display_name":"첫째","gender":"male","birth_date":"2020-01-01","purposes":["memory_keeping"]},
	    {"kind":"child","display_name":"둘째","gender":"female","birth_date":"2022-06-15","purposes":["memory_keeping"]}
	  ]
	}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestSubmitCase_PhotoTmpKeyOwnershipEnforced(t *testing.T) {
	h, _ := newCaseHandlers(t)
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")
	seedUserWithOnboarding(t, h.Store.DB, "u2", "c@d.com")

	// u2's tmp key — must not be accepted in u1's submission.
	body := `{
	  "case": "C",
	  "children": [{
	    "kind":"child","display_name":"첫째","gender":"male",
	    "birth_date":"2020-01-01","purposes":["memory_keeping"],
	    "photo_tmp_key":"u2/onboarding-tmp/foo.jpg"
	  }]
	}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestSubmitCase_PhotoMissingInS3(t *testing.T) {
	h, photo := newCaseHandlers(t)
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")
	// Note: NOT adding the key to photo.exists.

	body := `{
	  "case": "C",
	  "children": [{
	    "kind":"child","display_name":"첫째","gender":"male",
	    "birth_date":"2020-01-01","purposes":["memory_keeping"],
	    "photo_tmp_key":"u1/onboarding-tmp/abc.jpg"
	  }]
	}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	// HEAD says missing → 5xx (genuine server-side rename failure).
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if photo.tmpHandled != "" {
		t.Errorf("copy should not have run: %v", photo.copies)
	}
	// Onboarding row should remain not-onboarded.
	got, err := h.Store.GetByID(req.Context(), "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.OnboardedAt != nil {
		t.Error("onboarded_at should not be set after rollback")
	}
}

func TestSubmitCase_PhotoRenameOnSuccess(t *testing.T) {
	h, photo := newCaseHandlers(t)
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")
	tmpKey := "u1/onboarding-tmp/abc.jpg"
	photo.exists[tmpKey] = true

	body := `{
	  "case": "C",
	  "children": [{
	    "kind":"child","display_name":"아이","gender":"male",
	    "birth_date":"2024-01-01","purposes":["memory_keeping"],
	    "photo_tmp_key":"u1/onboarding-tmp/abc.jpg"
	  }]
	}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if _, ok := photo.copies[tmpKey]; !ok {
		t.Errorf("expected copy from %s, got %v", tmpKey, photo.copies)
	}
	if len(photo.deleted) != 1 || photo.deleted[0] != tmpKey {
		t.Errorf("expected delete of %s, got %v", tmpKey, photo.deleted)
	}
}

func TestSubmitCase_InvalidCaseKind(t *testing.T) {
	h, _ := newCaseHandlers(t)
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(`{"case":"D","children":[{"kind":"child","gender":"male","birth_date":"2024-01-01","purposes":["memory_keeping"],"display_name":"a"}]}`)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestSubmitCase_FetusBirthDateRejected(t *testing.T) {
	h, _ := newCaseHandlers(t)
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")
	body := `{
	  "case":"A",
	  "children":[{
	    "kind":"fetus","gender":"undecided",
	    "pregnancy_weeks":17,"due_date":"2026-09-30",
	    "birth_date":"2024-01-01",
	    "purposes":["book_making"]
	  }]
	}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}
