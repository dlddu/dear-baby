package children

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	_ "modernc.org/sqlite"
)

// newTestDB mirrors the post-migration schema: users + onboarding +
// children + child_purposes. Kept inline so the package's tests don't
// depend on the migration runner; the columns/CHECK constraints stay in
// sync with 0008_onboarding_cases.up.sql by hand.
func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file::memory:?cache=shared&_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`PRAGMA foreign_keys = ON`); err != nil {
		t.Fatalf("fk: %v", err)
	}
	schema := `
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE
);
CREATE TABLE children (
  id                      TEXT PRIMARY KEY,
  user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                  TEXT NOT NULL CHECK (status IN ('parenting','pregnancy')),
  name                    TEXT,
  gender                  TEXT NOT NULL CHECK (gender IN ('female','male','unknown')),
  birth_date              TEXT,
  due_date                TEXT,
  pregnancy_week          INTEGER,
  bio                     TEXT,
  photo_s3_key            TEXT,
  is_due_date_undecided   INTEGER NOT NULL DEFAULT 0,
  display_order           INTEGER NOT NULL DEFAULT 0,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (status = 'parenting' AND birth_date IS NOT NULL)
    OR
    (status = 'pregnancy' AND (due_date IS NOT NULL OR is_due_date_undecided = 1))
  )
);
CREATE TABLE child_purposes (
  child_id  TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  purpose   TEXT NOT NULL,
  position  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (child_id, purpose)
);
`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("schema: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES ('u1', 'a@b.com')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return db
}

func strPtr(s string) *string { return &s }

func TestReplaceAll_Pregnancy_WithDueDate(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	store := &Store{DB: db}
	dueDate := "2026-09-15"
	week := 12
	bio := "잘 웃는 우리 콩이"
	out, err := store.ReplaceAll(context.Background(), "u1", []ChildInput{{
		Status:        StatusPregnancy,
		Name:          strPtr("콩이"),
		Gender:        GenderUnknown,
		DueDate:       &dueDate,
		PregnancyWeek: &week,
		Bio:           &bio,
		Purposes:      []string{"letter", "diary"},
	}})
	if err != nil {
		t.Fatalf("replace: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("len: %d", len(out))
	}
	got := out[0]
	if got.Status != StatusPregnancy || got.Gender != GenderUnknown {
		t.Errorf("status/gender: %+v", got)
	}
	if got.DueDate == nil || *got.DueDate != dueDate {
		t.Errorf("due_date: %v", got.DueDate)
	}
	if got.PregnancyWeek == nil || *got.PregnancyWeek != week {
		t.Errorf("week: %v", got.PregnancyWeek)
	}

	listed, purposes, err := store.ListByUser(context.Background(), "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(listed) != 1 || listed[0].ID != got.ID {
		t.Errorf("list: %+v", listed)
	}
	ps := purposes[got.ID]
	if len(ps) != 2 || ps[0] != "letter" || ps[1] != "diary" {
		t.Errorf("purposes: %+v", ps)
	}
}

func TestReplaceAll_Pregnancy_Undecided(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	store := &Store{DB: db}
	out, err := store.ReplaceAll(context.Background(), "u1", []ChildInput{{
		Status:             StatusPregnancy,
		Gender:             GenderUnknown,
		IsDueDateUndecided: true,
	}})
	if err != nil {
		t.Fatalf("replace: %v", err)
	}
	if !out[0].IsDueDateUndecided {
		t.Errorf("undecided: %+v", out[0])
	}
}

func TestReplaceAll_Parenting_RequiresBirthDate(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	store := &Store{DB: db}
	_, err := store.ReplaceAll(context.Background(), "u1", []ChildInput{{
		Status: StatusParenting,
		Gender: GenderFemale,
	}})
	if !errors.Is(err, ErrInvalidChild) {
		t.Errorf("err: %v want ErrInvalidChild", err)
	}
}

func TestReplaceAll_Pregnancy_RequiresDueDateOrUndecided(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	store := &Store{DB: db}
	_, err := store.ReplaceAll(context.Background(), "u1", []ChildInput{{
		Status: StatusPregnancy,
		Gender: GenderUnknown,
	}})
	if !errors.Is(err, ErrInvalidChild) {
		t.Errorf("err: %v want ErrInvalidChild", err)
	}
}

func TestReplaceAll_InvalidStatus(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	store := &Store{DB: db}
	_, err := store.ReplaceAll(context.Background(), "u1", []ChildInput{{
		Status: Status("bogus"),
		Gender: GenderUnknown,
	}})
	if !errors.Is(err, ErrInvalidChild) {
		t.Errorf("err: %v want ErrInvalidChild", err)
	}
}

func TestReplaceAll_OverwritesPrior(t *testing.T) {
	// Re-running onboarding submission must replace, not append. Order
	// preservation is checked here too — the second call's children
	// must come back in input order via display_order.
	db := newTestDB(t)
	defer db.Close()
	store := &Store{DB: db}
	birth := "2023-04-21"
	first, err := store.ReplaceAll(context.Background(), "u1", []ChildInput{{
		Status:    StatusParenting,
		Name:      strPtr("First"),
		Gender:    GenderMale,
		BirthDate: &birth,
		Purposes:  []string{"diary"},
	}})
	if err != nil {
		t.Fatalf("first: %v", err)
	}

	birth2 := "2024-07-10"
	out, err := store.ReplaceAll(context.Background(), "u1", []ChildInput{
		{Status: StatusParenting, Name: strPtr("A"), Gender: GenderFemale, BirthDate: &birth, Purposes: []string{"book"}},
		{Status: StatusParenting, Name: strPtr("B"), Gender: GenderMale, BirthDate: &birth2, Purposes: []string{"diary", "share"}},
	})
	if err != nil {
		t.Fatalf("second: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("len: %d", len(out))
	}
	if out[0].DisplayOrder != 0 || out[1].DisplayOrder != 1 {
		t.Errorf("order: %+v", out)
	}

	listed, purposes, err := store.ListByUser(context.Background(), "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(listed) != 2 {
		t.Errorf("listed: %d want 2", len(listed))
	}
	for _, l := range listed {
		if l.ID == first[0].ID {
			t.Errorf("prior child should be deleted: %s", l.ID)
		}
	}
	if got := purposes[out[1].ID]; len(got) != 2 || got[0] != "diary" || got[1] != "share" {
		t.Errorf("purposes order: %+v", got)
	}
}

func TestListByUser_EmptyReturnsEmptySlice(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	store := &Store{DB: db}
	out, purposes, err := store.ListByUser(context.Background(), "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if out == nil {
		t.Errorf("children should be empty slice, not nil")
	}
	if purposes == nil {
		t.Errorf("purposes should be empty map, not nil")
	}
}

func TestDeleteAll(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	store := &Store{DB: db}
	birth := "2023-04-21"
	if _, err := store.ReplaceAll(context.Background(), "u1", []ChildInput{{
		Status: StatusParenting, Name: strPtr("A"), Gender: GenderFemale, BirthDate: &birth,
		Purposes: []string{"diary"},
	}}); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if err := store.DeleteAll(context.Background(), "u1"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	out, _, err := store.ListByUser(context.Background(), "u1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(out) != 0 {
		t.Errorf("children should be deleted: %+v", out)
	}
	// child_purposes should cascade-delete with the child.
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM child_purposes`).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Errorf("purposes should cascade: %d", n)
	}
}

func TestDeleteAll_Idempotent(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	store := &Store{DB: db}
	if err := store.DeleteAll(context.Background(), "missing"); err != nil {
		t.Errorf("err: %v", err)
	}
}
