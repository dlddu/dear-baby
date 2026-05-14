package db

import (
	"database/sql"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	msqlite "github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "modernc.org/sqlite"

	"github.com/dlddu/dear-baby/backend/internal/migrations"
)

// newMigrator wires the embedded migration set against an in-memory
// SQLite. Tests use it to run partial migrations (Migrate(n)) so they
// can seed pre-0009 data, then step forward to 0009 and assert the
// backfill produced the right rows.
//
// Returns the underlying *sql.DB so tests can introspect rows after
// each migration step. The caller owns Close() on both the migrator
// and the DB.
func newMigrator(t *testing.T) (*migrate.Migrate, *sql.DB) {
	t.Helper()
	db, err := sql.Open("sqlite", "file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	db.SetMaxOpenConns(1)
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		t.Fatalf("iofs: %v", err)
	}
	drv, err := msqlite.WithInstance(db, &msqlite.Config{})
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	m, err := migrate.NewWithInstance("iofs", src, "sqlite", drv)
	if err != nil {
		t.Fatalf("migrator: %v", err)
	}
	return m, db
}

func seedUserAndOnboarding(t *testing.T, db *sql.DB, userID, email string, dueDate *string) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES (?, ?)`, userID, email); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if dueDate == nil {
		if _, err := db.Exec(`INSERT INTO onboarding (user_id) VALUES (?)`, userID); err != nil {
			t.Fatalf("seed onboarding: %v", err)
		}
		return
	}
	if _, err := db.Exec(
		`INSERT INTO onboarding (user_id, due_date) VALUES (?, ?)`,
		userID, *dueDate,
	); err != nil {
		t.Fatalf("seed onboarding: %v", err)
	}
}

func insertLegacyRecord(t *testing.T, db *sql.DB, userID, content string) {
	t.Helper()
	if _, err := db.Exec(
		`INSERT INTO records (id, user_id, content, source) VALUES (?, ?, ?, 'text')`,
		"rec-"+userID+"-"+content, userID, content,
	); err != nil {
		t.Fatalf("seed record: %v", err)
	}
}

// TestMigration0009_BackfillsAllCases exercises every backfill branch in
// one DB so we can assert that:
//   - users with `children` rows get ('child', 1) on every record
//   - users with `fetuses` but no children get ('fetus', 1)
//   - users with neither but onboarding.due_date get a synthesized
//     fetuses row and ('fetus', 1)
//   - users with both children and fetuses prefer ('child', 1)
//   - the migration aborts cleanly when a record cannot be attributed
//     (covered separately in TestMigration0009_FailsWhenUnattributable)
//
// Asserting that no records are silently dropped is the regression net
// for the journey #4 pain point — multi-child users seeing records
// land on the wrong baby.
func TestMigration0009_BackfillsAllCases(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()

	if err := m.Migrate(8); err != nil {
		t.Fatalf("migrate to 0008: %v", err)
	}

	// uChild: 양육 단일 — children ordinal=1.
	seedUserAndOnboarding(t, db, "uChild", "child@b.com", nil)
	if _, err := db.Exec(
		`INSERT INTO children (user_id, ordinal, name, birth_date) VALUES ('uChild', 1, '첫째', '2024-01-01')`,
	); err != nil {
		t.Fatalf("seed children: %v", err)
	}
	insertLegacyRecord(t, db, "uChild", "양육 단일 1")
	insertLegacyRecord(t, db, "uChild", "양육 단일 2")

	// uChildren: 다자녀 양육 — children ordinal=1, 2.
	seedUserAndOnboarding(t, db, "uChildren", "children@b.com", nil)
	if _, err := db.Exec(
		`INSERT INTO children (user_id, ordinal, name, birth_date) VALUES
		 ('uChildren', 1, '첫째', '2023-01-01'),
		 ('uChildren', 2, '둘째', '2024-06-01')`,
	); err != nil {
		t.Fatalf("seed multi children: %v", err)
	}
	insertLegacyRecord(t, db, "uChildren", "다자녀")

	// uFetus: 임신 단일 — fetuses ordinal=1.
	seedUserAndOnboarding(t, db, "uFetus", "fetus@b.com", nil)
	if _, err := db.Exec(
		`INSERT INTO fetuses (user_id, ordinal, nickname, due_date) VALUES ('uFetus', 1, '아가', '2025-12-25')`,
	); err != nil {
		t.Fatalf("seed fetuses: %v", err)
	}
	insertLegacyRecord(t, db, "uFetus", "임신 단일")

	// uMulti: 다태아 — fetuses ordinal=1, 2.
	seedUserAndOnboarding(t, db, "uMulti", "multi@b.com", nil)
	if _, err := db.Exec(
		`INSERT INTO fetuses (user_id, ordinal, due_date) VALUES
		 ('uMulti', 1, '2025-09-15'),
		 ('uMulti', 2, '2025-09-15')`,
	); err != nil {
		t.Fatalf("seed multi fetuses: %v", err)
	}
	insertLegacyRecord(t, db, "uMulti", "다태아")

	// uDueOnly: 호환 경로 — 옛 completeOnboarding(dueDate) 만 호출한 사용자.
	// onboarding.due_date 가 있고 fetuses/children 은 비어 있다.
	due := "2025-11-30"
	seedUserAndOnboarding(t, db, "uDueOnly", "dueonly@b.com", &due)
	insertLegacyRecord(t, db, "uDueOnly", "호환 경로")

	// uBoth: Case B — 양육 + 임신 동시. children ordinal=1 이 있어서
	// records 는 ('child', 1) 로 backfill 되어야 한다.
	seedUserAndOnboarding(t, db, "uBoth", "both@b.com", &due)
	if _, err := db.Exec(
		`INSERT INTO children (user_id, ordinal, name, birth_date) VALUES ('uBoth', 1, '첫째', '2022-08-08')`,
	); err != nil {
		t.Fatalf("seed both children: %v", err)
	}
	if _, err := db.Exec(
		`INSERT INTO fetuses (user_id, ordinal, due_date) VALUES ('uBoth', 1, ?)`, due,
	); err != nil {
		t.Fatalf("seed both fetuses: %v", err)
	}
	insertLegacyRecord(t, db, "uBoth", "Case B")

	if err := m.Migrate(9); err != nil {
		t.Fatalf("migrate to 0009: %v", err)
	}

	// No NULLs in either column — that is the migration's hard guarantee.
	var nullCount int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM records WHERE child_kind IS NULL OR child_ordinal IS NULL`,
	).Scan(&nullCount); err != nil {
		t.Fatalf("count null: %v", err)
	}
	if nullCount != 0 {
		t.Errorf("expected 0 NULL rows, got %d", nullCount)
	}

	wantKind := map[string]string{
		"uChild":    "child",
		"uChildren": "child",
		"uFetus":    "fetus",
		"uMulti":    "fetus",
		"uDueOnly":  "fetus",
		"uBoth":     "child",
	}
	for userID, want := range wantKind {
		rows, err := db.Query(
			`SELECT child_kind, child_ordinal FROM records WHERE user_id = ?`, userID,
		)
		if err != nil {
			t.Fatalf("query %s: %v", userID, err)
		}
		got := 0
		for rows.Next() {
			got++
			var kind string
			var ordinal int
			if err := rows.Scan(&kind, &ordinal); err != nil {
				rows.Close()
				t.Fatalf("scan %s: %v", userID, err)
			}
			if kind != want {
				t.Errorf("%s: kind got %q want %q", userID, kind, want)
			}
			if ordinal != 1 {
				t.Errorf("%s: ordinal got %d want 1", userID, ordinal)
			}
		}
		rows.Close()
		if got == 0 {
			t.Errorf("%s: no records found post-migration", userID)
		}
	}

	// uDueOnly should have had a fetuses row synthesized — same due_date
	// that was on the onboarding row.
	var fetusDue sql.NullString
	if err := db.QueryRow(
		`SELECT due_date FROM fetuses WHERE user_id='uDueOnly' AND ordinal=1`,
	).Scan(&fetusDue); err != nil {
		t.Fatalf("synthesized fetus due_date: %v", err)
	}
	if !fetusDue.Valid || fetusDue.String != due {
		t.Errorf("synthesized fetus due_date: got %v want %s", fetusDue, due)
	}
}

