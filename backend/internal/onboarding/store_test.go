package onboarding

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	_ "modernc.org/sqlite"
)

// newTestDB creates an in-memory SQLite database with the post-migration
// schema (users + onboarding + records). Mirrors the real migration
// shape; kept in sync by the up migrations.
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
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

func seedUserWithOnboarding(t *testing.T, db *sql.DB, id, email string) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES (?, ?)`, id, email); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO onboarding (user_id) VALUES (?)`, id); err != nil {
		t.Fatalf("seed onboarding: %v", err)
	}
}

func TestUpdateDueDateAndOnboardedAt_WithDueDate(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	due := "2025-09-15"
	if err := store.UpdateDueDateAndOnboardedAt(ctx, "u1", &due); err != nil {
		t.Fatalf("update: %v", err)
	}
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate == nil || *o.DueDate != "2025-09-15" {
		t.Errorf("due_date: got %v want 2025-09-15", o.DueDate)
	}
	if o.OnboardedAt == nil {
		t.Errorf("onboarded_at should be set")
	}
}

func TestUpdateDueDateAndOnboardedAt_NullDueDate(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	if err := store.UpdateDueDateAndOnboardedAt(ctx, "u1", nil); err != nil {
		t.Fatalf("update: %v", err)
	}
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate != nil {
		t.Errorf("due_date: got %v want nil", *o.DueDate)
	}
	if o.OnboardedAt == nil {
		t.Errorf("onboarded_at should be set even when due_date is null")
	}
}

// TestUpdateDueDateAndOnboardedAt_SynthesizesFetusRow guards the legacy
// `PATCH /me {due_date}` path: it must seed a fetuses ordinal=1 row so
// the subsequent `POST /records` (which now requires child_kind/ordinal)
// has a real row to resolve against. Mirrors migration 0009's synthesis
// for pre-existing users.
func TestUpdateDueDateAndOnboardedAt_SynthesizesFetusRow(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	due := "2026-09-01"
	if err := store.UpdateDueDateAndOnboardedAt(ctx, "u1", &due); err != nil {
		t.Fatalf("update: %v", err)
	}

	var n int
	var seededDue sql.NullString
	if err := db.QueryRow(
		`SELECT COUNT(*), MAX(due_date) FROM fetuses WHERE user_id='u1' AND ordinal=1`,
	).Scan(&n, &seededDue); err != nil {
		t.Fatalf("count fetuses: %v", err)
	}
	if n != 1 {
		t.Fatalf("fetuses ordinal=1 count: got %d want 1", n)
	}
	if !seededDue.Valid || seededDue.String != due {
		t.Errorf("synthesized due_date: got %v want %s", seededDue, due)
	}
}

// TestUpdateDueDateAndOnboardedAt_PreservesExistingFetus protects against
// clobbering richer Case A data when an already-onboarded user later flips
// the dial through the legacy due_date endpoint (e.g., recovery flow).
func TestUpdateDueDateAndOnboardedAt_PreservesExistingFetus(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")
	if _, err := db.Exec(
		`INSERT INTO fetuses (user_id, ordinal, nickname, due_date) VALUES ('u1', 1, '봄이', '2025-09-15')`,
	); err != nil {
		t.Fatalf("seed fetus: %v", err)
	}

	store := &Store{DB: db}
	ctx := context.Background()
	due := "2026-09-01"
	if err := store.UpdateDueDateAndOnboardedAt(ctx, "u1", &due); err != nil {
		t.Fatalf("update: %v", err)
	}

	var nickname, fetusDue sql.NullString
	if err := db.QueryRow(
		`SELECT nickname, due_date FROM fetuses WHERE user_id='u1' AND ordinal=1`,
	).Scan(&nickname, &fetusDue); err != nil {
		t.Fatalf("requery fetus: %v", err)
	}
	if !nickname.Valid || nickname.String != "봄이" {
		t.Errorf("nickname should survive: got %v", nickname)
	}
	if !fetusDue.Valid || fetusDue.String != "2025-09-15" {
		t.Errorf("existing due_date should survive: got %v", fetusDue)
	}
}

