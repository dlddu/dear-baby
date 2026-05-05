package onboarding

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"github.com/dlddu/dear-baby/backend/internal/storage"
	"github.com/dlddu/dear-baby/backend/internal/tasks"
	"github.com/dlddu/dear-baby/backend/internal/users"
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

// fakePhotoStorage records every interaction so tests can assert
// rename + cleanup behavior. Holds a small in-memory "S3" of present
// keys so HeadObject can return realistic results.
type fakePhotoStorage struct {
	keyPrefix      string
	present        map[string]struct{}
	copies         [][2]string
	deletes        []string
	failHead       bool
	failCopy       bool
	uploadKeyOverride string
}

func newFakePhotos() *fakePhotoStorage {
	return &fakePhotoStorage{
		keyPrefix: "test/",
		present:   make(map[string]struct{}),
	}
}

func (f *fakePhotoStorage) BuildChildPhotoTmpKey(userID, uuidStr string, format storage.ImageFormat) string {
	if f.uploadKeyOverride != "" {
		return f.uploadKeyOverride
	}
	return f.keyPrefix + "users/" + userID + "/onboarding-tmp/" + uuidStr + format.Extension()
}

func (f *fakePhotoStorage) BuildChildPhotoKey(userID, childID string, format storage.ImageFormat) string {
	return f.keyPrefix + "users/" + userID + "/children/" + childID + "/photo" + format.Extension()
}

func (f *fakePhotoStorage) IsValidChildPhotoTmpKey(userID, key string) bool {
	prefix := f.keyPrefix + "users/" + userID + "/onboarding-tmp/"
	if !strings.HasPrefix(key, prefix) {
		return false
	}
	tail := strings.ToLower(key[len(prefix):])
	if strings.Contains(tail, "/") {
		return false
	}
	return strings.HasSuffix(tail, ".jpg") ||
		strings.HasSuffix(tail, ".jpeg") ||
		strings.HasSuffix(tail, ".png") ||
		strings.HasSuffix(tail, ".heic")
}

func (f *fakePhotoStorage) PresignImagePut(ctx context.Context, key string, format storage.ImageFormat) (storage.PresignedPut, error) {
	return storage.PresignedPut{
		URL:         "https://s3.example/" + key,
		Method:      "PUT",
		ContentType: format.ContentType(),
		MaxBytes:    storage.MaxChildPhotoBytes,
	}, nil
}

func (f *fakePhotoStorage) HeadObject(ctx context.Context, key string) (bool, error) {
	if f.failHead {
		return false, errors.New("head fails")
	}
	_, ok := f.present[key]
	return ok, nil
}

func (f *fakePhotoStorage) CopyObject(ctx context.Context, src, dst string) error {
	if f.failCopy {
		return errors.New("copy fails")
	}
	f.copies = append(f.copies, [2]string{src, dst})
	f.present[dst] = struct{}{}
	return nil
}

func (f *fakePhotoStorage) DeleteObject(ctx context.Context, key string) error {
	f.deletes = append(f.deletes, key)
	delete(f.present, key)
	return nil
}

// newSubmitHandlers wires Store, Users, and a fake PhotoStorage so the
// SubmitCase tests can exercise the end-to-end path without a real S3.
func newSubmitHandlers(t *testing.T) (*Handlers, *fakePhotoStorage, func()) {
	t.Helper()
	db := newTestDB(t)
	photos := newFakePhotos()
	h := &Handlers{
		Store:  &Store{DB: db},
		Users:  &users.Store{DB: db},
		Photos: photos,
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
	}
	return h, photos, func() { db.Close() }
}

func TestSubmitCase_HappyA(t *testing.T) {
	h, _, cleanup := newSubmitHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	body, _ := json.Marshal(caseAFixture())
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case", strings.NewReader(string(body))), "u1")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	var got caseSubmissionResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got.Children) != 1 || got.Children[0].Kind != KindFetus {
		t.Errorf("children: %+v", got.Children)
	}
	if got.User == nil || got.User.CaseKind == nil || *got.User.CaseKind != "A" {
		t.Errorf("profile case_kind: got %+v", got.User)
	}
}

