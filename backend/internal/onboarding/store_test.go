package onboarding

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"testing"

	_ "modernc.org/sqlite"
)

// newTestDB creates an in-memory SQLite database with the post-migration
// schema (users + onboarding + records + children + child_record_purposes).
// Mirrors the real migration shape; kept in sync by the up migrations.
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
  case_kind                    TEXT CHECK (case_kind IN ('A','B','C')),
  onboarded_at                 TEXT,
  voice_coachmark_dismissed_at TEXT,
  first_record_at              TEXT,
  ai_preview                   TEXT,
  updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE records (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  purpose   TEXT NOT NULL
            CHECK (purpose IN ('book_making','memory_keeping','family_share','emotion_diary')),
  PRIMARY KEY (child_id, purpose)
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

// fakePhotoMover records the rename calls and returns canonical permanent
// keys, so SaveCaseOnboarding tests can inspect what was written without
// touching real S3.
type fakePhotoMover struct {
	calls    int
	moveErr  error
	lastTmp  string
	lastUser string
}

func (f *fakePhotoMover) MoveChildPhoto(ctx context.Context, userID, childID, tmpKey string) (string, error) {
	f.calls++
	f.lastUser = userID
	f.lastTmp = tmpKey
	if f.moveErr != nil {
		return "", f.moveErr
	}
	return fmt.Sprintf("users/%s/children/%s/photo.jpg", userID, childID), nil
}

func TestSaveCaseOnboarding_CaseA(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	weeks := 17
	due := "2026-09-30"
	tname := "튼튼이"
	in := CaseOnboardingInput{
		Case: CaseA,
		Children: []ChildInput{
			{
				Kind:           ChildKindFetus,
				DisplayName:    &tname,
				Gender:         GenderUndecided,
				PregnancyWeeks: &weeks,
				DueDate:        &due,
				Purposes:       []RecordPurpose{PurposeBookMaking, PurposeEmotionDiary},
			},
		},
	}
	if err := store.SaveCaseOnboarding(ctx, "u1", in, nil); err != nil {
		t.Fatalf("save: %v", err)
	}
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.CaseKind == nil || *o.CaseKind != CaseA {
		t.Errorf("case_kind: got %v", o.CaseKind)
	}
	if o.OnboardedAt == nil {
		t.Errorf("onboarded_at should be stamped")
	}

	children, err := store.ListChildren(ctx, "u1")
	if err != nil {
		t.Fatalf("list children: %v", err)
	}
	if len(children) != 1 {
		t.Fatalf("children: got %d want 1", len(children))
	}
	c := children[0]
	if c.Kind != ChildKindFetus || c.Gender != GenderUndecided {
		t.Errorf("child shape: %+v", c)
	}
	if c.PregnancyWeeks == nil || *c.PregnancyWeeks != 17 {
		t.Errorf("weeks: got %v", c.PregnancyWeeks)
	}
	if c.DueDate == nil || *c.DueDate != "2026-09-30" {
		t.Errorf("due_date: got %v", c.DueDate)
	}
	got := purposeStrings(c.Purposes)
	want := []string{string(PurposeBookMaking), string(PurposeEmotionDiary)}
	sort.Strings(got)
	sort.Strings(want)
	if !equalStrings(got, want) {
		t.Errorf("purposes: got %v want %v", got, want)
	}
}

func TestSaveCaseOnboarding_CaseB_PerChildPurposes(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	intro := "잘 웃는 첫째"
	bd := "2023-04-12"
	displayChild := "지유"
	weeks := 17
	due := "2026-09-30"
	displayFetus := "튼튼이"
	in := CaseOnboardingInput{
		Case: CaseB,
		Children: []ChildInput{
			{
				Kind:         ChildKindChild,
				DisplayName:  &displayChild,
				Gender:       GenderFemale,
				BirthDate:    &bd,
				Introduction: &intro,
				Purposes:     []RecordPurpose{PurposeBookMaking, PurposeMemoryKeeping},
			},
			{
				Kind:           ChildKindFetus,
				DisplayName:    &displayFetus,
				Gender:         GenderUndecided,
				PregnancyWeeks: &weeks,
				DueDate:        &due,
				Purposes:       []RecordPurpose{PurposeEmotionDiary},
			},
		},
	}
	if err := store.SaveCaseOnboarding(ctx, "u1", in, nil); err != nil {
		t.Fatalf("save: %v", err)
	}
	children, err := store.ListChildren(ctx, "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(children) != 2 {
		t.Fatalf("children: got %d want 2", len(children))
	}
	if children[0].Kind != ChildKindChild || children[1].Kind != ChildKindFetus {
		t.Errorf("sort order: kinds %v %v", children[0].Kind, children[1].Kind)
	}
	if len(children[0].Purposes) != 2 || len(children[1].Purposes) != 1 {
		t.Errorf("per-child purposes: %v / %v", children[0].Purposes, children[1].Purposes)
	}
}

func TestSaveCaseOnboarding_PhotoRename(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	tmp := "users/u1/onboarding-tmp/abc.jpg"
	bd := "2023-04-12"
	display := "지유"
	in := CaseOnboardingInput{
		Case: CaseC,
		Children: []ChildInput{
			{
				Kind:        ChildKindChild,
				DisplayName: &display,
				Gender:      GenderFemale,
				BirthDate:   &bd,
				PhotoTmpKey: &tmp,
				Purposes:    []RecordPurpose{PurposeBookMaking},
			},
		},
	}
	mover := &fakePhotoMover{}
	if err := store.SaveCaseOnboarding(ctx, "u1", in, mover); err != nil {
		t.Fatalf("save: %v", err)
	}
	if mover.calls != 1 || mover.lastTmp != tmp || mover.lastUser != "u1" {
		t.Errorf("mover: %+v", mover)
	}
	children, err := store.ListChildren(ctx, "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(children) != 1 {
		t.Fatalf("children: got %d", len(children))
	}
	if children[0].PhotoS3Key == nil {
		t.Errorf("photo_s3_key should be set after rename")
	}
}

func TestSaveCaseOnboarding_PhotoRenameFailureRollsBack(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	tmp := "users/u1/onboarding-tmp/abc.jpg"
	bd := "2023-04-12"
	display := "지유"
	in := CaseOnboardingInput{
		Case: CaseC,
		Children: []ChildInput{
			{
				Kind:        ChildKindChild,
				DisplayName: &display,
				Gender:      GenderFemale,
				BirthDate:   &bd,
				PhotoTmpKey: &tmp,
				Purposes:    []RecordPurpose{PurposeBookMaking},
			},
		},
	}
	mover := &fakePhotoMover{moveErr: fmt.Errorf("simulated S3 failure")}
	err := store.SaveCaseOnboarding(ctx, "u1", in, mover)
	if err == nil {
		t.Fatal("expected error")
	}
	// No children persisted, no case stamped.
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM children WHERE user_id = ?`, "u1").Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Errorf("rollback failed, %d rows persisted", n)
	}
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.CaseKind != nil || o.OnboardedAt != nil {
		t.Errorf("onboarding should still be unfilled: %+v", o)
	}
}

func TestSaveCaseOnboarding_RejectsZeroPurposes(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	display := "지유"
	bd := "2023-04-12"
	in := CaseOnboardingInput{
		Case: CaseC,
		Children: []ChildInput{
			{
				Kind:        ChildKindChild,
				DisplayName: &display,
				Gender:      GenderFemale,
				BirthDate:   &bd,
				Purposes:    nil,
			},
		},
	}
	if err := store.SaveCaseOnboarding(context.Background(), "u1", in, nil); err == nil {
		t.Errorf("expected error for empty purposes")
	}
}

func TestResetByEmail(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	display := "지유"
	bd := "2023-04-12"
	in := CaseOnboardingInput{
		Case: CaseC,
		Children: []ChildInput{
			{
				Kind:        ChildKindChild,
				DisplayName: &display,
				Gender:      GenderFemale,
				BirthDate:   &bd,
				Purposes:    []RecordPurpose{PurposeBookMaking},
			},
		},
	}
	if err := store.SaveCaseOnboarding(ctx, "u1", in, nil); err != nil {
		t.Fatalf("save: %v", err)
	}
	if err := store.ResetByEmail(ctx, "a@b.com"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.CaseKind != nil || o.OnboardedAt != nil {
		t.Errorf("reset should clear: got case=%v onb=%v", o.CaseKind, o.OnboardedAt)
	}
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM children WHERE user_id = ?`, "u1").Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Errorf("children should be deleted on reset, got %d", n)
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
	if _, err := db.Exec(`UPDATE onboarding SET first_record_at = datetime('now') WHERE user_id = ?`, "u1"); err != nil {
		t.Fatalf("seed first_record_at: %v", err)
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

func purposeStrings(ps []RecordPurpose) []string {
	out := make([]string, 0, len(ps))
	for _, p := range ps {
		out = append(out, string(p))
	}
	return out
}

func equalStrings(a, b []string) bool {
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
