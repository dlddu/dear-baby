package db

import (
	"database/sql"
	"errors"
	"path/filepath"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	msqlite "github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "modernc.org/sqlite"

	"github.com/dlddu/dear-baby/backend/internal/migrations"
)

// openMigratorAt 는 같은 파일 기반 SQLite DB 에 대해 migrate.Migrate 인스턴스를
// 새로 만든다. golang-migrate 는 인스턴스를 한 번 사용한 뒤 Close() 가
// migration 의 driver 를 닫아 버려서 같은 *sql.DB 를 그대로 재사용할 수 없다.
// 그래서 매 단계마다 새 *sql.DB 와 새 Migrator 를 묶어 쓴다.
func openMigratorAt(t *testing.T, dsn string) (*sql.DB, *migrate.Migrate) {
	t.Helper()
	d, err := sql.Open("sqlite", dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	d.SetMaxOpenConns(1)
	if err := d.Ping(); err != nil {
		t.Fatalf("ping: %v", err)
	}
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
	return d, m
}

// fileDSN — 파일 기반 SQLite. 단일 테스트 디렉터리에 두고 같은 파일을 여러
// 단계에 걸쳐 열고 닫는다.
func fileDSN(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	return "file:" + filepath.Join(dir, "dear-baby-migrate-test.db") + "?_pragma=foreign_keys(1)"
}

// migrationCount 는 backfill 검증에서 단계 진행 기준이 되는 버전 번호. 0009
// 백필이 0008 직후에 도는지 확인하려면 0008 로 끊었다가 다시 0009 로 진행해야
// 한다.
const (
	migrationBeforeBackfill = 8  // 0008 까지 적용된 직후
	migrationAfterBackfill  = 9  // 0009 백필 직후
	migrationDropAIPreview  = 10 // 0010 ai_preview drop 직후
)

func TestMigrations_AIPreviewDropped(t *testing.T) {
	dsn := fileDSN(t)
	d, m := openMigratorAt(t, dsn)
	defer d.Close()
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		t.Fatalf("migrate up: %v", err)
	}

	// ai_preview 컬럼이 사라졌는지 — SELECT 가 오류를 내야 한다.
	if _, err := d.Exec(`SELECT ai_preview FROM onboarding`); err == nil {
		t.Errorf("expected error selecting ai_preview after 0010, got nil")
	}
}

func TestMigrations_BackfillsLegacyDueDate(t *testing.T) {
	dsn := fileDSN(t)
	d, m := openMigratorAt(t, dsn)

	// 1) 0008 까지만 적용 — fetuses/children 테이블이 존재하고 ai_preview
	//    컬럼이 아직 살아 있는 상태. 거기에 레거시 사용자(due_date 만 채워진)
	//    를 주입한다.
	if err := m.Migrate(migrationBeforeBackfill); err != nil {
		t.Fatalf("migrate to %d: %v", migrationBeforeBackfill, err)
	}
	if _, err := d.Exec(`INSERT INTO users (id, email) VALUES ('legacy', 'a@b.com')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := d.Exec(`INSERT INTO onboarding (user_id, due_date, onboarded_at) VALUES ('legacy', '2026-09-01', datetime('now'))`); err != nil {
		t.Fatalf("seed onboarding: %v", err)
	}

	// 같은 트랜잭션 안에 fetuses 가 이미 있는 사용자도 한 명 추가 — backfill
	// 이 건너뛰는지 확인한다.
	if _, err := d.Exec(`INSERT INTO users (id, email) VALUES ('alreadyOK', 'c@d.com')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := d.Exec(`INSERT INTO onboarding (user_id, due_date) VALUES ('alreadyOK', '2026-10-01')`); err != nil {
		t.Fatalf("seed onboarding: %v", err)
	}
	if _, err := d.Exec(`INSERT INTO fetuses (user_id, ordinal, nickname) VALUES ('alreadyOK', 0, '콩이')`); err != nil {
		t.Fatalf("seed existing fetus: %v", err)
	}

	// migrate.Migrate 는 사용 후 driver 를 닫는다. 단계별로 새 Migrator 가
	// 필요하므로 한 번 닫고 다시 연다.
	if srcErr, dbErr := m.Close(); srcErr != nil || dbErr != nil {
		t.Fatalf("close migrator: src=%v db=%v", srcErr, dbErr)
	}
	if err := d.Close(); err != nil {
		t.Fatalf("close db: %v", err)
	}

	// 2) 0009 까지 한 단계 진행 — backfill 만 적용된다.
	d2, m2 := openMigratorAt(t, dsn)
	defer d2.Close()
	if err := m2.Migrate(migrationAfterBackfill); err != nil {
		t.Fatalf("migrate to %d: %v", migrationAfterBackfill, err)
	}

	rows := mustListFetuses(t, d2, "legacy")
	if len(rows) != 1 {
		t.Fatalf("legacy fetuses: got %d want 1", len(rows))
	}
	if rows[0].dueDate != "2026-09-01" {
		t.Errorf("legacy fetus due_date: got %q want 2026-09-01", rows[0].dueDate)
	}
	if rows[0].ordinal != 0 {
		t.Errorf("legacy fetus ordinal: got %d want 0", rows[0].ordinal)
	}

	already := mustListFetuses(t, d2, "alreadyOK")
	if len(already) != 1 || already[0].nickname != "콩이" {
		t.Errorf("backfill should have skipped alreadyOK: got %+v", already)
	}

	// 3) 0010 까지 진행 후 0009 까지 되돌려 — 백필 down 이 가상 행만 골라
	//    제거하는지 확인한다. (down 은 backfill 한 행 외에는 건드리지 않는다.)
	if err := m2.Migrate(migrationDropAIPreview); err != nil {
		t.Fatalf("migrate to %d: %v", migrationDropAIPreview, err)
	}
	if err := m2.Migrate(migrationAfterBackfill); err != nil {
		t.Fatalf("migrate back to %d: %v", migrationAfterBackfill, err)
	}
	if err := m2.Migrate(migrationBeforeBackfill); err != nil {
		t.Fatalf("migrate back to %d: %v", migrationBeforeBackfill, err)
	}

	rolled := mustListFetuses(t, d2, "legacy")
	if len(rolled) != 0 {
		t.Errorf("backfill down should remove legacy virtual row: got %+v", rolled)
	}
	alreadyAfter := mustListFetuses(t, d2, "alreadyOK")
	if len(alreadyAfter) != 1 || alreadyAfter[0].nickname != "콩이" {
		t.Errorf("backfill down must preserve real rows: got %+v", alreadyAfter)
	}
}

type fetusRow struct {
	ordinal       int
	nickname      string
	dueDate       string
	purposes_json string
}

func mustListFetuses(t *testing.T, d *sql.DB, userID string) []fetusRow {
	t.Helper()
	rows, err := d.Query(`
		SELECT ordinal, COALESCE(nickname, ''), COALESCE(due_date, ''), purposes_json
		FROM fetuses WHERE user_id = ? ORDER BY ordinal ASC
	`, userID)
	if err != nil {
		t.Fatalf("list fetuses: %v", err)
	}
	defer rows.Close()
	var out []fetusRow
	for rows.Next() {
		var r fetusRow
		if err := rows.Scan(&r.ordinal, &r.nickname, &r.dueDate, &r.purposes_json); err != nil {
			t.Fatalf("scan: %v", err)
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows.Err: %v", err)
	}
	return out
}