// TestUpdateDueDateAndOnboardedAt_SkipsFetusWhenChildExists makes sure
// the 양육-first then-due_date path doesn't accidentally attribute records
// to a phantom fetus.
func TestUpdateDueDateAndOnboardedAt_SkipsFetusWhenChildExists(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")
	if _, err := db.Exec(
		`INSERT INTO children (user_id, ordinal, name, birth_date) VALUES ('u1', 1, '하늘', '2024-01-01')`,
	); err != nil {
		t.Fatalf("seed child: %v", err)
	}

	store := &Store{DB: db}
	ctx := context.Background()
	due := "2026-09-01"
	if err := store.UpdateDueDateAndOnboardedAt(ctx, "u1", &due); err != nil {
		t.Fatalf("update: %v", err)
	}

	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM fetuses WHERE user_id='u1'`).Scan(&n); err != nil {
		t.Fatalf("count fetuses: %v", err)
	}
	if n != 0 {
		t.Errorf("expected no fetus rows synthesized when child exists, got %d", n)
	}
}

// TestUpdateDueDateAndOnboardedAt_NullDoesNotSynthesize confirms that
// clearing the due_date (`null`) does not synthesize a fetus — the
// onboarding screen lets users explicitly skip the due_date, in which
// case Stage 2 should still display "no active child" rather than a
// blank phantom row.
func TestUpdateDueDateAndOnboardedAt_NullDoesNotSynthesize(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	if err := store.UpdateDueDateAndOnboardedAt(context.Background(), "u1", nil); err != nil {
		t.Fatalf("update: %v", err)
	}
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM fetuses WHERE user_id='u1'`).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Errorf("expected no fetus rows for null due_date, got %d", n)
	}
}