func TestSubmitCase_HappyBWithPhoto(t *testing.T) {
	h, photos, cleanup := newSubmitHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	tmpKey := "test/users/u1/onboarding-tmp/abc.jpg"
	photos.present[tmpKey] = struct{}{}

	sub := caseBFixture()
	sub.Children[0].PhotoTmpKey = strPtr(tmpKey)
	body, _ := json.Marshal(sub)
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case", strings.NewReader(string(body))), "u1")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	if len(photos.copies) != 1 {
		t.Errorf("copies: %d want 1", len(photos.copies))
	}
	if len(photos.deletes) != 1 || photos.deletes[0] != tmpKey {
		t.Errorf("deletes: %v want [%s]", photos.deletes, tmpKey)
	}
	var got caseSubmissionResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Children[0].PhotoS3Key == nil ||
		!strings.HasSuffix(*got.Children[0].PhotoS3Key, "/photo.jpg") {
		t.Errorf("photo_s3_key: %v", got.Children[0].PhotoS3Key)
	}
}

func TestSubmitCase_RejectsForgedPhotoKey(t *testing.T) {
	h, _, cleanup := newSubmitHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	sub := caseCFixture()
	// Different user namespace.
	sub.Children[0].PhotoTmpKey = strPtr("test/users/attacker/onboarding-tmp/abc.jpg")
	body, _ := json.Marshal(sub)
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case", strings.NewReader(string(body))), "u1")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestSubmitCase_PhotoNotInS3(t *testing.T) {
	h, _, cleanup := newSubmitHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	sub := caseCFixture()
	// Valid key shape, but S3 has no object.
	sub.Children[0].PhotoTmpKey = strPtr("test/users/u1/onboarding-tmp/abc.jpg")
	body, _ := json.Marshal(sub)
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case", strings.NewReader(string(body))), "u1")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400 body=%s", rec.Code, rec.Body.String())
	}
	// And the DB should be untouched.
	o, err := h.Store.GetByID(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.CaseKind != nil || o.OnboardedAt != nil {
		t.Errorf("partial commit: %+v", o)
	}
}

func TestSubmitCase_ValidationFailure(t *testing.T) {
	h, _, cleanup := newSubmitHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	bad := caseAFixture()
	bad.Case = "X" // unknown
	body, _ := json.Marshal(bad)
	req := withUser(httptest.NewRequest(http.MethodPost, "/onboarding/case", strings.NewReader(string(body))), "u1")
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestSubmitCase_Unauth(t *testing.T) {
	h, _, cleanup := newSubmitHandlers(t)
	defer cleanup()
	body, _ := json.Marshal(caseAFixture())
	req := httptest.NewRequest(http.MethodPost, "/onboarding/case", strings.NewReader(string(body)))
	rec := httptest.NewRecorder()
	h.SubmitCase(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: %d want 401", rec.Code)
	}
}

func TestCreateChildPhotoUploadURL_Happy(t *testing.T) {
	h, _, cleanup := newSubmitHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/children/photo/upload-url",
		strings.NewReader(`{"format":"jpeg"}`)), "u1")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
	var got photoUploadURLResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !strings.Contains(got.PhotoTmpKey, "users/u1/onboarding-tmp/") ||
		!strings.HasSuffix(got.PhotoTmpKey, ".jpg") {
		t.Errorf("photo_tmp_key shape: %q", got.PhotoTmpKey)
	}
	if got.URL == "" || got.ContentType != "image/jpeg" {
		t.Errorf("presigned: %+v", got)
	}
}

func TestCreateChildPhotoUploadURL_UnsupportedFormat(t *testing.T) {
	h, _, cleanup := newSubmitHandlers(t)
	defer cleanup()
	seedUserWithOnboarding(t, h.Store.DB, "u1", "a@b.com")

	req := withUser(httptest.NewRequest(http.MethodPost,
		"/onboarding/children/photo/upload-url",
		strings.NewReader(`{"format":"bmp"}`)), "u1")
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: %d want 400", rec.Code)
	}
}

func TestCreateChildPhotoUploadURL_Unauth(t *testing.T) {
	h, _, cleanup := newSubmitHandlers(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodPost,
		"/onboarding/children/photo/upload-url",
		strings.NewReader(`{"format":"jpeg"}`))
	rec := httptest.NewRecorder()
	h.CreateChildPhotoUploadURL(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: %d want 401", rec.Code)
	}
}
