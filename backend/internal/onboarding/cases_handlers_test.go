package onboarding

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/dlddu/dear-baby/backend/internal/storage"
)

// fakePhotos satisfies PhotoStorage with simple in-memory bookkeeping.
type fakePhotos struct {
	tmpKeys map[string]bool
	moveErr error
}

func newFakePhotos() *fakePhotos {
	return &fakePhotos{tmpKeys: map[string]bool{}}
}

func (f *fakePhotos) BuildChildPhotoTmpKey(userID, uploadID string, format storage.ImageFormat) string {
	k := "users/" + userID + "/onboarding-tmp/" + uploadID + format.Extension()
	f.tmpKeys[k] = true
	return k
}

func (f *fakePhotos) IsValidChildPhotoTmpKey(userID, key string) bool {
	prefix := "users/" + userID + "/onboarding-tmp/"
	return strings.HasPrefix(key, prefix) &&
		(strings.HasSuffix(key, ".jpg") ||
			strings.HasSuffix(key, ".heic") ||
			strings.HasSuffix(key, ".png"))
}

func (f *fakePhotos) PresignImagePut(ctx context.Context, key string, format storage.ImageFormat) (storage.PresignedPut, error) {
	return storage.PresignedPut{
		URL:         "https://s3.example.test/" + key,
		Method:      "PUT",
		ContentType: format.ContentType(),
		MaxBytes:    storage.MaxChildPhotoBytes,
	}, nil
}

func (f *fakePhotos) MoveChildPhoto(ctx context.Context, userID, childID, tmpKey string) (string, error) {
	if f.moveErr != nil {
		return "", f.moveErr
	}
	return "users/" + userID + "/children/" + childID + "/photo.jpg", nil
}

type fakeProfileFetcher struct {
	store *Store
}

func (f fakeProfileFetcher) GetProfileForUser(ctx context.Context, userID string) (any, error) {
	o, err := f.store.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	return o, nil
}

func newCaseHandlers(t *testing.T, userID string) (*CaseHandlers, *Store, *fakePhotos, func()) {
	t.Helper()
	db := newTestDB(t)
	if userID != "" {
		seedUserWithOnboarding(t, db, userID, userID+"@b.com")
	}
	store := &Store{DB: db}
	photos := newFakePhotos()
	h := &CaseHandlers{
		Store:        store,
		Photos:       photos,
		UsersUpdater: fakeProfileFetcher{store: store},
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
	}
	return h, store, photos, func() { db.Close() }
}

func TestCreateChildPhotoUploadURL_Defaults(t *testing.T) {
	h, _, photos, cleanup := newCaseHandlers(t, "u1")
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/children/photo/upload-url", nil), "u1")
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	var got map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	key, _ := got["photo_tmp_key"].(string)
	if !photos.IsValidChildPhotoTmpKey("u1", key) {
		t.Errorf("photo_tmp_key not in u1's tmp namespace: %q", key)
	}
}

func TestCreateChildPhotoUploadURL_Unauthorized(t *testing.T) {
	h, _, _, cleanup := newCaseHandlers(t, "")
	defer cleanup()

	req := httptest.NewRequest(http.MethodPost, "/onboarding/children/photo/upload-url", nil)
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: %d want 401", rec.Code)
	}
}

func TestCreateChildPhotoUploadURL_InvalidFormat(t *testing.T) {
	h, _, _, cleanup := newCaseHandlers(t, "u1")
	defer cleanup()

	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/children/photo/upload-url",
		strings.NewReader(`{"format":"gif"}`)), "u1")
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestSubmitCase_HappyCaseA(t *testing.T) {
	h, store, _, cleanup := newCaseHandlers(t, "u1")
	defer cleanup()

	body := `{
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
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	o, err := store.GetByID(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.CaseKind == nil || *o.CaseKind != CaseA {
		t.Errorf("case_kind: %v", o.CaseKind)
	}
	if o.OnboardedAt == nil {
		t.Errorf("onboarded_at should be stamped")
	}
	children, err := store.ListChildren(context.Background(), "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(children) != 1 || children[0].Kind != ChildKindFetus {
		t.Errorf("children: %+v", children)
	}
}

func TestSubmitCase_HappyCaseBWithPhoto(t *testing.T) {
	h, store, photos, cleanup := newCaseHandlers(t, "u1")
	defer cleanup()

	tmpKey := photos.BuildChildPhotoTmpKey("u1", "abc", storage.ImageFormatJPEG)

	body := `{
		"case": "B",
		"children": [
			{
				"kind": "child",
				"display_name": "지유",
				"gender": "female",
				"birth_date": "2023-04-12",
				"introduction": "잘 웃는 첫째",
				"photo_tmp_key": "` + tmpKey + `",
				"purposes": ["book_making", "memory_keeping"]
			},
			{
				"kind": "fetus",
				"display_name": "튼튼이",
				"gender": "undecided",
				"pregnancy_weeks": 12,
				"due_date": "2026-12-01",
				"purposes": ["emotion_diary"]
			}
		]
	}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	children, err := store.ListChildren(context.Background(), "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(children) != 2 {
		t.Fatalf("children: got %d want 2", len(children))
	}
	if children[0].Kind != ChildKindChild || children[1].Kind != ChildKindFetus {
		t.Errorf("kind order: %v %v", children[0].Kind, children[1].Kind)
	}
	if children[0].PhotoS3Key == nil {
		t.Errorf("first child should have photo set after rename")
	}
	if len(children[0].Purposes) != 2 || len(children[1].Purposes) != 1 {
		t.Errorf("per-child purposes count")
	}
}

func TestSubmitCase_RejectsCaseAWithChildKind(t *testing.T) {
	h, _, _, cleanup := newCaseHandlers(t, "u1")
	defer cleanup()

	body := `{
		"case": "A",
		"children": [
			{
				"kind": "child",
				"display_name": "지유",
				"gender": "female",
				"birth_date": "2023-04-12",
				"purposes": ["book_making"]
			}
		]
	}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestSubmitCase_RejectsForeignTmpKey(t *testing.T) {
	h, _, _, cleanup := newCaseHandlers(t, "u1")
	defer cleanup()

	body := `{
		"case": "C",
		"children": [
			{
				"kind": "child",
				"display_name": "지유",
				"gender": "female",
				"birth_date": "2023-04-12",
				"photo_tmp_key": "users/OTHER/onboarding-tmp/abc.jpg",
				"purposes": ["book_making"]
			}
		]
	}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestSubmitCase_Unauthorized(t *testing.T) {
	h, _, _, cleanup := newCaseHandlers(t, "")
	defer cleanup()
	req := httptest.NewRequest(http.MethodPost, "/onboarding/case", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: %d want 401", rec.Code)
	}
}

func TestSubmitCase_RejectsCaseBWithoutBoth(t *testing.T) {
	h, _, _, cleanup := newCaseHandlers(t, "u1")
	defer cleanup()
	body := `{
		"case": "B",
		"children": [
			{
				"kind": "child",
				"display_name": "지유",
				"gender": "female",
				"birth_date": "2023-04-12",
				"purposes": ["book_making"]
			}
		]
	}`
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case",
		strings.NewReader(body)), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}
