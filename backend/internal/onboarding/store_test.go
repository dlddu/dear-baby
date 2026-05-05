package onboarding

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"testing"

	_ "modernc.org/sqlite"
)

// newTestDB creates an in-memory SQLite database with the post-migration
// schema (users + onboarding + children + child_record_purposes +
// records). Mirrors the real migration shape; kept in sync by the up
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

// idGen is a deterministic id generator used by SaveCaseOnboarding tests.
func idGen() func() string {
	n := 0
	return func() string {
		n++
		return "child-" + strconv.Itoa(n)
	}
}

// noRename is a SaveCaseOnboarding renamer that errors if any photo
// rename is attempted — used by tests that don't supply photos.
func noRename(_ context.Context, _, _, _ string) (string, error) {
	return "", errors.New("rename should not be invoked")
}

func ptrString(s string) *string { return &s }
func ptrInt(i int) *int          { return &i }

func TestSaveCaseOnboarding_CaseA_RoundTrip(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	req := SubmitCaseRequest{
		Case: CaseA,
		Children: []ChildInput{
			{
				Kind:           ChildKindFetus,
				Gender:         GenderUndecided,
				DisplayName:    ptrString("튼튼이"),
				PregnancyWeeks: ptrInt(17),
				DueDate:        ptrString("2026-09-30"),
				Purposes:       []RecordPurpose{PurposeBookMaking, PurposeMemoryKeeping},
			},
		},
	}
	gen := idGen()
	out, err := store.SaveCaseOnboarding(context.Background(), "u1", req, gen, noRename)
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if len(out.Children) != 1 || out.Children[0].ID != "child-1" {
		t.Errorf("children: %+v", out.Children)
	}

	o, err := store.GetByID(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get onboarding: %v", err)
	}
	if o.CaseKind == nil || *o.CaseKind != CaseA {
		t.Errorf("case_kind: got %v want A", o.CaseKind)
	}
	if o.OnboardedAt == nil {
		t.Errorf("onboarded_at should be set")
	}
	rows, err := store.GetChildren(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get children: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("children: got %d want 1", len(rows))
	}
	if rows[0].Kind != ChildKindFetus {
		t.Errorf("kind: %v", rows[0].Kind)
	}
	if rows[0].PregnancyWeeks == nil || *rows[0].PregnancyWeeks != 17 {
		t.Errorf("pregnancy_weeks: %v", rows[0].PregnancyWeeks)
	}
	if len(rows[0].Purposes) != 2 {
		t.Errorf("purposes: %v", rows[0].Purposes)
	}
}

func TestSaveCaseOnboarding_CaseB_TwoKindsRoundTrip(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	req := SubmitCaseRequest{
		Case: CaseB,
		Children: []ChildInput{
			{
				Kind:        ChildKindChild,
				Gender:      GenderFemale,
				DisplayName: ptrString("지유"),
				BirthDate:   ptrString("2023-04-12"),
				Purposes:    []RecordPurpose{PurposeFamilyShare},
			},
			{
				Kind:           ChildKindFetus,
				Gender:         GenderMale,
				PregnancyWeeks: ptrInt(20),
				DueDate:        ptrString("2026-10-01"),
				Purposes:       []RecordPurpose{PurposeEmotionDiary},
			},
		},
	}
	gen := idGen()
	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", req, gen, noRename); err != nil {
		t.Fatalf("save: %v", err)
	}
	rows, err := store.GetChildren(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get children: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("children: got %d want 2", len(rows))
	}
	if rows[0].Kind != ChildKindChild {
		t.Errorf("rows[0].Kind: %v", rows[0].Kind)
	}
	if rows[1].Kind != ChildKindFetus {
		t.Errorf("rows[1].Kind: %v", rows[1].Kind)
	}
}

func TestSaveCaseOnboarding_CaseC_RoundTrip(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	req := SubmitCaseRequest{
		Case: CaseC,
		Children: []ChildInput{
			{
				Kind:        ChildKindChild,
				Gender:      GenderFemale,
				DisplayName: ptrString("지유"),
				BirthDate:   ptrString("2023-04-12"),
				Purposes:    []RecordPurpose{PurposeBookMaking},
			},
		},
	}
	gen := idGen()
	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", req, gen, noRename); err != nil {
		t.Fatalf("save: %v", err)
	}
	o, err := store.GetByID(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.CaseKind == nil || *o.CaseKind != CaseC {
		t.Errorf("case_kind: %v", o.CaseKind)
	}
}

func TestSaveCaseOnboarding_RenamesPhoto(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	req := SubmitCaseRequest{
		Case: CaseC,
		Children: []ChildInput{
			{
				Kind:        ChildKindChild,
				Gender:      GenderFemale,
				DisplayName: ptrString("지유"),
				BirthDate:   ptrString("2023-04-12"),
				Purposes:    []RecordPurpose{PurposeBookMaking},
				PhotoTmpKey: ptrString("users/u1/onboarding-tmp/abc.jpg"),
			},
		},
	}
	rename := func(_ context.Context, userID, childID, tmpKey string) (string, error) {
		if userID != "u1" || tmpKey != "users/u1/onboarding-tmp/abc.jpg" {
			t.Errorf("rename args: uid=%s tmp=%s", userID, tmpKey)
		}
		return "users/" + userID + "/children/" + childID + "/photo.jpg", nil
	}
	gen := idGen()
	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", req, gen, rename); err != nil {
		t.Fatalf("save: %v", err)
	}
	rows, err := store.GetChildren(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if rows[0].PhotoS3Key == nil || *rows[0].PhotoS3Key != "users/u1/children/child-1/photo.jpg" {
		t.Errorf("photo_s3_key: %v", rows[0].PhotoS3Key)
	}
}

