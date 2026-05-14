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
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'text' CHECK(source IN ('text','voice')),
  audio_s3_key  TEXT,
  question_text TEXT,
  child_kind    TEXT NOT NULL CHECK(child_kind IN ('child','fetus')),
  child_ordinal INTEGER NOT NULL CHECK(child_ordinal >= 1),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE fetuses (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ordinal        INTEGER NOT NULL,
  nickname       TEXT,
  gender         TEXT,
  pregnancy_week INTEGER,
  due_date       TEXT,
  purposes_json  TEXT NOT NULL DEFAULT '[]',
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, ordinal)
);
CREATE TABLE children (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ordinal        INTEGER NOT NULL,
  name           TEXT,
  gender         TEXT,
  birth_date     TEXT,
  bio            TEXT,
  purposes_json  TEXT NOT NULL DEFAULT '[]',
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, ordinal)
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
	// Most Create tests need a (kind, ordinal) row to point at. Default to
	// a single fetus ordinal=1 — matches the Case A / 단일 임신 shape, which
	// the legacy tests implicitly assumed. Tests that need a different
	// shape can DELETE/INSERT explicitly.
	if _, err := db.Exec(
		`INSERT INTO fetuses (user_id, ordinal, due_date) VALUES (?, 1, '2025-09-15')`,
		id,
	); err != nil {
		t.Fatalf("seed fetus: %v", err)
	}
}

// seedChild inserts a children row so handler/store tests can target the
// 양육 아이 branch without dragging in the onboarding package's Case B/C
// upserts.
func seedChild(t *testing.T, db *sql.DB, userID string, ordinal int, name string) {
	t.Helper()
	if _, err := db.Exec(
		`INSERT INTO children (user_id, ordinal, name, birth_date) VALUES (?, ?, ?, '2024-01-01')`,
		userID, ordinal, name,
	); err != nil {
		t.Fatalf("seed child: %v", err)
	}
}

// seedFetus inserts a fetuses row for tests that need a second ordinal
// beyond the default one created by seedUser.
func seedFetus(t *testing.T, db *sql.DB, userID string, ordinal int, nickname string) {
	t.Helper()
	if _, err := db.Exec(
		`INSERT INTO fetuses (user_id, ordinal, nickname, due_date) VALUES (?, ?, ?, '2025-09-15')`,
		userID, ordinal, nickname,
	); err != nil {
		t.Fatalf("seed fetus: %v", err)
	}
}

// fakeAudio satisfies AudioStorage without touching AWS. It mimics the
// canonical key builder so handlers exercise the same prefix-validation
// path as in production.
type fakeAudio struct {
	prefix      string
	objects     map[string]bool
	headErr     error
	presigned   int
	lastFormat  storage.AudioFormat
	lastContent string
}

func (f *fakeAudio) BuildRecordAudioKey(userID, recordID string, format storage.AudioFormat, createdAt time.Time) string {
	t := createdAt.UTC()
	return fmt.Sprintf("%syear=%04d/month=%02d/day=%02d/users/%s/records/%s%s",
		f.prefix, t.Year(), t.Month(), t.Day(), userID, recordID, format.Extension())
}

func (f *fakeAudio) IsValidRecordAudioKey(userID, recordID, key string, createdAt time.Time) bool {
	if key == "" {
		return false
	}
	return key == f.BuildRecordAudioKey(userID, recordID, storage.AudioFormatM4A, createdAt) ||
		key == f.BuildRecordAudioKey(userID, recordID, storage.AudioFormatWAV, createdAt)
}

