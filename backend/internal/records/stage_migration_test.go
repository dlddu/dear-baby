package records

import (
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	msqlite "github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "modernc.org/sqlite"

	"github.com/dlddu/dear-baby/backend/internal/migrations"
)

// Migration 0013 backfills the 단계 스냅샷 of every pre-existing record with
// SQL, while every later write goes through computeStageSnapshot in Go. That
// is two implementations of the same ENG-001 formula, which is only safe if
// they are proven equal at the moment of introduction — after that the
// migration is frozen history (an applied migration can't be edited) and the
// Go calculator is the sole authority.
//
// These tests reproduce the real production upgrade path: migrate to 0012,
// seed legacy rows that predate the stage columns, then step to 0013.

// migrateTo builds a migrator over the embedded migrations and moves the DB to
// the requested version.
func migrateTo(t *testing.T, d *sql.DB, version uint) {
	t.Helper()
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		t.Fatalf("iofs: %v", err)
	}
	drv, err := msqlite.WithInstance(d, &msqlite.Config{})
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	m, err := migrate.NewWithInstance("iofs", src, "sqlite", drv)
	if err != nil {
		t.Fatalf("migrate.NewWithInstance: %v", err)
	}
	if err := m.Migrate(version); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("migrate to %d: %v", version, err)
	}
}

func openMigrationTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := "file:" + t.TempDir() + "/db.sqlite?_pragma=foreign_keys(1)"
	d, err := sql.Open("sqlite", dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	d.SetMaxOpenConns(1)
	t.Cleanup(func() { d.Close() })
	return d
}

// stageCase is one legacy record seeded before 0013 runs: a subject of `kind`
// whose 기준값 is `basis` (empty means NULL), and a record written on `writtenOn`.
type stageCase struct {
	name      string
	kind      string // "fetus" | "child"
	basis     string // due_date for fetus, birth_date for child; "" => NULL
	writtenOn string // YYYY-MM-DD
}

// stageCases walks every branch of the ENG-001 경계값 표 plus the calendar-month
// corners the 말일 절사 rule turns on. Pregnancy offsets are expressed relative
// to the write day so the ±35 / ±315 day caps land exactly on their boundary.
func stageCases() []stageCase {
	const day = "2026-08-08"
	off := func(base string, days int) string {
		t, err := time.Parse(dateLayout, base)
		if err != nil {
			panic(err)
		}
		return t.AddDate(0, 0, days).Format(dateLayout)
	}
	return []stageCase{
		// --- 임신 축 ---
		{"fetus/due null", "fetus", "", day},
		{"fetus/past cap inside (-35d)", "fetus", off(day, -35), day},
		{"fetus/past cap outside (-36d)", "fetus", off(day, -36), day},
		{"fetus/future cap inside (+315d)", "fetus", off(day, 315), day},
		{"fetus/future cap outside (+316d)", "fetus", off(day, 316), day},
		{"fetus/beyond full term clamps to 0", "fetus", off(day, 300), day},
		{"fetus/exactly full term", "fetus", off(day, 280), day},
		{"fetus/mid pregnancy", "fetus", off(day, 100), day},
		{"fetus/due today", "fetus", day, day},
		// --- 양육 축 ---
		{"child/birth null", "child", "", day},
		{"child/birth in the future", "child", off(day, 1), day},
		{"child/born today", "child", day, day},
		{"child/one month", "child", "2026-03-15", "2026-04-15"},
		{"child/one day short of a month", "child", "2026-03-15", "2026-04-14"},
		{"child/month-end truncation hits", "child", "2026-01-31", "2026-02-28"},
		{"child/month-end truncation misses", "child", "2026-01-31", "2026-02-27"},
		{"child/month-end leap year", "child", "2024-01-31", "2024-02-29"},
		{"child/month-end two months", "child", "2026-01-31", "2026-03-30"},
		{"child/31-day month end", "child", "2026-05-31", "2026-06-30"},
		{"child/one year", "child", "2025-08-08", "2026-08-08"},
		{"child/thirteen months", "child", "2025-07-08", "2026-08-08"},
		{"child/twenty years", "child", "2006-08-08", "2026-08-08"},
	}
}

