package records

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	_ "modernc.org/sqlite"

	"github.com/dlddu/dear-baby/backend/internal/storage"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

type ctxKeyUser struct{}

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	db.SetMaxOpenConns(1)
	schema := `
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  picture_url TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE onboarding (
  user_id                      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  due_date                     TEXT,
  onboarded_at                 TEXT,
  voice_coachmark_dismissed_at TEXT,
  first_record_at              TEXT,
  ai_preview                   TEXT,
  updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE records (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'text' CHECK(source IN ('text','voice')),
  audio_s3_key TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("schema: %v", err)
	}
	return db
}

func seedUser(t *testing.T, db *sql.DB, id, email string) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES (?, ?)`, id, email); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO onboarding (user_id) VALUES (?)`, id); err != nil {
		t.Fatalf("seed onboarding: %v", err)
	}
}

// fakeAudio satisfies AudioStorage without touching AWS. It mimics the
// canonical key builder so handlers exercise the same prefix-validation
// path as in production.
type fakeAudio struct {
	prefix    string
	objects   map[string]bool
	headErr   error
	presigned int
}

func (f *fakeAudio) BuildRecordAudioKey(userID, recordID string) string {
	return fmt.Sprintf("%susers/%s/records/%s.m4a", f.prefix, userID, recordID)
}

func (f *fakeAudio) IsValidRecordAudioKey(userID, recordID, key string) bool {
	return key != "" && key == f.BuildRecordAudioKey(userID, recordID)
}

func (f *fakeAudio) PresignPut(_ context.Context, key string) (storage.PresignedPut, error) {
	f.presigned++
	return storage.PresignedPut{
		URL:         "https://s3.example/" + key,
		Method:      http.MethodPut,
		ExpiresAt:   time.Now().Add(5 * time.Minute),
		ContentType: storage.AudioContentType,
		MaxBytes:    storage.MaxAudioBytes,
	}, nil
}

func (f *fakeAudio) HeadObject(_ context.Context, key string) (bool, error) {
	if f.headErr != nil {
		return false, f.headErr
	}
	return f.objects[key], nil
}

func newHandlers(t *testing.T, uid string) (*Handlers, *sql.DB, *fakeAudio) {
	t.Helper()
	db := newTestDB(t)
	if uid != "" {
		seedUser(t, db, uid, uid+"@b.com")
	}
	audio := &fakeAudio{prefix: "test/", objects: map[string]bool{}}
	return &Handlers{
		Store: &Store{DB: db},
		Users: &users.Store{DB: db},
		Audio: audio,
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
	}, db, audio
}

func withUser(r *http.Request, uid string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), ctxKeyUser{}, uid))
}

func post(t *testing.T, h *Handlers, uid, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/records", bytes.NewBufferString(body))
	if uid != "" {
		req = withUser(req, uid)
	}
	rec := httptest.NewRecorder()
	h.Create(rec, req)
	return rec
}

// -- POST /records ----------------------------------------------------------

func TestCreate_HappyPath_StampsFirstRecordAt(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"엄마가 너에게 전하고 싶은 말"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got createResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Record == nil || got.Record.ID == "" {
		t.Error("record missing")
	}
	if got.Record.Source != SourceText {
		t.Errorf("source: got %q want %q", got.Record.Source, SourceText)
	}
	if got.Record.AudioS3Key != nil {
		t.Errorf("audio_s3_key: expected null, got %v", *got.Record.AudioS3Key)
	}
	if got.User == nil || got.User.FirstRecordAt == nil {
		t.Fatal("user.first_record_at should be stamped")
	}
}

func TestCreate_VoiceSource_AudioKeyStartsNull(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"오늘 아기가 처음 움직였어요","source":"voice"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got createResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Record.Source != SourceVoice {
		t.Errorf("source: got %q want %q", got.Record.Source, SourceVoice)
	}
	if got.Record.AudioS3Key != nil {
		t.Errorf("voice records should start without audio_s3_key")
	}
	if got.User.FirstRecordAt == nil {
		t.Fatal("first_record_at should fire for voice records too")
	}
}

func TestCreate_InvalidSource_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"x","source":"audio"}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestCreate_AfterReset_ReusesOldestExistingRecord(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	old := "2023-01-02 03:04:05"
	if _, err := db.Exec(`
		INSERT INTO records (id, user_id, content, source, created_at)
		VALUES ('r0', 'u1', 'old', 'text', ?)
	`, old); err != nil {
		t.Fatalf("seed old record: %v", err)
	}

	rec := post(t, h, "u1", `{"content":"new"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got createResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.User == nil || got.User.FirstRecordAt == nil {
		t.Fatal("first_record_at should be set")
	}
	wantT, _ := time.Parse("2006-01-02 15:04:05", old)
	if !got.User.FirstRecordAt.Equal(wantT) {
		t.Errorf("first_record_at: got %v want %v (oldest record's created_at)",
			got.User.FirstRecordAt, wantT)
	}
}

