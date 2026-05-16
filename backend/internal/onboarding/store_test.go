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

// listFetusesForTest reads back the user's fetuses for upsert assertions.
// Replaces the production ListFetuses helper that used to live on Store;
// kept test-local since no production caller needs it.
func listFetusesForTest(t *testing.T, db *sql.DB, userID string) []Fetus {
	t.Helper()
	rows, err := db.Query(`
		SELECT ordinal, nickname, gender, pregnancy_week, due_date, purposes_json
		FROM fetuses WHERE user_id = ? ORDER BY ordinal ASC
	`, userID)
	if err != nil {
		t.Fatalf("select fetuses: %v", err)
	}
	defer rows.Close()
	var out []Fetus
	for rows.Next() {
		var f Fetus
		var nickname, gender, dueDate sql.NullString
		var pregnancyWeek sql.NullInt64
		var purposesJSON string
		if err := rows.Scan(&f.Ordinal, &nickname, &gender, &pregnancyWeek, &dueDate, &purposesJSON); err != nil {
			t.Fatalf("scan fetus: %v", err)
		}
		if nickname.Valid {
			v := nickname.String
			f.Nickname = &v
		}
		if gender.Valid {
			v := gender.String
			f.Gender = &v
		}
		if pregnancyWeek.Valid {
			v := int(pregnancyWeek.Int64)
			f.PregnancyWeek = &v
		}
		if dueDate.Valid {
			v := dueDate.String
			f.DueDate = &v
		}
		f.Purposes = parsePurposes(purposesJSON)
		out = append(out, f)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows.Err: %v", err)
	}
	return out
}

func listChildrenForTest(t *testing.T, db *sql.DB, userID string) []Child {
	t.Helper()
	rows, err := db.Query(`
		SELECT ordinal, name, gender, birth_date, bio, purposes_json
		FROM children WHERE user_id = ? ORDER BY ordinal ASC
	`, userID)
	if err != nil {
		t.Fatalf("select children: %v", err)
	}
	defer rows.Close()
	var out []Child
	for rows.Next() {
		var c Child
		var name, gender, birthDate, bio sql.NullString
		var purposesJSON string
		if err := rows.Scan(&c.Ordinal, &name, &gender, &birthDate, &bio, &purposesJSON); err != nil {
			t.Fatalf("scan child: %v", err)
		}
		if name.Valid {
			v := name.String
			c.Name = &v
		}
		if gender.Valid {
			v := gender.String
			c.Gender = &v
		}
		if birthDate.Valid {
			v := birthDate.String
			c.BirthDate = &v
		}
		if bio.Valid {
			v := bio.String
			c.Bio = &v
		}
		c.Purposes = parsePurposes(purposesJSON)
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows.Err: %v", err)
	}
	return out
}

func TestResetUserByEmail(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")
	// 다른 사용자의 데이터는 건드리지 않음을 확인하기 위한 대조군.
	seedUserWithOnboarding(t, db, "u2", "other@b.com")

	if _, err := db.Exec(
		`INSERT INTO children (user_id, ordinal, name, gender) VALUES (?, 0, 'Seoyeon', 'female')`, "u1",
	); err != nil {
		t.Fatalf("seed child u1: %v", err)
	}
	if _, err := db.Exec(
		`INSERT INTO fetuses (user_id, ordinal, nickname) VALUES (?, 0, 'Kongi')`, "u1",
	); err != nil {
		t.Fatalf("seed fetus u1: %v", err)
	}
	if _, err := db.Exec(
		`INSERT INTO records (id, user_id, content) VALUES ('r1', ?, 'mine')`, "u1",
	); err != nil {
		t.Fatalf("seed record u1: %v", err)
	}
	if _, err := db.Exec(
		`INSERT INTO records (id, user_id, content) VALUES ('r2', ?, 'theirs')`, "u2",
	); err != nil {
		t.Fatalf("seed record u2: %v", err)
	}

	store := &Store{DB: db}
	ctx := context.Background()
	if _, err := db.Exec(`
		UPDATE onboarding SET due_date = '2025-09-15', onboarded_at = datetime('now') WHERE user_id = 'u1'
	`); err != nil {
		t.Fatalf("seed onboarding fields: %v", err)
	}
	if err := store.ResetUserByEmail(ctx, "a@b.com"); err != nil {
		t.Fatalf("reset: %v", err)
	}

	o, err := store.GetByID(ctx, "u1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if o.DueDate != nil || o.OnboardedAt != nil {
		t.Errorf("reset should clear onboarding fields: got due=%v onb=%v", o.DueDate, o.OnboardedAt)
	}

	countByUser := func(table, userID string) int {
		t.Helper()
		var n int
		row := db.QueryRow(`SELECT COUNT(*) FROM `+table+` WHERE user_id = ?`, userID)
		if err := row.Scan(&n); err != nil {
			t.Fatalf("count %s for %s: %v", table, userID, err)
		}
		return n
	}
	for _, tbl := range []string{"children", "fetuses", "records"} {
		if n := countByUser(tbl, "u1"); n != 0 {
			t.Errorf("%s rows for u1 after reset: got %d want 0", tbl, n)
		}
	}
	// 다른 사용자의 데이터는 그대로.
	if n := countByUser("records", "u2"); n != 1 {
		t.Errorf("records for u2 after reset: got %d want 1", n)
	}
}

func TestResetUserByEmail_OnboardingRowAutoCreated(t *testing.T) {
	// 어떤 이유로 onboarding 행이 없는 사용자도 reset 후엔 깨끗한 행 한 줄이
	// 보장돼 다음 로그인 / GetByID 가 깨지지 않는다.
	db := newTestDB(t)
	defer db.Close()
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES (?, ?)`, "u1", "a@b.com"); err != nil {
		t.Fatalf("seed user: %v", err)
	}

	store := &Store{DB: db}
	if err := store.ResetUserByEmail(context.Background(), "a@b.com"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	if _, err := store.GetByID(context.Background(), "u1"); err != nil {
		t.Fatalf("get: %v", err)
	}
}

func TestResetUserByEmail_NotFound(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := &Store{DB: db}
	err := store.ResetUserByEmail(context.Background(), "missing@example.com")
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

	got := listFetusesForTest(t, db, "u1")
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

	got := listFetusesForTest(t, db, "u1")
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

	got := listChildrenForTest(t, db, "u1")
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
	got := listChildrenForTest(t, db, "u1")
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

	gotChildren := listChildrenForTest(t, db, "u1")
	if len(gotChildren) != 1 || gotChildren[0].Name == nil || *gotChildren[0].Name != "서연" {
		t.Errorf("children: got %+v", gotChildren)
	}
	if len(gotChildren[0].Purposes) != 2 || gotChildren[0].Purposes[0] != "일상의 발견" {
		t.Errorf("child purposes: got %+v", gotChildren[0].Purposes)
	}

	gotFetuses := listFetusesForTest(t, db, "u1")
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
	gotChildren := listChildrenForTest(t, db, "u1")
	if len(gotChildren) != 1 || *gotChildren[0].Name != "새이름" {
		t.Errorf("children: got %+v", gotChildren)
	}
	gotFetuses := listFetusesForTest(t, db, "u1")
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