// seedStageCases inserts one subject + one record per case into a v0012 DB and
// returns record ids in case order.
func seedStageCases(t *testing.T, d *sql.DB, cases []stageCase) []string {
	t.Helper()
	if _, err := d.Exec(`INSERT INTO users (id, email) VALUES ('u1','a@b.com')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := d.Exec(`INSERT INTO onboarding (user_id) VALUES ('u1')`); err != nil {
		t.Fatalf("seed onboarding: %v", err)
	}
	ids := make([]string, len(cases))
	for i, c := range cases {
		subjectID := fmt.Sprintf("subject-%02d", i)
		recordID := fmt.Sprintf("record-%02d", i)
		ids[i] = recordID
		if _, err := d.Exec(
			`INSERT INTO record_subjects (id, user_id, kind, ordinal) VALUES (?, 'u1', ?, ?)`,
			subjectID, c.kind, i,
		); err != nil {
			t.Fatalf("seed subject %s: %v", c.name, err)
		}
		var basis any
		if c.basis != "" {
			basis = c.basis
		}
		switch c.kind {
		case "fetus":
			_, err := d.Exec(
				`INSERT INTO fetuses (id, user_id, ordinal, due_date) VALUES (?, 'u1', ?, ?)`,
				subjectID, i, basis)
			if err != nil {
				t.Fatalf("seed fetus %s: %v", c.name, err)
			}
		case "child":
			_, err := d.Exec(
				`INSERT INTO children (id, user_id, ordinal, birth_date) VALUES (?, 'u1', ?, ?)`,
				subjectID, i, basis)
			if err != nil {
				t.Fatalf("seed child %s: %v", c.name, err)
			}
		}
		if _, err := d.Exec(`
			INSERT INTO records (id, user_id, subject_id, content, visibility, created_at)
			VALUES (?, 'u1', ?, 'legacy', 'private', ?)
		`, recordID, subjectID, c.writtenOn+" 09:30:00"); err != nil {
			t.Fatalf("seed record %s: %v", c.name, err)
		}
	}
	return ids
}

func readSnapshot(t *testing.T, d *sql.DB, recordID string) stageSnapshot {
	t.Helper()
	var (
		kind   sql.NullString
		days   sql.NullInt64
		months sql.NullInt64
	)
	if err := d.QueryRow(
		`SELECT stage_kind, stage_days, stage_months FROM records WHERE id = ?`, recordID,
	).Scan(&kind, &days, &months); err != nil {
		t.Fatalf("read snapshot %s: %v", recordID, err)
	}
	var out stageSnapshot
	if kind.Valid {
		v := kind.String
		out.Kind = &v
	}
	if days.Valid {
		v := int(days.Int64)
		out.Days = &v
	}
	if months.Valid {
		v := int(months.Int64)
		out.Months = &v
	}
	return out
}

func formatSnapshot(s stageSnapshot) string {
	f := func(p *int) string {
		if p == nil {
			return "nil"
		}
		return fmt.Sprint(*p)
	}
	k := "nil"
	if s.Kind != nil {
		k = *s.Kind
	}
	return fmt.Sprintf("{kind:%s days:%s months:%s}", k, f(s.Days), f(s.Months))
}

// TestMigration0013_BackfillMatchesGoCalculator is the contract that lets the
// backfill SQL and the Go calculator coexist: for every input in the ENG-001
// boundary matrix, the value migration 0013 writes must equal the value
// computeStageSnapshot would produce for the same (작성일, 기준값).
func TestMigration0013_BackfillMatchesGoCalculator(t *testing.T) {
	d := openMigrationTestDB(t)
	migrateTo(t, d, 12)

	cases := stageCases()
	ids := seedStageCases(t, d, cases)

	migrateTo(t, d, 13)

	for i, c := range cases {
		got := readSnapshot(t, d, ids[i])

		writtenAt, err := time.Parse(sqliteTimeLayout, c.writtenOn+" 09:30:00")
		if err != nil {
			t.Fatalf("%s: parse written at: %v", c.name, err)
		}
		basis := sql.NullString{String: c.basis, Valid: c.basis != ""}
		var want stageSnapshot
		switch c.kind {
		case "fetus":
			want = computeStageSnapshot(c.kind, basis, sql.NullString{}, writtenAt)
		case "child":
			want = computeStageSnapshot(c.kind, sql.NullString{}, basis, writtenAt)
		}

		if formatSnapshot(got) != formatSnapshot(want) {
			t.Errorf("%s: migration backfill %s, Go calculator %s",
				c.name, formatSnapshot(got), formatSnapshot(want))
		}
	}
}

// TestMigration0013_BackfillPopulatesAndLeavesUnknowable verifies the backfill
// actually did work (a calculator that returns nil everywhere would satisfy the
// equivalence test on its own) and that rows whose stage can't be derived stay
// NULL rather than being invented.
func TestMigration0013_BackfillPopulatesAndLeavesUnknowable(t *testing.T) {
	d := openMigrationTestDB(t)
	migrateTo(t, d, 12)

	cases := stageCases()
	ids := seedStageCases(t, d, cases)
	migrateTo(t, d, 13)

	byName := map[string]stageSnapshot{}
	for i, c := range cases {
		byName[c.name] = readSnapshot(t, d, ids[i])
	}

	// 임신 축이 실제로 채워졌는가 — 100일 남은 예정일이면 daysPregnant = 180.
	if s := byName["fetus/mid pregnancy"]; s.Kind == nil || *s.Kind != stageKindPregnancy ||
		s.Days == nil || *s.Days != 180 || s.Months != nil {
		t.Errorf("fetus/mid pregnancy: got %s, want {pregnancy 180 nil}", formatSnapshot(s))
	}
	// 40주를 넘는 미래 예정일은 숨기지 않고 0 으로 clamp (ENG-001).
	if s := byName["fetus/beyond full term clamps to 0"]; s.Days == nil || *s.Days != 0 {
		t.Errorf("clamp case: got %s, want days=0", formatSnapshot(s))
	}
	// 양육 축은 일수와 달력 개월을 모두 채운다.
	if s := byName["child/one year"]; s.Kind == nil || *s.Kind != stageKindPostnatal ||
		s.Days == nil || *s.Days != 365 || s.Months == nil || *s.Months != 12 {
		t.Errorf("child/one year: got %s, want {postnatal 365 12}", formatSnapshot(s))
	}
	// 말일 출생은 그 달의 마지막 날로 절사된다 — 1/31 생은 2/28 에 1개월.
	if s := byName["child/month-end truncation hits"]; s.Months == nil || *s.Months != 1 {
		t.Errorf("month-end hit: got %s, want months=1", formatSnapshot(s))
	}
	if s := byName["child/month-end truncation misses"]; s.Months == nil || *s.Months != 0 {
		t.Errorf("month-end miss: got %s, want months=0", formatSnapshot(s))
	}
	// 산출 불가는 지어내지 않는다 — 세 컬럼 모두 NULL.
	for _, name := range []string{
		"fetus/due null", "fetus/past cap outside (-36d)", "fetus/future cap outside (+316d)",
		"child/birth null", "child/birth in the future",
	} {
		s := byName[name]
		if s.Kind != nil || s.Days != nil || s.Months != nil {
			t.Errorf("%s: got %s, want all nil", name, formatSnapshot(s))
		}
	}
}

// TestMigration0013_DownDropsColumns proves the rollback path works: the
// snapshot is a cache of a pure function, so dropping the columns loses no
// information and the migration can be stepped back.
func TestMigration0013_DownDropsColumns(t *testing.T) {
	d := openMigrationTestDB(t)
	migrateTo(t, d, 12)
	seedStageCases(t, d, stageCases())
	migrateTo(t, d, 13)

	if _, err := d.Exec(`SELECT stage_kind FROM records LIMIT 1`); err != nil {
		t.Fatalf("stage_kind should exist at v13: %v", err)
	}

	migrateTo(t, d, 12)

	for _, col := range []string{"stage_kind", "stage_days", "stage_months"} {
		if _, err := d.Exec(`SELECT ` + col + ` FROM records LIMIT 1`); err == nil {
			t.Errorf("%s should be gone after down migration", col)
		}
	}
	var n int
	if err := d.QueryRow(`SELECT count(*) FROM records`).Scan(&n); err != nil {
		t.Fatalf("count records: %v", err)
	}
	if want := len(stageCases()); n != want {
		t.Errorf("down migration lost rows: got %d, want %d", n, want)
	}
}
