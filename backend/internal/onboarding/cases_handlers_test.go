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
)

// fakePhotos satisfies PhotoStorage without the AWS SDK. It keeps a
// minimal in-memory set of "uploaded" objects so tests can drive the
// HeadObject + CopyObject + DeleteObject path the SubmitCase handler
// follows during a real submission.
type fakePhotos struct {
	prefix         string
	objects        map[string]struct{}
	headErr        error
	copyErr        error
	deleteErr      error
	presignURL     string
	presignFails   bool
	deletedKeys    []string
	copiedKeys     []string
	headCalls      int
	presignCalls   int
	uploadURLCalls int
}

func newFakePhotos(prefix string) *fakePhotos {
	return &fakePhotos{
		prefix:     prefix,
		objects:    map[string]struct{}{},
		presignURL: "https://example.invalid/upload",
	}
}

func (f *fakePhotos) BuildChildPhotoTmpKey(userID, uuid string, format storage.ImageFormat) string {
	return f.prefix + "users/" + userID + "/onboarding-tmp/" + uuid + format.Extension()
}

func (f *fakePhotos) BuildChildPhotoKey(userID, childID string, format storage.ImageFormat) string {
	return f.prefix + "users/" + userID + "/children/" + childID + "/photo" + format.Extension()
}

func (f *fakePhotos) IsValidChildPhotoTmpKey(userID, key string) bool {
	want := f.prefix + "users/" + userID + "/onboarding-tmp/"
	if !strings.HasPrefix(key, want) {
		return false
	}
	tail := key[len(want):]
	if tail == "" || strings.ContainsAny(tail, "/\\") {
		return false
	}
	return true
}

func (f *fakePhotos) PresignImagePut(ctx context.Context, key string, format storage.ImageFormat) (storage.PresignedPut, error) {
	f.presignCalls++
	if f.presignFails {
		return storage.PresignedPut{}, errors.New("presign fail")
	}
	return storage.PresignedPut{
		URL:         f.presignURL + "?key=" + key,
		Method:      http.MethodPut,
		ContentType: format.ContentType(),
		MaxBytes:    storage.MaxChildPhotoBytes,
	}, nil
}

func (f *fakePhotos) HeadObject(ctx context.Context, key string) (bool, error) {
	f.headCalls++
	if f.headErr != nil {
		return false, f.headErr
	}
	_, ok := f.objects[key]
	return ok, nil
}

func (f *fakePhotos) CopyObject(ctx context.Context, srcKey, dstKey string) error {
	if f.copyErr != nil {
		return f.copyErr
	}
	if _, ok := f.objects[srcKey]; !ok {
		return errors.New("source missing")
	}
	f.objects[dstKey] = struct{}{}
	f.copiedKeys = append(f.copiedKeys, dstKey)
	return nil
}

func (f *fakePhotos) DeleteObject(ctx context.Context, key string) error {
	if f.deleteErr != nil {
		return f.deleteErr
	}
	delete(f.objects, key)
	f.deletedKeys = append(f.deletedKeys, key)
	return nil
}

func newCaseHandlers(t *testing.T, photos *fakePhotos) (*Handlers, func()) {
	t.Helper()
	db := newTestDB(t)
	h := &Handlers{
		Store:  &Store{DB: db},
		Photos: photos,
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
		ProfileFn: func(ctx context.Context, uid string) (any, error) {
			return map[string]any{"id": uid}, nil
		},
	}
	return h, func() { db.Close() }
}

func TestCreateChildPhotoUploadURL_Happy(t *testing.T) {
	photos := newFakePhotos("prod/")
	h, cleanup := newCaseHandlers(t, photos)
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/children/photo/upload-url",
		strings.NewReader(`{"format":"jpeg"}`)), "u1")
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	var body uploadURLResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !strings.HasPrefix(body.PhotoTmpKey, "prod/users/u1/onboarding-tmp/") {
		t.Errorf("tmp key: %q", body.PhotoTmpKey)
	}
	if !strings.HasSuffix(body.PhotoTmpKey, ".jpg") {
		t.Errorf("tmp key extension: %q", body.PhotoTmpKey)
	}
	if body.URL == "" || body.ContentType != "image/jpeg" {
		t.Errorf("envelope: %+v", body)
	}
	if photos.presignCalls != 1 {
		t.Errorf("presign calls: %d want 1", photos.presignCalls)
	}
}

func TestCreateChildPhotoUploadURL_DefaultFormat(t *testing.T) {
	photos := newFakePhotos("prod/")
	h, cleanup := newCaseHandlers(t, photos)
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/children/photo/upload-url", nil), "u1")
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d", rec.Code)
	}
}

func TestCreateChildPhotoUploadURL_UnsupportedFormat(t *testing.T) {
	photos := newFakePhotos("prod/")
	h, cleanup := newCaseHandlers(t, photos)
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/children/photo/upload-url",
		strings.NewReader(`{"format":"gif"}`)), "u1")
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestCreateChildPhotoUploadURL_Unauth(t *testing.T) {
	photos := newFakePhotos("prod/")
	h, cleanup := newCaseHandlers(t, photos)
	defer cleanup()

	req := httptest.NewRequest(http.MethodPost,
		"/onboarding/children/photo/upload-url", nil)
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: %d want 401", rec.Code)
	}
}

