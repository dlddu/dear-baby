package onboarding

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	_ "modernc.org/sqlite"
)

// newTestDB creates an in-memory SQLite database with the post-migration
// schema (users + onboarding + children + child_record_purposes + records).
// Mirrors the real migration shape — kept in sync with the up migrations.
func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`PRAGMA foreign_keys = ON`); err != nil {
		t.Fatalf("foreign keys: %v", err)
	}
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
  onboarded_at                 TEXT,
  voice_coachmark_dismissed_at TEXT,
  first_record_at              TEXT,
  ai_preview                   TEXT,
  case_kind                    TEXT CHECK (case_kind IN ('A','B','C')),
  updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE children (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('fetus','child')),
  display_name    TEXT,
  gender          TEXT NOT NULL CHECK (gender IN ('male','female','undecided')),
  introduction    TEXT,
  photo_s3_key    TEXT,
  birth_date      TEXT,
  pregnancy_weeks INTEGER,
  due_date        TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_children_user ON children(user_id);
CREATE TABLE child_record_purposes (
  child_id  TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  purpose   TEXT NOT NULL,
  PRIMARY KEY (child_id, purpose)
);
CREATE TABLE records (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("schema: %v", err)
	}
	return db
}

func seedUserWithOnboarding(t *testing.T, db *sql.DB, id, email string) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES (?, ?)`, id, email); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO onboarding (user_id) VALUES (?)`, id); err != nil {
		t.Fatalf("seed onboarding: %v", err)
	}
}

func ptrStr(s string) *string { return &s }
func ptrInt(i int) *int       { return &i }

func TestSaveCaseOnboarding_CaseA_Singleton(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	payload := SubmitCasePayload{
		Case: CaseA,
		Children: []ChildInput{{
			Kind:           ChildKindFetus,
			DisplayName:    ptrStr("튼튼이"),
			Gender:         GenderUndecided,
			PregnancyWeeks: ptrInt(17),
			DueDate:        ptrStr("2026-09-30"),
			Purposes:       []RecordPurpose{PurposeBookMaking, PurposeEmotionDiary},
		}},
	}
	rows, err := store.SaveCaseOnboarding(ctx, nil, "u1", payload)
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("rows: got %d want 1", len(rows))
	}

	got, err := store.GetCaseOnboarding(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Onboarding.CaseKind == nil || *got.Onboarding.CaseKind != CaseA {
		t.Errorf("case_kind: got %v want A", got.Onboarding.CaseKind)
	}
	if got.Onboarding.OnboardedAt == nil {
		t.Error("onboarded_at should be set")
	}
	if len(got.Children) != 1 {
		t.Fatalf("children: got %d want 1", len(got.Children))
	}
	c := got.Children[0]
	if c.Kind != ChildKindFetus || c.Gender != GenderUndecided {
		t.Errorf("child fields: got %+v", c)
	}
	if c.DisplayName == nil || *c.DisplayName != "튼튼이" {
		t.Errorf("display_name: got %v", c.DisplayName)
	}
	if c.PregnancyWeeks == nil || *c.PregnancyWeeks != 17 {
		t.Errorf("pregnancy_weeks: got %v", c.PregnancyWeeks)
	}
	purposes := got.Purposes[c.ID]
	if len(purposes) != 2 {
		t.Errorf("purposes: got %v want 2 entries", purposes)
	}
}

