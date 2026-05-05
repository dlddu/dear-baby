package onboarding

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	_ "modernc.org/sqlite"
)

// newTestDB creates an in-memory SQLite database with the post-0008
// schema (users + onboarding + children + child_record_purposes +
// records). Mirrors the real migration shape; kept in sync by hand.
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
CREATE TABLE child_record_purposes (
  child_id  TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  purpose   TEXT NOT NULL CHECK (purpose IN
              ('book_making','memory_keeping','family_share','emotion_diary')),
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

// strPtr / intPtr keep the test fixtures readable.
func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }

// caseAFixture / caseBFixture / caseCFixture build minimal valid
// submissions for each case. Tests can mutate the result before passing
// it to SaveCaseOnboarding.
func caseAFixture() CaseSubmission {
	return CaseSubmission{
		Case: CaseA,
		Children: []ChildInput{{
			Kind:           KindFetus,
			DisplayName:    strPtr("튼튼이"),
			Gender:         GenderUndecided,
			PregnancyWeeks: intPtr(17),
			DueDate:        strPtr("2026-09-30"),
			Purposes:       []RecordPurpose{PurposeBookMaking},
		}},
	}
}

func caseBFixture() CaseSubmission {
	return CaseSubmission{
		Case: CaseB,
		Children: []ChildInput{
			{
				Kind:        KindChild,
				DisplayName: strPtr("지유"),
				Gender:      GenderFemale,
				BirthDate:   strPtr("2023-04-12"),
				Purposes:    []RecordPurpose{PurposeBookMaking, PurposeMemoryKeeping},
			},
			{
				Kind:           KindFetus,
				DisplayName:    strPtr("튼튼이"),
				Gender:         GenderUndecided,
				PregnancyWeeks: intPtr(20),
				DueDate:        strPtr("2026-12-01"),
				Purposes:       []RecordPurpose{PurposeEmotionDiary},
			},
		},
	}
}

func caseCFixture() CaseSubmission {
	return CaseSubmission{
		Case: CaseC,
		Children: []ChildInput{{
			Kind:        KindChild,
			DisplayName: strPtr("지유"),
			Gender:      GenderFemale,
			BirthDate:   strPtr("2023-04-12"),
			Purposes:    []RecordPurpose{PurposeBookMaking},
		}},
	}
}

func TestSaveCaseOnboarding_RoundtripCaseA(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	rows, err := store.SaveCaseOnboarding(ctx, "u1", caseAFixture(), nil)
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("rows: got %d want 1", len(rows))
	}
	if rows[0].Kind != KindFetus {
		t.Errorf("kind: got %q want fetus", rows[0].Kind)
	}

	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.CaseKind == nil || *o.CaseKind != CaseA {
		t.Errorf("case_kind: got %v want A", o.CaseKind)
	}
	if o.OnboardedAt == nil {
		t.Error("onboarded_at should be set")
	}
}

func TestSaveCaseOnboarding_RoundtripCaseB(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	rows, err := store.SaveCaseOnboarding(ctx, "u1", caseBFixture(), nil)
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("rows: got %d want 2", len(rows))
	}

	caseKind, kids, err := store.GetCaseOnboarding(ctx, "u1")
	if err != nil {
		t.Fatalf("get case: %v", err)
	}
	if caseKind == nil || *caseKind != CaseB {
		t.Errorf("case_kind: got %v want B", caseKind)
	}
	if len(kids) != 2 || kids[0].Kind != KindChild || kids[1].Kind != KindFetus {
		t.Errorf("kids: %+v", kids)
	}
	// Sort order preserved across rows.
	if kids[0].SortOrder != 0 || kids[1].SortOrder != 1 {
		t.Errorf("sort_order: %d/%d want 0/1", kids[0].SortOrder, kids[1].SortOrder)
	}

	// purposes inserted.
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM child_record_purposes`).Scan(&n); err != nil {
		t.Fatalf("count purposes: %v", err)
	}
	if n != 3 {
		t.Errorf("purposes count: got %d want 3 (2 + 1)", n)
	}
}

func TestSaveCaseOnboarding_RoundtripCaseC(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	if _, err := store.SaveCaseOnboarding(ctx, "u1", caseCFixture(), nil); err != nil {
		t.Fatalf("save: %v", err)
	}
	caseKind, kids, err := store.GetCaseOnboarding(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if caseKind == nil || *caseKind != CaseC {
		t.Errorf("case_kind: %v", caseKind)
	}
	if len(kids) != 1 || kids[0].Kind != KindChild {
		t.Errorf("kids: %+v", kids)
	}
}

func TestSaveCaseOnboarding_PhotoRenameInvoked(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	sub := caseCFixture()
	sub.Children[0].PhotoTmpKey = strPtr("users/u1/onboarding-tmp/abc.jpg")

	store := &Store{DB: db}
	calls := 0
	rename := func(ctx context.Context, childID string, in ChildInput) (string, error) {
		calls++
		// Verify the child id reaches the callback so the handler can
		// build the canonical key.
		if childID == "" {
			t.Errorf("childID empty")
		}
		return "users/u1/children/" + childID + "/photo.jpg", nil
	}
	rows, err := store.SaveCaseOnboarding(context.Background(), "u1", sub, rename)
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if calls != 1 {
		t.Errorf("rename calls: got %d want 1", calls)
	}
	if rows[0].PhotoS3Key == nil ||
		*rows[0].PhotoS3Key != "users/u1/children/"+rows[0].ID+"/photo.jpg" {
		t.Errorf("photo_s3_key: got %v", rows[0].PhotoS3Key)
	}
}

func TestSaveCaseOnboarding_PhotoRenameErrorRollsBack(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	sub := caseCFixture()
	sub.Children[0].PhotoTmpKey = strPtr("users/u1/onboarding-tmp/abc.jpg")

	store := &Store{DB: db}
	rename := func(ctx context.Context, childID string, in ChildInput) (string, error) {
		return "", errors.New("s3 unavailable")
	}
	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", sub, rename); err == nil {
		t.Fatal("expected error, got nil")
	}
	// onboarding row remains unmarked, no children rows persisted.
	o, err := store.GetByID(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.CaseKind != nil || o.OnboardedAt != nil {
		t.Errorf("rollback failed: %+v", o)
	}
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM children`).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Errorf("children leak after rollback: %d", n)
	}
}