func TestCreate_SecondRecord_PreservesFirstRecordAt(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	r1 := post(t, h, "u1", `{"content":"one"}`)
	if r1.Code != http.StatusCreated {
		t.Fatalf("first: %d %s", r1.Code, r1.Body.String())
	}
	var first createResponse
	if err := json.Unmarshal(r1.Body.Bytes(), &first); err != nil {
		t.Fatalf("decode first: %v", err)
	}
	stamped := *first.User.FirstRecordAt

	r2 := post(t, h, "u1", `{"content":"two"}`)
	if r2.Code != http.StatusCreated {
		t.Fatalf("second: %d %s", r2.Code, r2.Body.String())
	}
	var second createResponse
	if err := json.Unmarshal(r2.Body.Bytes(), &second); err != nil {
		t.Fatalf("decode second: %v", err)
	}
	if !second.User.FirstRecordAt.Equal(stamped) {
		t.Errorf("first_record_at changed on second record: got %v want %v",
			second.User.FirstRecordAt, stamped)
	}
}

func TestCreate_EmptyContent_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	cases := []string{
		`{"content":""}`,
		`{"content":"   \n\t  "}`,
	}
	for _, body := range cases {
		rec := post(t, h, "u1", body)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("body %q: got %d want 400", body, rec.Code)
		}
	}
}

func TestCreate_TooLong_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	long := strings.Repeat("가", 2001)
	body, _ := json.Marshal(map[string]string{"content": long})
	rec := post(t, h, "u1", string(body))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestCreate_Unauthorized_401(t *testing.T) {
	h, db, _ := newHandlers(t, "")
	defer db.Close()

	req := httptest.NewRequest(http.MethodPost, "/records", bytes.NewBufferString(`{"content":"x"}`))
	rec := httptest.NewRecorder()
	h.Create(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status: got %d want 401", rec.Code)
	}
}

func TestCreate_InvalidBody_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `not json`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestCreate_UnknownField_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"ok","extra":1}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

// -- POST /records/{id}/audio/upload-url -----------------------------------

// routeWithChi runs the request through a tiny chi router so URLParam
// works exactly as in production. Sub-tests use this rather than
// poking RouteContext directly.
func routeWithChi(h *Handlers) http.Handler {
	r := chi.NewRouter()
	r.Post("/records/{id}/audio/upload-url", h.CreateAudioUploadURL)
	r.Patch("/records/{id}", h.Patch)
	return r
}

// seedVoiceRecord inserts a row directly so each PATCH/upload-url
// test starts from a known state without going through Create.
func seedVoiceRecord(t *testing.T, db *sql.DB, recordID, userID, content string, audioKey *string) {
	t.Helper()
	if audioKey == nil {
		_, err := db.Exec(`INSERT INTO records (id, user_id, content, source) VALUES (?,?,?,?)`,
			recordID, userID, content, "voice")
		if err != nil {
			t.Fatalf("seed record: %v", err)
		}
		return
	}
	_, err := db.Exec(`INSERT INTO records (id, user_id, content, source, audio_s3_key) VALUES (?,?,?,?,?)`,
		recordID, userID, content, "voice", *audioKey)
	if err != nil {
		t.Fatalf("seed record: %v", err)
	}
}

// runReq routes one request through the chi handler and returns the
// recorder. It centralises the "build request → inject user → record"
// boilerplate that every PATCH / upload-url test was repeating.
func runReq(t *testing.T, h *Handlers, method, path, uid, body string) *httptest.ResponseRecorder {
	t.Helper()
	var r *http.Request
	if body == "" {
		r = httptest.NewRequest(method, path, nil)
	} else {
		r = httptest.NewRequest(method, path, strings.NewReader(body))
	}
	if uid != "" {
		r = withUser(r, uid)
	}
	rec := httptest.NewRecorder()
	routeWithChi(h).ServeHTTP(rec, r)
	return rec
}