func TestSaveCaseOnboarding_CaseB_Mixed(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	payload := SubmitCasePayload{
		Case: CaseB,
		Children: []ChildInput{
			{
				Kind:         ChildKindChild,
				DisplayName:  ptrStr("지유"),
				Gender:       GenderFemale,
				BirthDate:    ptrStr("2023-04-12"),
				Introduction: ptrStr("잘 웃는 첫째"),
				Purposes:     []RecordPurpose{PurposeBookMaking},
			},
			{
				Kind:           ChildKindFetus,
				DisplayName:    ptrStr("튼튼이"),
				Gender:         GenderUndecided,
				PregnancyWeeks: ptrInt(17),
				DueDate:        ptrStr("2026-09-30"),
				Purposes:       []RecordPurpose{PurposeEmotionDiary},
			},
		},
	}
	if _, err := store.SaveCaseOnboarding(ctx, nil, "u1", payload); err != nil {
		t.Fatalf("save: %v", err)
	}

	got, err := store.GetCaseOnboarding(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if len(got.Children) != 2 {
		t.Fatalf("children: got %d want 2", len(got.Children))
	}
	if got.Children[0].SortOrder != 0 || got.Children[1].SortOrder != 1 {
		t.Errorf("sort order not preserved")
	}
	if got.Children[0].Kind != ChildKindChild || got.Children[1].Kind != ChildKindFetus {
		t.Errorf("kinds: got %v / %v", got.Children[0].Kind, got.Children[1].Kind)
	}
	// Per-child purposes must remain isolated.
	if len(got.Purposes[got.Children[0].ID]) != 1 || got.Purposes[got.Children[0].ID][0] != PurposeBookMaking {
		t.Errorf("child[0] purposes: got %v", got.Purposes[got.Children[0].ID])
	}
	if len(got.Purposes[got.Children[1].ID]) != 1 || got.Purposes[got.Children[1].ID][0] != PurposeEmotionDiary {
		t.Errorf("child[1] purposes: got %v", got.Purposes[got.Children[1].ID])
	}
}

func TestSaveCaseOnboarding_CaseC_Multiple(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	payload := SubmitCasePayload{
		Case: CaseC,
		Children: []ChildInput{
			{Kind: ChildKindChild, DisplayName: ptrStr("첫째"), Gender: GenderMale, BirthDate: ptrStr("2020-01-01"), Purposes: []RecordPurpose{PurposeMemoryKeeping}},
			{Kind: ChildKindChild, DisplayName: ptrStr("둘째"), Gender: GenderFemale, BirthDate: ptrStr("2022-06-15"), Purposes: []RecordPurpose{PurposeMemoryKeeping}},
		},
	}
	if _, err := store.SaveCaseOnboarding(ctx, nil, "u1", payload); err != nil {
		t.Fatalf("save: %v", err)
	}

	got, err := store.GetCaseOnboarding(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Onboarding.CaseKind == nil || *got.Onboarding.CaseKind != CaseC {
		t.Errorf("case_kind: got %v want C", got.Onboarding.CaseKind)
	}
	if len(got.Children) != 2 {
		t.Fatalf("children: got %d", len(got.Children))
	}
	for _, c := range got.Children {
		if c.Kind != ChildKindChild {
			t.Errorf("kind: got %v want child", c.Kind)
		}
	}
}

// stubMover records calls and decides existence based on a key set.
type stubMover struct {
	prefix     string
	exists     map[string]bool
	copies     map[string]string // src -> dst
	deletes    []string
	headErr    error
	copyErr    error
	deleteErr  error
	extension  func(key string) (string, bool)
	buildKey   func(uid, cid, ext string) string
}

func newStubMover(prefix string) *stubMover {
	return &stubMover{
		prefix: prefix,
		exists: make(map[string]bool),
		copies: make(map[string]string),
		extension: func(key string) (string, bool) {
			// Default: extract trailing extension after the last '.'.
			for i := len(key) - 1; i >= 0; i-- {
				if key[i] == '.' {
					return key[i+1:], true
				}
				if key[i] == '/' {
					break
				}
			}
			return "", false
		},
		buildKey: func(uid, cid, ext string) string {
			return uid + "/children/" + cid + "/photo." + ext
		},
	}
}

func (m *stubMover) BuildChildPhotoKey(userID, childID, ext string) string {
	return m.buildKey(userID, childID, ext)
}

func (m *stubMover) HeadObject(_ context.Context, key string) (bool, error) {
	if m.headErr != nil {
		return false, m.headErr
	}
	return m.exists[key], nil
}

func (m *stubMover) CopyObject(_ context.Context, src, dst string) error {
	if m.copyErr != nil {
		return m.copyErr
	}
	m.copies[src] = dst
	m.exists[dst] = true
	return nil
}

func (m *stubMover) DeleteObject(_ context.Context, key string) error {
	if m.deleteErr != nil {
		return m.deleteErr
	}
	m.deletes = append(m.deletes, key)
	delete(m.exists, key)
	return nil
}

func (m *stubMover) PhotoExtensionFromTmpKey(key string) (string, bool) {
	return m.extension(key)
}

func TestSaveCaseOnboarding_PhotoRename(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	mover := newStubMover("u1")
	tmpKey := "u1/onboarding-tmp/abc.jpg"
	mover.exists[tmpKey] = true

	store := &Store{DB: db}
	ctx := context.Background()
	payload := SubmitCasePayload{
		Case: CaseC,
		Children: []ChildInput{{
			Kind:        ChildKindChild,
			DisplayName: ptrStr("아이"),
			Gender:      GenderMale,
			BirthDate:   ptrStr("2024-01-01"),
			PhotoTmpKey: ptrStr(tmpKey),
			Purposes:    []RecordPurpose{PurposeMemoryKeeping},
		}},
	}
	rows, err := store.SaveCaseOnboarding(ctx, mover, "u1", payload)
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if len(rows) != 1 || rows[0].PhotoS3Key == nil {
		t.Fatalf("photo key not set: %+v", rows)
	}
	expectedDst := mover.BuildChildPhotoKey("u1", rows[0].ID, "jpg")
	if *rows[0].PhotoS3Key != expectedDst {
		t.Errorf("photo_s3_key: got %s want %s", *rows[0].PhotoS3Key, expectedDst)
	}
	if mover.copies[tmpKey] != expectedDst {
		t.Errorf("copy: got %v want %s -> %s", mover.copies, tmpKey, expectedDst)
	}
	if len(mover.deletes) != 1 || mover.deletes[0] != tmpKey {
		t.Errorf("deletes: got %v", mover.deletes)
	}
}

func TestSaveCaseOnboarding_PhotoMissingRollsBack(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	mover := newStubMover("u1")
	// Note: tmp key is NOT in mover.exists — HeadObject will return false.

	store := &Store{DB: db}
	ctx := context.Background()
	payload := SubmitCasePayload{
		Case: CaseC,
		Children: []ChildInput{{
			Kind:        ChildKindChild,
			DisplayName: ptrStr("아이"),
			Gender:      GenderMale,
			BirthDate:   ptrStr("2024-01-01"),
			PhotoTmpKey: ptrStr("u1/onboarding-tmp/missing.jpg"),
			Purposes:    []RecordPurpose{PurposeMemoryKeeping},
		}},
	}
	if _, err := store.SaveCaseOnboarding(ctx, mover, "u1", payload); err == nil {
		t.Fatal("expected error for missing photo, got nil")
	}
	// Rollback should leave no children rows behind.
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM children WHERE user_id = 'u1'`).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Errorf("rolled-back children rows: got %d want 0", n)
	}
	// Onboarding should not be marked as completed.
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.OnboardedAt != nil {
		t.Error("onboarded_at should not be set after rollback")
	}
}

func TestReset_ClearsCaseAndChildren(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	payload := SubmitCasePayload{
		Case: CaseA,
		Children: []ChildInput{{
			Kind: ChildKindFetus, Gender: GenderFemale,
			PregnancyWeeks: ptrInt(20), DueDate: ptrStr("2026-08-01"),
			Purposes: []RecordPurpose{PurposeBookMaking},
		}},
	}
	if _, err := store.SaveCaseOnboarding(ctx, nil, "u1", payload); err != nil {
		t.Fatalf("save: %v", err)
	}

	if err := store.Reset(ctx, "u1"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	got, err := store.GetCaseOnboarding(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Onboarding.CaseKind != nil || got.Onboarding.OnboardedAt != nil {
		t.Errorf("reset should clear case fields: got %+v", got.Onboarding)
	}
	if len(got.Children) != 0 {
		t.Errorf("children should be cleared, got %d", len(got.Children))
	}
}

func TestResetByEmail(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	if err := store.ResetByEmail(context.Background(), "a@b.com"); err != nil {
		t.Fatalf("reset: %v", err)
	}
}

func TestResetByEmail_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	err := store.ResetByEmail(context.Background(), "missing@example.com")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestDismissVoiceCoachmark(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	if err := store.DismissVoiceCoachmark(ctx, "u1"); err != nil {
		t.Fatalf("dismiss: %v", err)
	}
	first, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if first.VoiceCoachmarkDismissedAt == nil {
		t.Fatal("voice_coachmark_dismissed_at should be set after first dismiss")
	}
	stamped := *first.VoiceCoachmarkDismissedAt

	if err := store.DismissVoiceCoachmark(ctx, "u1"); err != nil {
		t.Fatalf("second dismiss: %v", err)
	}
	second, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if second.VoiceCoachmarkDismissedAt == nil ||
		!second.VoiceCoachmarkDismissedAt.Equal(stamped) {
		t.Errorf("timestamp changed on second dismiss: got %v want %v",
			second.VoiceCoachmarkDismissedAt, stamped)
	}
}

func TestDismissVoiceCoachmark_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	err := store.DismissVoiceCoachmark(context.Background(), "missing")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestReset_PreservesRecords(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	if _, err := db.Exec(`INSERT INTO records (id, user_id, content) VALUES ('r1', 'u1', 'hello')`); err != nil {
		t.Fatalf("seed record: %v", err)
	}

	store := &Store{DB: db}
	if err := store.Reset(context.Background(), "u1"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM records WHERE user_id = ?`, "u1").Scan(&n); err != nil {
		t.Fatalf("count records: %v", err)
	}
	if n != 1 {
		t.Errorf("records should be preserved on reset, got %d want 1", n)
	}
}

func TestListPendingAIPreviews(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")
	seedUserWithOnboarding(t, db, "u2", "c@d.com")

	if _, err := db.Exec(`INSERT INTO records (id, user_id, content) VALUES ('r1', 'u1', 'hello')`); err != nil {
		t.Fatalf("seed r1: %v", err)
	}
	if _, err := db.Exec(`UPDATE onboarding SET first_record_at = datetime('now') WHERE user_id = 'u1'`); err != nil {
		t.Fatalf("stamp fr u1: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO records (id, user_id, content) VALUES ('r2', 'u2', 'world')`); err != nil {
		t.Fatalf("seed r2: %v", err)
	}
	if _, err := db.Exec(`UPDATE onboarding SET first_record_at = datetime('now'), ai_preview = 'done' WHERE user_id = 'u2'`); err != nil {
		t.Fatalf("stamp u2: %v", err)
	}

	store := &Store{DB: db}
	pending, err := store.ListPendingAIPreviews(context.Background(), 10)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(pending) != 1 || pending[0].UserID != "u1" || pending[0].RecordID != "r1" {
		t.Errorf("pending: got %+v want one entry for u1/r1", pending)
	}
	if pending[0].Content != "hello" {
		t.Errorf("content: got %q want hello", pending[0].Content)
	}
}

func TestEnsureRowTx_Idempotent(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES ('u1', 'a@b.com')`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	store := &Store{DB: db}
	ctx := context.Background()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	if err := store.EnsureRowTx(ctx, tx, "u1"); err != nil {
		t.Fatalf("first ensure: %v", err)
	}
	if err := store.EnsureRowTx(ctx, tx, "u1"); err != nil {
		t.Fatalf("second ensure: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM onboarding WHERE user_id = ?`, "u1").Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 1 {
		t.Errorf("rows: got %d want 1", n)
	}
}