func (f *fakeAudio) PresignPut(_ context.Context, key string, format storage.AudioFormat) (storage.PresignedPut, error) {
	f.presigned++
	f.lastFormat = format
	f.lastContent = format.ContentType()
	return storage.PresignedPut{
		URL:         "https://s3.example/" + key,
		Method:      http.MethodPut,
		ExpiresAt:   time.Now().Add(5 * time.Minute),
		ContentType: format.ContentType(),
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

// mustJSON marshals a body builder map. Tests use this for any case that
// needs non-string values (e.g. child_ordinal int) so the inline JSON
// strings stay readable.
func mustJSON(t *testing.T, m map[string]any) string {
	t.Helper()
	b, err := json.Marshal(m)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return string(b)
}

// -- POST /records ----------------------------------------------------------

func TestCreate_HappyPath_StampsFirstRecordAt(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"엄마가 너에게 전하고 싶은 말","child_kind":"fetus","child_ordinal":1}`)
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

	rec := post(t, h, "u1", `{"content":"오늘 아기가 처음 움직였어요","source":"voice","child_kind":"fetus","child_ordinal":1}`)
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

	rec := post(t, h, "u1", `{"content":"x","source":"audio","child_kind":"fetus","child_ordinal":1}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

// TestCreate_ChildOrdinalEchoed validates that the (kind, ordinal) the
// client sent are echoed back on the response and persisted on the row.
// Records.child_kind/child_ordinal is the foundation for attributing a
// record to a specific 태아/양육 아이 in multi-child households, so the
// response → DB round-trip is the regression net.
func TestCreate_ChildOrdinalEchoed(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()
	seedChild(t, db, "u1", 1, "첫째")
	seedChild(t, db, "u1", 2, "둘째")

	body := mustJSON(t, map[string]any{
		"content":       "둘째에게 들려주는 첫 이야기",
		"child_kind":    "child",
		"child_ordinal": 2,
	})
	rec := post(t, h, "u1", body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got createResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Record.ChildKind != ChildKindChild {
		t.Errorf("child_kind: got %q want %q", got.Record.ChildKind, ChildKindChild)
	}
	if got.Record.ChildOrdinal != 2 {
		t.Errorf("child_ordinal: got %d want 2", got.Record.ChildOrdinal)
	}

	var kind string
	var ordinal int
	if err := db.QueryRow(
		`SELECT child_kind, child_ordinal FROM records WHERE id=?`, got.Record.ID,
	).Scan(&kind, &ordinal); err != nil {
		t.Fatalf("requery: %v", err)
	}
	if kind != "child" || ordinal != 2 {
		t.Errorf("persisted (kind, ordinal): got (%q, %d) want (\"child\", 2)", kind, ordinal)
	}
}

func TestCreate_MissingChildKind_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"ok","child_ordinal":1}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestCreate_InvalidChildKind_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"ok","child_kind":"sibling","child_ordinal":1}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestCreate_ZeroChildOrdinal_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"ok","child_kind":"fetus","child_ordinal":0}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestCreate_NegativeChildOrdinal_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"ok","child_kind":"fetus","child_ordinal":-1}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestCreate_NonExistentChildOrdinal_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()
	// seedUser created fetus ordinal=1; ordinal=2 does not exist for u1.

	rec := post(t, h, "u1", `{"content":"ok","child_kind":"fetus","child_ordinal":2}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestCreate_NonExistentChildKindForUser_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()
	// seedUser created a fetus ordinal=1 only — no children row exists.

	rec := post(t, h, "u1", `{"content":"ok","child_kind":"child","child_ordinal":1}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

// TestCreate_OtherUsersChildOrdinal_400 verifies that the existence
// check is scoped to the inserting user — a user cannot reference a
// (kind, ordinal) row that belongs to a different user even if the
// numbers happen to line up.
func TestCreate_OtherUsersChildOrdinal_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()
	seedUser(t, db, "u2", "u2@b.com")
	seedChild(t, db, "u2", 3, "u2의 첫째")
	// u1 has no children rows (only the default fetus ordinal=1).

	rec := post(t, h, "u1", `{"content":"ok","child_kind":"child","child_ordinal":3}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

// TestCreate_FetusOrdinalRoutesToFetusesTable confirms that
// child_kind="fetus" is checked against the fetuses table even if a
// children row with the same ordinal exists. Same numeric ordinal across
// the two tables is legal — Case B users have both — so the
// discriminator must dispatch correctly.
func TestCreate_FetusOrdinalRoutesToFetusesTable(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()
	// Default seedUser already inserted fetus ordinal=1. Add child
	// ordinal=2; only fetus ordinal=2 should be rejected.
	seedChild(t, db, "u1", 2, "u1의 첫째")

	rec := post(t, h, "u1", `{"content":"ok","child_kind":"fetus","child_ordinal":2}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400 (no fetus ordinal=2)", rec.Code)
	}

	rec = post(t, h, "u1", `{"content":"ok","child_kind":"child","child_ordinal":2}`)
	if rec.Code != http.StatusCreated {
		t.Errorf("child ordinal=2 should succeed: got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestCreate_QuestionText_PersistedAndEchoed(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	question := "요즘 아기가 가장 활발하게 움직인 순간은 언제였나요?"
	body := mustJSON(t, map[string]any{
		"content":       "오늘 처음으로 태동을 느꼈어요.",
		"question_text": question,
		"child_kind":    "fetus",
		"child_ordinal": 1,
	})
	rec := post(t, h, "u1", body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got createResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Record == nil || got.Record.QuestionText == nil {
		t.Fatalf("question_text missing in response: %+v", got.Record)
	}
	if *got.Record.QuestionText != question {
		t.Errorf("question_text: got %q want %q", *got.Record.QuestionText, question)
	}

	// Re-query to verify persistence (not just echo).
	var stored sql.NullString
	if err := db.QueryRow(`SELECT question_text FROM records WHERE id=?`, got.Record.ID).Scan(&stored); err != nil {
		t.Fatalf("requery: %v", err)
	}
	if !stored.Valid || stored.String != question {
		t.Errorf("question_text not persisted: %v", stored)
	}
}

func TestCreate_VoiceWithQuestion_PersistedAndEchoed(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	question := "오늘 아기에게 어떤 노래를 들려주고 싶나요?"
	body := mustJSON(t, map[string]any{
		"content":       "방금 들려준 자장가가 마음에 드는 것 같아요.",
		"source":        "voice",
		"question_text": question,
		"child_kind":    "fetus",
		"child_ordinal": 1,
	})
	rec := post(t, h, "u1", body)
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
	if got.Record.QuestionText == nil || *got.Record.QuestionText != question {
		t.Errorf("question_text: got %v want %q", got.Record.QuestionText, question)
	}
}

func TestCreate_NoQuestion_QuestionTextIsNull(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	rec := post(t, h, "u1", `{"content":"질문 없이 저장","child_kind":"fetus","child_ordinal":1}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got createResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Record.QuestionText != nil {
		t.Errorf("question_text: expected null, got %q", *got.Record.QuestionText)
	}
}

func TestCreate_QuestionTextTooLong_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	long := strings.Repeat("가", 501)
	body := mustJSON(t, map[string]any{
		"content":       "ok",
		"question_text": long,
		"child_kind":    "fetus",
		"child_ordinal": 1,
	})
	rec := post(t, h, "u1", body)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestCreate_QuestionTextWhitespaceOnly_StoredAsNull(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	body := `{"content":"ok","question_text":"   \n\t  ","child_kind":"fetus","child_ordinal":1}`
	rec := post(t, h, "u1", body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var got createResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Record.QuestionText != nil {
		t.Errorf("whitespace-only question_text should collapse to null, got %q", *got.Record.QuestionText)
	}
}

func TestCreate_AfterReset_ReusesOldestExistingRecord(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()

	old := "2023-01-02 03:04:05"
	if _, err := db.Exec(`
		INSERT INTO records (id, user_id, content, source, child_kind, child_ordinal, created_at)
		VALUES ('r0', 'u1', 'old', 'text', 'fetus', 1, ?)
	`, old); err != nil {
		t.Fatalf("seed old record: %v", err)
	}

	rec := post(t, h, "u1", `{"content":"new","child_kind":"fetus","child_ordinal":1}`)
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

	r1 := post(t, h, "u1", `{"content":"one","child_kind":"fetus","child_ordinal":1}`)
	if r1.Code != http.StatusCreated {
		t.Fatalf("first: %d %s", r1.Code, r1.Body.String())
	}
	var first createResponse
	if err := json.Unmarshal(r1.Body.Bytes(), &first); err != nil {
		t.Fatalf("decode first: %v", err)
	}
	stamped := *first.User.FirstRecordAt

	r2 := post(t, h, "u1", `{"content":"two","child_kind":"fetus","child_ordinal":1}`)
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

// seededRecordCreatedAt is the fixed UTC timestamp seedVoiceRecord stamps
// onto rows. Pinning created_at means tests can predict the time-partition
// segment in canonical S3 keys without depending on wall-clock at runtime.
var seededRecordCreatedAt = time.Date(2026, 5, 9, 14, 30, 0, 0, time.UTC)

// seededRecordCreatedAtSQL is seededRecordCreatedAt in the SQLite layout
// (`YYYY-MM-DD HH:MM:SS`, UTC) so it round-trips cleanly through the
// store's time.Parse on read.
const seededRecordCreatedAtSQL = "2026-05-09 14:30:00"

// seededRecordPartition is the canonical Hive-style time-partition path
// segment that BuildRecordAudioKey produces for seededRecordCreatedAt.
// Tests use it to assemble expected keys without recomputing the format.
const seededRecordPartition = "year=2026/month=05/day=09"

// seedVoiceRecord inserts a row directly so each PATCH/upload-url
// test starts from a known state without going through Create.
// created_at is pinned to seededRecordCreatedAtSQL so callers can
// derive the expected time-partitioned S3 key deterministically.
func seedVoiceRecord(t *testing.T, db *sql.DB, recordID, userID, content string, audioKey *string) {
	t.Helper()
	if audioKey == nil {
		_, err := db.Exec(
			`INSERT INTO records (id, user_id, content, source, child_kind, child_ordinal, created_at) VALUES (?,?,?,?,?,?,?)`,
			recordID, userID, content, "voice", "fetus", 1, seededRecordCreatedAtSQL,
		)
		if err != nil {
			t.Fatalf("seed record: %v", err)
		}
		return
	}
	_, err := db.Exec(
		`INSERT INTO records (id, user_id, content, source, audio_s3_key, child_kind, child_ordinal, created_at) VALUES (?,?,?,?,?,?,?,?)`,
		recordID, userID, content, "voice", *audioKey, "fetus", 1, seededRecordCreatedAtSQL,
	)
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
	wantKey := "test/" + seededRecordPartition + "/users/u1/records/rec-1.m4a"
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
	key := "test/" + seededRecordPartition + "/users/u1/records/rec-1.m4a"
	seedVoiceRecord(t, db, "rec-1", "u1", "x", &key)

	rec := runReq(t, h, http.MethodPost, "/records/rec-1/audio/upload-url", "u1", "")
	if rec.Code != http.StatusConflict {
		t.Errorf("status: got %d want 409", rec.Code)
	}
}

func TestUploadURL_WAVFormat_KeyAndContentType(t *testing.T) {
	h, db, audio := newHandlers(t, "u1")
	defer db.Close()
	seedVoiceRecord(t, db, "rec-1", "u1", "transcript", nil)

	rec := runReq(t, h, http.MethodPost, "/records/rec-1/audio/upload-url", "u1",
		`{"format":"wav"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var body audioUploadURLResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	wantKey := "test/" + seededRecordPartition + "/users/u1/records/rec-1.wav"
	if body.AudioS3Key != wantKey {
		t.Errorf("audio_s3_key: got %q want %q", body.AudioS3Key, wantKey)
	}
	if body.ContentType != "audio/wav" {
		t.Errorf("content_type: got %q want %q", body.ContentType, "audio/wav")
	}
	if audio.lastFormat != storage.AudioFormatWAV {
		t.Errorf("PresignPut format: got %q want %q", audio.lastFormat, storage.AudioFormatWAV)
	}
}

func TestUploadURL_DefaultFormatIsM4A(t *testing.T) {
	h, db, audio := newHandlers(t, "u1")
	defer db.Close()
	seedVoiceRecord(t, db, "rec-1", "u1", "transcript", nil)

	// Empty body — older clients that haven't been updated for the
	// format field. Must keep returning the m4a key.
	rec := runReq(t, h, http.MethodPost, "/records/rec-1/audio/upload-url", "u1", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var body audioUploadURLResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.AudioS3Key != "test/"+seededRecordPartition+"/users/u1/records/rec-1.m4a" {
		t.Errorf("audio_s3_key: got %q", body.AudioS3Key)
	}
	if audio.lastFormat != storage.AudioFormatM4A {
		t.Errorf("PresignPut format: got %q want %q", audio.lastFormat, storage.AudioFormatM4A)
	}
}

func TestUploadURL_UnknownFormat_400(t *testing.T) {
	h, db, _ := newHandlers(t, "u1")
	defer db.Close()
	seedVoiceRecord(t, db, "rec-1", "u1", "transcript", nil)

	rec := runReq(t, h, http.MethodPost, "/records/rec-1/audio/upload-url", "u1",
		`{"format":"mp3"}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestPatch_WAVKey_AttachesAudio(t *testing.T) {
	h, db, audio := newHandlers(t, "u1")
	defer db.Close()
	seedVoiceRecord(t, db, "rec-1", "u1", "transcript", nil)
	key := audio.BuildRecordAudioKey("u1", "rec-1", storage.AudioFormatWAV, seededRecordCreatedAt)
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
	key := audio.BuildRecordAudioKey("u1", "rec-1", storage.AudioFormatM4A, seededRecordCreatedAt)
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
	wrong := audio.BuildRecordAudioKey("u2", "rec-1", storage.AudioFormatM4A, seededRecordCreatedAt)

	rec := runReq(t, h, http.MethodPatch, "/records/rec-1", "u1", attachBody(wrong))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestPatch_MissingS3Object_400(t *testing.T) {
	h, db, audio := newHandlers(t, "u1")
	defer db.Close()
	seedVoiceRecord(t, db, "rec-1", "u1", "x", nil)
	key := audio.BuildRecordAudioKey("u1", "rec-1", storage.AudioFormatM4A, seededRecordCreatedAt)

	rec := runReq(t, h, http.MethodPatch, "/records/rec-1", "u1", attachBody(key))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestPatch_AlreadyAttached_409(t *testing.T) {
	h, db, audio := newHandlers(t, "u1")
	defer db.Close()
	key := audio.BuildRecordAudioKey("u1", "rec-1", storage.AudioFormatM4A, seededRecordCreatedAt)
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
	key := audio.BuildRecordAudioKey("u1", "rec-1", storage.AudioFormatM4A, seededRecordCreatedAt)
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