func TestUploadURL_HappyPath(t *testing.T) {
	h, db, audio := newHandlers(t, "u1")
	defer db.Close()
	seedVoiceRecord(t, db, "rec-1", "u1", "transcript", nil)

	rec := runReq(t, h, http.MethodPost, "/records/rec-1/audio/upload-url", "u1", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	if audio.presigned != 1 {
		t.Errorf("expected one presign call, got %d", audio.presigned)
	}
	var body audioUploadURLResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	wantKey := "test/users/u1/records/rec-1.m4a"
	if body.AudioS3Key != wantKey {
		t.Errorf("audio_s3_key: got %q want %q", body.AudioS3Key, wantKey)
	}
	if body.URL == "" {
		t.Error("upload_url empty")
	}
	if body.ContentType != storage.AudioContentType {
		t.Errorf("content_type: got %q", body.ContentType)
	}
	if body.MaxBytes != storage.MaxAudioBytes {
		t.Errorf("max_bytes: got %d", body.MaxBytes)
	}
}

func TestUploadURL_AnotherUsersRecord_404(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()
	seedUser(t, db, "u2", "u2@b.com")
	seedVoiceRecord(t, db, "rec-1", "u2", "x", nil)

	rec := runReq(t, h, http.MethodPost, "/records/rec-1/audio/upload-url", "u1", "")
	if rec.Code != http.StatusNotFound {
		t.Errorf("status: got %d want 404", rec.Code)
	}
}

func TestUploadURL_AlreadyAttached_409(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()
	key := "test/users/u1/records/rec-1.m4a"
	seedVoiceRecord(t, db, "rec-1", "u1", "x", &key)

	rec := runReq(t, h, http.MethodPost, "/records/rec-1/audio/upload-url", "u1", "")
	if rec.Code != http.StatusConflict {
		t.Errorf("status: got %d want 409", rec.Code)
	}
}

func TestUploadURL_NoAudioConfig_503(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()
	h.Audio = nil

	rec := runReq(t, h, http.MethodPost, "/records/rec-1/audio/upload-url", "u1", "")
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status: got %d want 503", rec.Code)
	}
}

// -- PATCH /records/{id} ----------------------------------------------------

func attachBody(key string) string {
	return fmt.Sprintf(`{"audio_s3_key":%q}`, key)
}

func TestPatch_HappyPath_AttachesAudio(t *testing.T) {
	h, db, audio := newHandlers(t, "u1")
	defer db.Close()
	seedVoiceRecord(t, db, "rec-1", "u1", "transcript", nil)
	key := audio.BuildRecordAudioKey("u1", "rec-1")
	audio.objects[key] = true

	rec := runReq(t, h, http.MethodPatch, "/records/rec-1", "u1", attachBody(key))
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var stored sql.NullString
	if err := db.QueryRow(`SELECT audio_s3_key FROM records WHERE id=?`, "rec-1").Scan(&stored); err != nil {
		t.Fatalf("requery: %v", err)
	}
	if !stored.Valid || stored.String != key {
		t.Errorf("audio_s3_key not persisted: %v", stored)
	}
}

func TestPatch_KeyOutsideUserNamespace_400(t *testing.T) {
	h, db, audio := newHandlers(t, "u1")
	defer db.Close()
	seedUser(t, db, "u2", "u2@b.com")
	seedVoiceRecord(t, db, "rec-1", "u1", "x", nil)
	wrong := audio.BuildRecordAudioKey("u2", "rec-1")

	rec := runReq(t, h, http.MethodPatch, "/records/rec-1", "u1", attachBody(wrong))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestPatch_MissingS3Object_400(t *testing.T) {
	h, db, audio := newHandlers(t, "u1")
	defer db.Close()
	seedVoiceRecord(t, db, "rec-1", "u1", "x", nil)
	key := audio.BuildRecordAudioKey("u1", "rec-1")

	rec := runReq(t, h, http.MethodPatch, "/records/rec-1", "u1", attachBody(key))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestPatch_AlreadyAttached_409(t *testing.T) {
	h, db, audio := newHandlers(t, "u1")
	defer db.Close()
	key := audio.BuildRecordAudioKey("u1", "rec-1")
	seedVoiceRecord(t, db, "rec-1", "u1", "x", &key)
	audio.objects[key] = true

	rec := runReq(t, h, http.MethodPatch, "/records/rec-1", "u1", attachBody(key))
	if rec.Code != http.StatusConflict {
		t.Errorf("status: got %d want 409", rec.Code)
	}
}

func TestPatch_HeadObjectError_500(t *testing.T) {
	h, db, audio := newHandlers(t, "u1")
	defer db.Close()
	seedVoiceRecord(t, db, "rec-1", "u1", "x", nil)
	key := audio.BuildRecordAudioKey("u1", "rec-1")
	audio.headErr = errors.New("network down")

	rec := runReq(t, h, http.MethodPatch, "/records/rec-1", "u1", attachBody(key))
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status: got %d want 500", rec.Code)
	}
}

func TestPatch_MissingKey_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()
	seedVoiceRecord(t, db, "rec-1", "u1", "x", nil)

	rec := runReq(t, h, http.MethodPatch, "/records/rec-1", "u1", `{}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}