func TestCreateChildPhotoUploadURL_NoStorage(t *testing.T) {
	h, cleanup := newCaseHandlers(t, nil)
	defer cleanup()
	h.Photos = nil // explicit

	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/children/photo/upload-url", nil), "u1")
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status: %d want 503", rec.Code)
	}
}

const validCaseAPayload = `{
    "case": "A",
    "children": [
      {
        "kind": "fetus",
        "display_name": "튼튼이",
        "gender": "undecided",
        "pregnancy_weeks": 17,
        "due_date": "2026-09-30",
        "purposes": ["book_making", "emotion_diary"]
      }
    ]
  }`

func TestSubmitCase_HappyCaseA(t *testing.T) {
	photos := newFakePhotos("prod/")
	h, cleanup := newCaseHandlers(t, photos)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/case", strings.NewReader(validCaseAPayload)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	var body caseSubmissionResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Children) != 1 || body.Children[0].Kind != ChildKindFetus {
		t.Errorf("children: %+v", body.Children)
	}
	o, err := h.Store.GetByID(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get onboarding: %v", err)
	}
	if o.CaseKind == nil || *o.CaseKind != "A" {
		t.Errorf("case_kind: %v", o.CaseKind)
	}
	if o.OnboardedAt == nil {
		t.Error("onboarded_at must be stamped")
	}
}

func TestSubmitCase_HappyCaseCWithPhoto(t *testing.T) {
	photos := newFakePhotos("prod/")
	h, cleanup := newCaseHandlers(t, photos)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	tmpKey := "prod/users/u1/onboarding-tmp/abcd-1234.jpg"
	photos.objects[tmpKey] = struct{}{}

	payload := `{
        "case": "C",
        "children": [
          {
            "kind": "child",
            "display_name": "지유",
            "gender": "female",
            "birth_date": "2023-04-12",
            "photo_tmp_key": "` + tmpKey + `",
            "purposes": ["family_share"]
          }
        ]
      }`
	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/case", strings.NewReader(payload)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	var body caseSubmissionResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Children) != 1 {
		t.Fatalf("children: %+v", body.Children)
	}
	got := body.Children[0]
	if got.PhotoS3Key == nil {
		t.Fatal("photo_s3_key should be set on response")
	}
	wantFinal := "prod/users/u1/children/" + got.ID + "/photo.jpg"
	if *got.PhotoS3Key != wantFinal {
		t.Errorf("final key: got %q want %q", *got.PhotoS3Key, wantFinal)
	}
	// Tmp deleted post-commit.
	if len(photos.deletedKeys) != 1 || photos.deletedKeys[0] != tmpKey {
		t.Errorf("delete: %v", photos.deletedKeys)
	}
}

func TestSubmitCase_RejectsForeignTmpKey(t *testing.T) {
	photos := newFakePhotos("prod/")
	h, cleanup := newCaseHandlers(t, photos)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")
	otherKey := "prod/users/other/onboarding-tmp/abcd.jpg"
	photos.objects[otherKey] = struct{}{}

	payload := `{
        "case": "C",
        "children": [
          {
            "kind": "child",
            "display_name": "지유",
            "gender": "female",
            "birth_date": "2023-04-12",
            "photo_tmp_key": "` + otherKey + `",
            "purposes": ["family_share"]
          }
        ]
      }`
	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/case", strings.NewReader(payload)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400 body=%s", rec.Code, rec.Body.String())
	}
	o, err := h.Store.GetByID(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get onboarding: %v", err)
	}
	if o.CaseKind != nil {
		t.Error("case_kind must remain unset after rejection")
	}
}

func TestSubmitCase_RejectsMissingS3Object(t *testing.T) {
	photos := newFakePhotos("prod/")
	h, cleanup := newCaseHandlers(t, photos)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	tmpKey := "prod/users/u1/onboarding-tmp/abcd-1234.jpg"
	// not seeded into photos.objects → HeadObject returns false

	payload := `{
        "case": "C",
        "children": [
          {
            "kind": "child",
            "display_name": "지유",
            "gender": "female",
            "birth_date": "2023-04-12",
            "photo_tmp_key": "` + tmpKey + `",
            "purposes": ["family_share"]
          }
        ]
      }`
	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/case", strings.NewReader(payload)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestSubmitCase_RejectsCaseBSingleStage(t *testing.T) {
	photos := newFakePhotos("prod/")
	h, cleanup := newCaseHandlers(t, photos)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	payload := `{
        "case": "B",
        "children": [
          {
            "kind": "fetus",
            "display_name": "튼튼이",
            "gender": "undecided",
            "pregnancy_weeks": 17,
            "due_date": "2026-09-30",
            "purposes": ["book_making"]
          }
        ]
      }`
	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/case", strings.NewReader(payload)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestSubmitCase_Unauth(t *testing.T) {
	photos := newFakePhotos("prod/")
	h, cleanup := newCaseHandlers(t, photos)
	defer cleanup()
	req := httptest.NewRequest(http.MethodPost,
		"/onboarding/case", strings.NewReader(validCaseAPayload))
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: %d want 401", rec.Code)
	}
}

func TestSubmitCase_RejectsExtraFields(t *testing.T) {
	photos := newFakePhotos("prod/")
	h, cleanup := newCaseHandlers(t, photos)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	payload := `{
        "case": "A",
        "extra": "trip wire",
        "children": []
      }`
	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/case", strings.NewReader(payload)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}
