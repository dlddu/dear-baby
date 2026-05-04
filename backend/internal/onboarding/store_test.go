package onboarding

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	_ "modernc.org/sqlite"
)

// newTestDB creates an in-memory SQLite database with the post-migration
// schema (users + onboarding + children + child_record_purposes +
// records). Mirrors the real migration shape; kept in sync with the up
// migrations.
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
  case_kind                    TEXT,
  onboarded_at                 TEXT,
  voice_coachmark_dismissed_at TEXT,
  first_record_at              TEXT,
  ai_preview                   TEXT,
  updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE children (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  display_name    TEXT,
  gender          TEXT NOT NULL,
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

func intPtr(v int) *int { return &v }

func TestSaveCaseOnboarding_CaseA(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	sub := &CaseSubmission{
		Case: CaseA,
		Children: []ChildInput{
			{
				Kind:           ChildKindFetus,
				DisplayName:    "튼튼이",
				Gender:         GenderUndecided,
				PregnancyWeeks: intPtr(17),
				DueDate:        "2026-09-30",
				Purposes:       []RecordPurpose{PurposeBookMaking, PurposeEmotionDiary},
			},
		},
	}
	if err := sub.Validate(); err != nil {
		t.Fatalf("validate: %v", err)
	}
	rows, err := store.SaveCaseOnboarding(context.Background(), "u1", sub, nil)
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("rows: got %d want 1", len(rows))
	}

	o, err := store.GetByID(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get onboarding: %v", err)
	}
	if o.CaseKind == nil || *o.CaseKind != "A" {
		t.Errorf("case_kind: got %v", o.CaseKind)
	}
	if o.OnboardedAt == nil {
		t.Error("onboarded_at must be stamped")
	}

	listed, err := store.ListChildren(context.Background(), "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(listed) != 1 || listed[0].Kind != ChildKindFetus {
		t.Errorf("children: %+v", listed)
	}
	if got := listed[0].Purposes; len(got) != 2 {
		t.Errorf("purposes: got %v", got)
	}
}

func TestSaveCaseOnboarding_CaseB_TwoStages(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	sub := &CaseSubmission{
		Case: CaseB,
		Children: []ChildInput{
			{
				Kind:        ChildKindChild,
				DisplayName: "지유",
				Gender:      GenderFemale,
				BirthDate:   "2023-04-12",
				Purposes:    []RecordPurpose{PurposeBookMaking, PurposeMemoryKeeping},
			},
			{
				Kind:           ChildKindFetus,
				DisplayName:    "튼튼이",
				Gender:         GenderUndecided,
				PregnancyWeeks: intPtr(17),
				DueDate:        "2026-09-30",
				Purposes:       []RecordPurpose{PurposeEmotionDiary},
			},
		},
	}
	if err := sub.Validate(); err != nil {
		t.Fatalf("validate: %v", err)
	}
	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", sub, nil); err != nil {
		t.Fatalf("save: %v", err)
	}

	listed, err := store.ListChildren(context.Background(), "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(listed) != 2 {
		t.Fatalf("children: got %d want 2", len(listed))
	}
	// SortOrder must preserve submission order so the client can render
	// them in the same order it submitted.
	if listed[0].Kind != ChildKindChild || listed[1].Kind != ChildKindFetus {
		t.Errorf("order: got %v %v", listed[0].Kind, listed[1].Kind)
	}
}

func TestSaveCaseOnboarding_CaseC_PhotoFinalizer(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	sub := &CaseSubmission{
		Case: CaseC,
		Children: []ChildInput{
			{
				Kind:        ChildKindChild,
				DisplayName: "지유",
				Gender:      GenderFemale,
				BirthDate:   "2023-04-12",
				PhotoTmpKey: "users/u1/onboarding-tmp/abcd.jpg",
				Purposes:    []RecordPurpose{PurposeFamilyShare},
			},
		},
	}
	if err := sub.Validate(); err != nil {
		t.Fatalf("validate: %v", err)
	}

	var calls int
	finalizer := func(ctx context.Context, childID string, c *ChildInput) (string, error) {
		calls++
		return "users/u1/children/" + childID + "/photo.jpg", nil
	}

	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", sub, finalizer); err != nil {
		t.Fatalf("save: %v", err)
	}
	if calls != 1 {
		t.Errorf("finalizer calls: got %d want 1", calls)
	}

	listed, err := store.ListChildren(context.Background(), "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if listed[0].PhotoS3Key == nil {
		t.Fatal("photo_s3_key should be set")
	}
}

func TestSaveCaseOnboarding_FinalizerErrorRollsBack(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	sub := &CaseSubmission{
		Case: CaseC,
		Children: []ChildInput{
			{
				Kind:        ChildKindChild,
				DisplayName: "지유",
				Gender:      GenderFemale,
				BirthDate:   "2023-04-12",
				PhotoTmpKey: "users/u1/onboarding-tmp/abcd.jpg",
				Purposes:    []RecordPurpose{PurposeFamilyShare},
			},
		},
	}
	if err := sub.Validate(); err != nil {
		t.Fatalf("validate: %v", err)
	}

	wantErr := errors.New("S3 missing")
	finalizer := func(ctx context.Context, childID string, c *ChildInput) (string, error) {
		return "", wantErr
	}

	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", sub, finalizer); !errors.Is(err, wantErr) {
		t.Fatalf("err: got %v want %v", err, wantErr)
	}
	listed, err := store.ListChildren(context.Background(), "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(listed) != 0 {
		t.Errorf("children must be rolled back: %+v", listed)
	}
	o, err := store.GetByID(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get onboarding: %v", err)
	}
	if o.CaseKind != nil {
		t.Errorf("case_kind must be rolled back: %v", *o.CaseKind)
	}
	if o.OnboardedAt != nil {
		t.Error("onboarded_at must be rolled back")
	}
}