func TestUpdate_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	err := store.UpdateDueDateAndOnboardedAt(context.Background(), "missing", nil)
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestResetByEmail(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	due := "2025-09-15"
	if err := store.UpdateDueDateAndOnboardedAt(ctx, "u1", &due); err != nil {
		t.Fatalf("update: %v", err)
	}
	if err := store.ResetByEmail(ctx, "a@b.com"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate != nil || o.OnboardedAt != nil {
		t.Errorf("reset should clear: got due=%v onb=%v", o.DueDate, o.OnboardedAt)
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
		o.DueDate != nil ||
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

func ptrStr(s string) *string { return &s }
func ptrInt(i int) *int       { return &i }

func TestUpsertCaseA_InsertsAndStamps(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	due := "2025-09-15"
	fetuses := []Fetus{
		{Nickname: ptrStr("콩이"), Gender: ptrStr("unknown"), PregnancyWeek: ptrInt(17), DueDate: &due, Purposes: []string{"매일의 마음", "몸의 변화"}},
		{Nickname: ptrStr("쪼이"), Gender: ptrStr("female"), PregnancyWeek: ptrInt(17), DueDate: &due, Purposes: []string{"매일의 마음", "몸의 변화"}},
	}
	if err := store.UpsertCaseA(ctx, "u1", &due, fetuses); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate == nil || *o.DueDate != due {
		t.Errorf("due_date: got %v want %s", o.DueDate, due)
	}
	if o.OnboardedAt == nil {
		t.Error("onboarded_at should be set")
	}

	got, err := store.ListFetuses(ctx, "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("rows: got %d want 2", len(got))
	}
	if got[0].Ordinal != 0 || got[1].Ordinal != 1 {
		t.Errorf("ordinals: got %d, %d", got[0].Ordinal, got[1].Ordinal)
	}
	if got[0].Nickname == nil || *got[0].Nickname != "콩이" {
		t.Errorf("nickname[0]: got %v", got[0].Nickname)
	}
	if len(got[0].Purposes) != 2 || got[0].Purposes[0] != "매일의 마음" {
		t.Errorf("purposes: got %+v", got[0].Purposes)
	}
}

func TestUpsertCaseA_ReplacesExisting(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	due := "2025-09-15"

	// First upsert with 2 fetuses.
	if err := store.UpsertCaseA(ctx, "u1", &due, []Fetus{
		{Nickname: ptrStr("콩이"), Purposes: []string{"매일의 마음"}},
		{Nickname: ptrStr("쪼이"), Purposes: []string{"매일의 마음"}},
	}); err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	// Second upsert with 1 fetus — old rows should be deleted.
	if err := store.UpsertCaseA(ctx, "u1", &due, []Fetus{
		{Nickname: ptrStr("새콩"), Purposes: []string{"몸의 변화"}},
	}); err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	got, err := store.ListFetuses(ctx, "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("rows: got %d want 1", len(got))
	}
	if got[0].Nickname == nil || *got[0].Nickname != "새콩" {
		t.Errorf("nickname: got %v want 새콩", got[0].Nickname)
	}
	if len(got[0].Purposes) != 1 || got[0].Purposes[0] != "몸의 변화" {
		t.Errorf("purposes: got %+v", got[0].Purposes)
	}
}

func TestUpsertCaseA_NullDueDate(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	if err := store.UpsertCaseA(ctx, "u1", nil, []Fetus{{Purposes: []string{}}}); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate != nil {
		t.Errorf("due_date should be null: got %v", *o.DueDate)
	}
	if o.OnboardedAt == nil {
		t.Error("onboarded_at should be set")
	}
}

func TestUpsertCaseA_UserNotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	err := store.UpsertCaseA(context.Background(), "missing", nil, []Fetus{{Purposes: []string{}}})
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestUpsertCaseC_InsertsAndStamps(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	bd := "2023-04-01"
	children := []Child{
		{Name: ptrStr("민준"), Gender: ptrStr("male"), BirthDate: &bd, Bio: ptrStr("활발"), Purposes: []string{"일상의 발견", "말과 행동의 성장"}},
	}
	if err := store.UpsertCaseC(ctx, "u1", children); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate != nil {
		t.Errorf("due_date should be null for Case C: got %v", *o.DueDate)
	}
	if o.OnboardedAt == nil {
		t.Error("onboarded_at should be set")
	}

	got, err := store.ListChildren(ctx, "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("rows: got %d want 1", len(got))
	}
	if got[0].Name == nil || *got[0].Name != "민준" {
		t.Errorf("name: got %v", got[0].Name)
	}
	if len(got[0].Purposes) != 2 {
		t.Errorf("purposes: got %+v", got[0].Purposes)
	}
}

func TestUpsertCaseC_ReplacesExisting(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	if err := store.UpsertCaseC(ctx, "u1", []Child{
		{Name: ptrStr("민준"), Purposes: []string{"일상의 발견"}},
		{Name: ptrStr("서연"), Purposes: []string{"일상의 발견"}},
	}); err != nil {
		t.Fatalf("first upsert: %v", err)
	}
	if err := store.UpsertCaseC(ctx, "u1", []Child{
		{Name: ptrStr("새이름"), Purposes: []string{"음식·취향"}},
	}); err != nil {
		t.Fatalf("second upsert: %v", err)
	}
	got, err := store.ListChildren(ctx, "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(got) != 1 || got[0].Name == nil || *got[0].Name != "새이름" {
		t.Errorf("rows: got %+v", got)
	}
}

func TestUpsertCaseC_UserNotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	err := store.UpsertCaseC(context.Background(), "missing", []Child{{Purposes: []string{}}})
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}

func TestUpsertCaseB_InsertsBothAndStamps(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	due := "2025-09-15"
	bd := "2023-04-01"
	children := []Child{
		{Name: ptrStr("서연"), Gender: ptrStr("female"), BirthDate: &bd, Bio: ptrStr("활발"), Purposes: []string{"일상의 발견", "말과 행동의 성장"}},
	}
	fetuses := []Fetus{
		{Nickname: ptrStr("콩이"), Gender: ptrStr("unknown"), PregnancyWeek: ptrInt(17), DueDate: &due, Purposes: []string{"매일의 마음", "몸의 변화"}},
	}
	if err := store.UpsertCaseB(ctx, "u1", &due, children, fetuses); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate == nil || *o.DueDate != due {
		t.Errorf("due_date: got %v want %s", o.DueDate, due)
	}
	if o.OnboardedAt == nil {
		t.Error("onboarded_at should be set")
	}

	gotChildren, err := store.ListChildren(ctx, "u1")
	if err != nil {
		t.Fatalf("list children: %v", err)
	}
	if len(gotChildren) != 1 || gotChildren[0].Name == nil || *gotChildren[0].Name != "서연" {
		t.Errorf("children: got %+v", gotChildren)
	}
	if len(gotChildren[0].Purposes) != 2 || gotChildren[0].Purposes[0] != "일상의 발견" {
		t.Errorf("child purposes: got %+v", gotChildren[0].Purposes)
	}

	gotFetuses, err := store.ListFetuses(ctx, "u1")
	if err != nil {
		t.Fatalf("list fetuses: %v", err)
	}
	if len(gotFetuses) != 1 || gotFetuses[0].Nickname == nil || *gotFetuses[0].Nickname != "콩이" {
		t.Errorf("fetuses: got %+v", gotFetuses)
	}
	if len(gotFetuses[0].Purposes) != 2 || gotFetuses[0].Purposes[0] != "매일의 마음" {
		t.Errorf("fetus purposes: got %+v", gotFetuses[0].Purposes)
	}
}

func TestUpsertCaseB_NullDueDate(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	if err := store.UpsertCaseB(ctx, "u1", nil,
		[]Child{{Name: ptrStr("서연"), Purposes: []string{}}},
		[]Fetus{{Purposes: []string{}}},
	); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate != nil {
		t.Errorf("due_date should be null: got %v", *o.DueDate)
	}
	if o.OnboardedAt == nil {
		t.Error("onboarded_at should be set")
	}
}

func TestUpsertCaseB_ReplacesExisting(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")

	store := &Store{DB: db}
	ctx := context.Background()
	due := "2025-09-15"

	// First upsert: 2 children, 2 fetuses
	if err := store.UpsertCaseB(ctx, "u1", &due,
		[]Child{
			{Name: ptrStr("서연"), Purposes: []string{"일상의 발견"}},
			{Name: ptrStr("이서"), Purposes: []string{"일상의 발견"}},
		},
		[]Fetus{
			{Nickname: ptrStr("콩이"), Purposes: []string{"매일의 마음"}},
			{Nickname: ptrStr("샛별"), Purposes: []string{"매일의 마음"}},
		},
	); err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	// Second upsert: 1 of each — old rows must be deleted.
	if err := store.UpsertCaseB(ctx, "u1", &due,
		[]Child{{Name: ptrStr("새이름"), Purposes: []string{"음식·취향"}}},
		[]Fetus{{Nickname: ptrStr("새콩"), Purposes: []string{"몸의 변화"}}},
	); err != nil {
		t.Fatalf("second upsert: %v", err)
	}
	gotChildren, err := store.ListChildren(ctx, "u1")
	if err != nil {
		t.Fatalf("list children: %v", err)
	}
	if len(gotChildren) != 1 || *gotChildren[0].Name != "새이름" {
		t.Errorf("children: got %+v", gotChildren)
	}
	gotFetuses, err := store.ListFetuses(ctx, "u1")
	if err != nil {
		t.Fatalf("list fetuses: %v", err)
	}
	if len(gotFetuses) != 1 || *gotFetuses[0].Nickname != "새콩" {
		t.Errorf("fetuses: got %+v", gotFetuses)
	}
}

func TestUpsertCaseB_UserNotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	err := store.UpsertCaseB(context.Background(), "missing", nil,
		[]Child{{Purposes: []string{}}},
		[]Fetus{{Purposes: []string{}}},
	)
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err: got %v want ErrNotFound", err)
	}
}