func TestSaveCaseOnboarding_ValidationCaseAFetusOnly(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	bad := caseAFixture()
	// Add a child to make it a B mismatch.
	bad.Children = append(bad.Children, ChildInput{
		Kind:        KindChild,
		DisplayName: strPtr("지유"),
		Gender:      GenderFemale,
		BirthDate:   strPtr("2023-01-01"),
		Purposes:    []RecordPurpose{PurposeBookMaking},
	})
	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", bad, nil); !errors.Is(err, ErrInvalidPayload) {
		t.Errorf("err: got %v want ErrInvalidPayload", err)
	}
}

func TestSaveCaseOnboarding_ValidationCaseBRequiresBoth(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	bad := CaseSubmission{
		Case: CaseB,
		Children: []ChildInput{caseAFixture().Children[0]},
	}
	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", bad, nil); !errors.Is(err, ErrInvalidPayload) {
		t.Errorf("err: got %v want ErrInvalidPayload", err)
	}
}

func TestSaveCaseOnboarding_ValidationFetusFieldsRequired(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	bad := caseAFixture()
	bad.Children[0].DueDate = nil // missing required
	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", bad, nil); !errors.Is(err, ErrInvalidPayload) {
		t.Errorf("err: got %v want ErrInvalidPayload", err)
	}
}

func TestSaveCaseOnboarding_ValidationChildBirthDateRequired(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	bad := caseCFixture()
	bad.Children[0].BirthDate = nil
	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", bad, nil); !errors.Is(err, ErrInvalidPayload) {
		t.Errorf("err: got %v want ErrInvalidPayload", err)
	}
}

func TestSaveCaseOnboarding_ValidationPurposesNonEmpty(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	bad := caseAFixture()
	bad.Children[0].Purposes = nil
	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", bad, nil); !errors.Is(err, ErrInvalidPayload) {
		t.Errorf("err: got %v want ErrInvalidPayload", err)
	}
}

func TestSaveCaseOnboarding_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	store := &Store{DB: db}
	if _, err := store.SaveCaseOnboarding(context.Background(), "missing", caseAFixture(), nil); !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestResetByEmail_ClearsChildren(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	if _, err := store.SaveCaseOnboarding(ctx, "u1", caseBFixture(), nil); err != nil {
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
	if err := db.QueryRow(`SELECT COUNT(*) FROM children WHERE user_id = 'u1'`).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Errorf("children remaining: %d", n)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM child_record_purposes`).Scan(&n); err != nil {
		t.Fatalf("count purposes: %v", err)
	}
	if n != 0 {
		t.Errorf("purposes remaining: %d", n)
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

func TestReset_ClearsAllFieldsAndChildren(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	if _, err := store.SaveCaseOnboarding(ctx, "u1", caseBFixture(), nil); err != nil {
		t.Fatalf("save: %v", err)
	}
	if err := store.DismissVoiceCoachmark(ctx, "u1"); err != nil {
		t.Fatalf("dismiss: %v", err)
	}
	if err := store.UpdateAIPreview(ctx, "u1", "preview text"); err != nil {
		t.Fatalf("update preview: %v", err)
	}
	if err := store.Reset(ctx, "u1"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.VoiceCoachmarkDismissedAt != nil ||
		o.AIPreview != nil ||
		o.OnboardedAt != nil ||
		o.CaseKind != nil ||
		o.FirstRecordAt != nil {
		t.Errorf("reset should clear all onboarding fields: got %+v", o)
	}
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM children WHERE user_id = 'u1'`).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Errorf("children remaining: %d", n)
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

	// u1 has first record + pending preview.
	if _, err := db.Exec(`INSERT INTO records (id, user_id, content) VALUES ('r1', 'u1', 'hello')`); err != nil {
		t.Fatalf("seed r1: %v", err)
	}
	if _, err := db.Exec(`UPDATE onboarding SET first_record_at = datetime('now') WHERE user_id = 'u1'`); err != nil {
		t.Fatalf("stamp fr u1: %v", err)
	}

	// u2 has first record + preview already generated — excluded.
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