func TestSaveCaseOnboarding_RollsBackOnPhotoRenameFailure(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	req := SubmitCaseRequest{
		Case: CaseC,
		Children: []ChildInput{
			{
				Kind:        ChildKindChild,
				Gender:      GenderFemale,
				DisplayName: ptrString("지유"),
				BirthDate:   ptrString("2023-04-12"),
				Purposes:    []RecordPurpose{PurposeBookMaking},
				PhotoTmpKey: ptrString("users/u1/onboarding-tmp/abc.jpg"),
			},
		},
	}
	failRename := func(_ context.Context, _, _, _ string) (string, error) {
		return "", errors.New("HEAD failed")
	}
	if _, err := store.SaveCaseOnboarding(context.Background(), "u1", req, idGen(), failRename); err == nil {
		t.Fatalf("expected error")
	}
	rows, err := store.GetChildren(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get children: %v", err)
	}
	if len(rows) != 0 {
		t.Errorf("children should be rolled back: got %d", len(rows))
	}
	o, err := store.GetByID(context.Background(), "u1")
	if err != nil {
		t.Fatalf("get onboarding: %v", err)
	}
	if o.OnboardedAt != nil {
		t.Errorf("onboarded_at should not be stamped on rollback")
	}
}

func TestResetByEmail(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	req := SubmitCaseRequest{
		Case: CaseA,
		Children: []ChildInput{
			{
				Kind:           ChildKindFetus,
				Gender:         GenderUndecided,
				PregnancyWeeks: ptrInt(20),
				DueDate:        ptrString("2026-12-01"),
				Purposes:       []RecordPurpose{PurposeBookMaking},
			},
		},
	}
	if _, err := store.SaveCaseOnboarding(ctx, "u1", req, idGen(), noRename); err != nil {
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
	rows, err := store.GetChildren(ctx, "u1")
	if err != nil {
		t.Fatalf("get children: %v", err)
	}
	if len(rows) != 0 {
		t.Errorf("children should be deleted on reset, got %d", len(rows))
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

func TestValidate_RejectsBadCases(t *testing.T) {
	cases := []struct {
		name string
		req  SubmitCaseRequest
	}{
		{
			name: "empty children",
			req:  SubmitCaseRequest{Case: CaseA},
		},
		{
			name: "Case A with child kind",
			req: SubmitCaseRequest{
				Case: CaseA,
				Children: []ChildInput{
					{Kind: ChildKindChild, Gender: GenderFemale,
						DisplayName: ptrString("x"), BirthDate: ptrString("2023-01-01"),
						Purposes: []RecordPurpose{PurposeBookMaking}},
				},
			},
		},
		{
			name: "fetus missing pregnancy_weeks",
			req: SubmitCaseRequest{
				Case: CaseA,
				Children: []ChildInput{
					{Kind: ChildKindFetus, Gender: GenderUndecided,
						DueDate: ptrString("2026-01-01"),
						Purposes: []RecordPurpose{PurposeBookMaking}},
				},
			},
		},
		{
			name: "child missing display_name",
			req: SubmitCaseRequest{
				Case: CaseC,
				Children: []ChildInput{
					{Kind: ChildKindChild, Gender: GenderFemale,
						BirthDate: ptrString("2023-01-01"),
						Purposes: []RecordPurpose{PurposeBookMaking}},
				},
			},
		},
		{
			name: "Case B with only fetuses",
			req: SubmitCaseRequest{
				Case: CaseB,
				Children: []ChildInput{
					{Kind: ChildKindFetus, Gender: GenderUndecided,
						PregnancyWeeks: ptrInt(20), DueDate: ptrString("2026-01-01"),
						Purposes: []RecordPurpose{PurposeBookMaking}},
				},
			},
		},
		{
			name: "purposes empty",
			req: SubmitCaseRequest{
				Case: CaseC,
				Children: []ChildInput{
					{Kind: ChildKindChild, Gender: GenderFemale,
						DisplayName: ptrString("x"), BirthDate: ptrString("2023-01-01")},
				},
			},
		},
		{
			name: "invalid date",
			req: SubmitCaseRequest{
				Case: CaseC,
				Children: []ChildInput{
					{Kind: ChildKindChild, Gender: GenderFemale,
						DisplayName: ptrString("x"), BirthDate: ptrString("2023-13-99"),
						Purposes: []RecordPurpose{PurposeBookMaking}},
				},
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := tc.req.Validate(); err == nil {
				t.Errorf("expected validate error")
			}
		})
	}
}