func TestSaveCaseOnboarding_UserNotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	sub := &CaseSubmission{
		Case: CaseA,
		Children: []ChildInput{
			{Kind: ChildKindFetus, Gender: GenderMale, PregnancyWeeks: intPtr(20), DueDate: "2026-12-31", Purposes: []RecordPurpose{PurposeBookMaking}},
		},
	}
	_, err := store.SaveCaseOnboarding(context.Background(), "missing", sub, nil)
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestResetByEmail_ClearsCaseAndChildren(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	sub := &CaseSubmission{
		Case: CaseA,
		Children: []ChildInput{
			{Kind: ChildKindFetus, Gender: GenderMale, PregnancyWeeks: intPtr(20), DueDate: "2026-12-31", Purposes: []RecordPurpose{PurposeBookMaking}},
		},
	}
	if err := sub.Validate(); err != nil {
		t.Fatalf("validate: %v", err)
	}
	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", sub, nil); err != nil {
		t.Fatalf("save: %v", err)
	}

	if err := store.ResetByEmail(context.Background(), "a@b.com"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	o, err := store.GetByID(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.CaseKind != nil || o.OnboardedAt != nil {
		t.Errorf("reset should clear: case=%v onb=%v", o.CaseKind, o.OnboardedAt)
	}
	listed, _ := store.ListChildren(context.Background(), "u1")
	if len(listed) != 0 {
		t.Errorf("children should be wiped: %+v", listed)
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

func TestReset_ClearsAllFields(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
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

func TestValidate_RejectsCaseAWithChild(t *testing.T) {
	sub := &CaseSubmission{
		Case: CaseA,
		Children: []ChildInput{
			{Kind: ChildKindChild, DisplayName: "지유", Gender: GenderFemale, BirthDate: "2024-01-01", Purposes: []RecordPurpose{PurposeBookMaking}},
		},
	}
	if err := sub.Validate(); !errors.Is(err, ErrInvalidPayload) {
		t.Errorf("err: got %v want ErrInvalidPayload", err)
	}
}

func TestValidate_RejectsCaseBSingleStage(t *testing.T) {
	sub := &CaseSubmission{
		Case: CaseB,
		Children: []ChildInput{
			{Kind: ChildKindFetus, Gender: GenderMale, PregnancyWeeks: intPtr(20), DueDate: "2026-12-31", Purposes: []RecordPurpose{PurposeBookMaking}},
		},
	}
	if err := sub.Validate(); !errors.Is(err, ErrInvalidPayload) {
		t.Errorf("case B with no caregiver child should fail; got %v", err)
	}
}

func TestValidate_RejectsCaseCWithFetus(t *testing.T) {
	sub := &CaseSubmission{
		Case: CaseC,
		Children: []ChildInput{
			{Kind: ChildKindFetus, Gender: GenderMale, PregnancyWeeks: intPtr(20), DueDate: "2026-12-31", Purposes: []RecordPurpose{PurposeBookMaking}},
		},
	}
	if err := sub.Validate(); !errors.Is(err, ErrInvalidPayload) {
		t.Errorf("err: got %v want ErrInvalidPayload", err)
	}
}

func TestValidate_RejectsFetusMissingFields(t *testing.T) {
	tests := []ChildInput{
		{Kind: ChildKindFetus, Gender: GenderMale, DueDate: "2026-12-31", Purposes: []RecordPurpose{PurposeBookMaking}},                       // no weeks
		{Kind: ChildKindFetus, Gender: GenderMale, PregnancyWeeks: intPtr(20), Purposes: []RecordPurpose{PurposeBookMaking}},                  // no due
		{Kind: ChildKindFetus, Gender: GenderMale, PregnancyWeeks: intPtr(0), DueDate: "2026-12-31", Purposes: []RecordPurpose{PurposeBookMaking}}, // weeks oob
	}
	for i, c := range tests {
		sub := &CaseSubmission{Case: CaseA, Children: []ChildInput{c}}
		if err := sub.Validate(); !errors.Is(err, ErrInvalidPayload) {
			t.Errorf("case %d: got %v want ErrInvalidPayload", i, err)
		}
	}
}

func TestValidate_RejectsChildMissingFields(t *testing.T) {
	tests := []ChildInput{
		{Kind: ChildKindChild, Gender: GenderFemale, BirthDate: "2024-01-01", Purposes: []RecordPurpose{PurposeBookMaking}},          // no name
		{Kind: ChildKindChild, DisplayName: "지유", Gender: GenderFemale, Purposes: []RecordPurpose{PurposeBookMaking}},                 // no birth
		{Kind: ChildKindChild, DisplayName: "지유", Gender: GenderFemale, BirthDate: "2024-01-01"},                                       // no purposes
	}
	for i, c := range tests {
		sub := &CaseSubmission{Case: CaseC, Children: []ChildInput{c}}
		if err := sub.Validate(); !errors.Is(err, ErrInvalidPayload) {
			t.Errorf("case %d: got %v want ErrInvalidPayload", i, err)
		}
	}
}