// TestMigration0009_FailsWhenUnattributable confirms the fail-fast
// behaviour: a record belonging to a user with no children, no fetuses,
// and no onboarding.due_date cannot be assigned a (kind, ordinal), and
// the migration must abort rather than drop the row silently.
func TestMigration0009_FailsWhenUnattributable(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()

	if err := m.Migrate(8); err != nil {
		t.Fatalf("migrate to 0008: %v", err)
	}

	seedUserAndOnboarding(t, db, "uOrphan", "orphan@b.com", nil)
	insertLegacyRecord(t, db, "uOrphan", "고아 기록")

	if err := m.Migrate(9); err == nil {
		t.Fatal("expected migration to fail when a record has no attributable child")
	}
}

// TestMigration0009_UpDownRoundtrip exercises the down step: 0009 down
// drops the child_kind/child_ordinal columns and re-running 0009 up
// after a down lands on a clean schema (no leftover indexes, no
// duplicate columns).
func TestMigration0009_UpDownRoundtrip(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()

	// Up to 0008 first so we have a sane base.
	if err := m.Migrate(8); err != nil {
		t.Fatalf("migrate to 0008: %v", err)
	}
	seedUserAndOnboarding(t, db, "u1", "u1@b.com", nil)
	if _, err := db.Exec(
		`INSERT INTO fetuses (user_id, ordinal, due_date) VALUES ('u1', 1, '2025-09-15')`,
	); err != nil {
		t.Fatalf("seed fetus: %v", err)
	}
	insertLegacyRecord(t, db, "u1", "before")

	if err := m.Migrate(9); err != nil {
		t.Fatalf("migrate to 0009: %v", err)
	}
	// child_kind column must exist after up.
	if !hasColumn(t, db, "records", "child_kind") {
		t.Fatal("expected child_kind column after up")
	}

	if err := m.Migrate(8); err != nil {
		t.Fatalf("migrate down to 0008: %v", err)
	}
	if hasColumn(t, db, "records", "child_kind") {
		t.Fatal("expected child_kind column gone after down")
	}

	if err := m.Migrate(9); err != nil {
		t.Fatalf("re-apply 0009 after down: %v", err)
	}
	if !hasColumn(t, db, "records", "child_kind") {
		t.Fatal("expected child_kind column after second up")
	}
}

func hasColumn(t *testing.T, db *sql.DB, table, column string) bool {
	t.Helper()
	rows, err := db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		t.Fatalf("pragma: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			cid     int
			name    string
			ctype   string
			notnull int
			dflt    sql.NullString
			pk      int
		)
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan: %v", err)
		}
		if name == column {
			return true
		}
	}
	return false
}
