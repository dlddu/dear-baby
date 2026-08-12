package records

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// ENG-013 (단계 스냅샷 저장·재계산 정책) 의 구현. 기록이 작성될 당시 대상
// 아이가 어느 단계였는지를 records 의 stage_* 컬럼에 물리 저장한다.
//
// 단계는 순수 함수의 결과다:
//
//	stage = f(작성일, 기준값)   기준값 = due_date (임신 축) | birth_date (양육 축)
//
// 작성일은 불변이고 기준값만 변하므로 저장된 값은 그 함수의 캐시이고, 기준값이
// 바뀌는 지점에서 재계산하면 캐시는 항상 정확하다. 계산식과 경계 판정은 전부
// ENG-001 (아이 단계 산출 정책) 이 정한다 — 본 파일은 그 문서의 코드 표현이다.
//
// 이 파일이 스냅샷을 쓰는 **유일한** 권위다. 0013 마이그레이션의 백필 SQL 은
// 도입 시점의 1회성 산출물이고, 두 구현의 동치는 db 패키지의 등가성 테스트가
// 못 박는다.

// 스냅샷의 축 리터럴. record_subjects.kind ('fetus'|'child') 와 **일부러**
// 다른 어휘를 쓴다: 스냅샷의 축은 아이의 *현재* 축과 독립이며 (출산 전환은
// 과거 기록을 다시 칠하지 않는다 — ENG-011), 같은 리터럴을 쓰면 언젠가
// "중복이니 조인으로 대체하자" 는 정리가 들어와 계약이 깨진다. 리터럴은
// 용어집의 ChildStage.kind 와 일치시켰다.
const (
	stageKindPregnancy = "pregnancy"
	stageKindPostnatal = "postnatal"
)

// stageSnapshot is the persisted form of 용어집 `StageSnapshot` (= `ChildStage
// | null`). A zero value means 단계 없음 — every field nil. The three fields
// move together: Kind == nil implies Days == nil && Months == nil, and Months
// is non-nil only on the 양육 축 (개월은 임신 축에 정의되지 않는다).
//
// Days carries daysPregnant on the 임신 축 (주수 = Days/7, 일수 = Days%7) and
// daysOld on the 양육 축 (출생 당일 = 0; "생후 n일째" 표기는 Days+1).
type stageSnapshot struct {
	Kind   *string
	Days   *int
	Months *int
}

// computeStageSnapshot renders the stage of a record written on `at` for a
// subject of `kind` ('fetus' | 'child') whose 기준값 is dueDate / birthDate.
// Either date may be NULL — the caller passes them straight from the profile
// row. An all-nil return means 단계 없음, which is a normal state and not an
// error (ENG-001: "단계 없음은 오류가 아니다").
//
// `at` is truncated to its UTC calendar day: records.created_at is SQLite
// datetime('now') (UTC), and the existing community surface anchors on the
// same day boundary.
func computeStageSnapshot(kind string, dueDate, birthDate sql.NullString, at time.Time) stageSnapshot {
	if at.IsZero() {
		return stageSnapshot{}
	}
	day := time.Date(at.Year(), at.Month(), at.Day(), 0, 0, 0, 0, time.UTC)

	switch kind {
	case "fetus":
		if !dueDate.Valid {
			return stageSnapshot{}
		}
		due, err := time.Parse(dateLayout, dueDate.String)
		if err != nil {
			return stageSnapshot{}
		}
		daysUntilDue := int(due.Sub(day).Hours() / 24)
		// ENG-001 경계값: 5주 이상 과거는 방치된 프로필, 45주 초과 미래는
		// Stage 1 피커 상한 밖. 둘 다 단계 없음으로 접는다.
		if daysUntilDue < -pregnancyPastCapDays || daysUntilDue > pregnancyFutureCapDays {
			return stageSnapshot{}
		}
		// 40주를 넘는 미래 예정일은 daysPregnant 를 음수로 만든다. ENG-001 은
		// 이를 숨기지 않고 0 으로 clamp 한다 — Stage 1 이 허용한 입력이므로.
		daysPregnant := gestationDays - daysUntilDue
		if daysPregnant < 0 {
			daysPregnant = 0
		}
		k := stageKindPregnancy
		return stageSnapshot{Kind: &k, Days: &daysPregnant}

	case "child":
		if !birthDate.Valid {
			return stageSnapshot{}
		}
		birth, err := time.Parse(dateLayout, birthDate.String)
		if err != nil {
			return stageSnapshot{}
		}
		daysOld := int(day.Sub(birth).Hours() / 24)
		if daysOld < 0 {
			// 작성일보다 미래의 출생일 — 오탈자이지 단계가 아니다.
			return stageSnapshot{}
		}
		months := calendarMonthsBetween(birth, day)
		k := stageKindPostnatal
		return stageSnapshot{Kind: &k, Days: &daysOld, Months: &months}

	default:
		return stageSnapshot{}
	}
}

// calendarMonthsBetween counts whole calendar months from birth to day per
// ENG-001: 30일 나눗셈이 아니라 달력 기준이며, **말일 출생은 해당 월의 마지막
// 날로 절사한다** (1/31 생은 2/28 에 1개월이 된다).
//
// 이 절사 규칙이 community.go 의 monthsBetween 과 갈리는 지점이다. 그쪽은
// `day.Day() < birth.Day()` 만 보아 1/31 생을 2/28 에 0개월로 센다 — ENG-001
// 문면과 어긋나며, 그 소급 계산기들(community.go · app/src/utils/childLabel.ts)
// 의 정리는 스냅샷 소비처 전환과 함께 다루는 후속이다.
func calendarMonthsBetween(birth, day time.Time) int {
	months := (day.Year()-birth.Year())*12 + int(day.Month()) - int(birth.Month())
	anniversary := birth.Day()
	if last := lastDayOfMonth(day); anniversary > last {
		anniversary = last
	}
	if day.Day() < anniversary {
		months--
	}
	return months
}

// lastDayOfMonth returns the number of days in t's month (28..31).
func lastDayOfMonth(t time.Time) int {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location()).
		AddDate(0, 1, -1).Day()
}

// subjectStageBasis is the (축, 기준값) pair a subject contributes to f. found
// is false when the subject has no fetuses / children row at all — a distinct
// state from "row exists with a NULL date", see RecomputeSnapshotsForSubjectTx.
type subjectStageBasis struct {
	kind      string
	dueDate   sql.NullString
	birthDate sql.NullString
	found     bool
}

// loadSubjectStageBasis reads the subject's kind plus whichever 기준값 applies
// to it. fetuses.id / children.id were made equal to record_subjects.id by
// migration 0012 and onboarding keeps inserting them that way, so the profile
// row hangs off the subject with no extra lookup.
func loadSubjectStageBasis(ctx context.Context, q rowQueryer, subjectID string) (subjectStageBasis, error) {
	var (
		out       subjectStageBasis
		hasFetus  sql.NullString
		hasChild  sql.NullString
		dueDate   sql.NullString
		birthDate sql.NullString
	)
	err := q.QueryRowContext(ctx, `
		SELECT rs.kind, f.id, c.id, f.due_date, c.birth_date
		FROM record_subjects rs
		LEFT JOIN fetuses  f ON f.id = rs.id
		LEFT JOIN children c ON c.id = rs.id
		WHERE rs.id = ?
	`, subjectID).Scan(&out.kind, &hasFetus, &hasChild, &dueDate, &birthDate)
	if errors.Is(err, sql.ErrNoRows) {
		return subjectStageBasis{}, nil
	}
	if err != nil {
		return subjectStageBasis{}, fmt.Errorf("load subject stage basis: %w", err)
	}
	out.dueDate = dueDate
	out.birthDate = birthDate
	switch out.kind {
	case "fetus":
		out.found = hasFetus.Valid
	case "child":
		out.found = hasChild.Valid
	}
	return out, nil
}

// rowQueryer is the subset of *sql.DB / *sql.Tx these helpers need.
type rowQueryer interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// writeSnapshotTx stamps one record's stage columns. Every write of the
// snapshot — first insert and recalculation alike — goes through here, so
// there is exactly one shape of "스냅샷을 쓰는 SQL".
func writeSnapshotTx(ctx context.Context, tx *sql.Tx, recordID string, snap stageSnapshot) error {
	var kind, days, months any
	if snap.Kind != nil {
		kind = *snap.Kind
	}
	if snap.Days != nil {
		days = *snap.Days
	}
	if snap.Months != nil {
		months = *snap.Months
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE records SET stage_kind = ?, stage_days = ?, stage_months = ? WHERE id = ?
	`, kind, days, months, recordID); err != nil {
		return fmt.Errorf("write stage snapshot: %w", err)
	}
	return nil
}

// RecomputeSnapshotsForSubjectTx re-derives the stage snapshot of every record
// belonging to subjectID and returns how many rows it rewrote. This is the
// T1 / T2 recalculation of ENG-013: whenever a subject's 기준값 (due_date /
// birth_date) may have changed, the cache for that subject is rebuilt.
//
// Two properties are load-bearing and must not be "simplified" away:
//
//   - **전량 재산출.** Every row is recomputed from (작성일, 기준값), never
//     shifted by a delta. Delta arithmetic accumulates error and skips
//     ENG-001's clamp / boundary handling.
//
//   - **기준값 행이 없으면 아무것도 쓰지 않는다.** Onboarding shrinks the
//     fetus / child list by deleting rows while record_subjects and the records
//     pointing at it survive. Recomputing such a subject would find no 기준값
//     and NULL out its whole history — the exact opposite of why ENG-013 chose
//     물리 저장 ("기준값이 사라지는 경로에서도 과거 기록의 단계가 남는다").
//     A row that *exists* with a NULL date is a different case and is correctly
//     overwritten with NULL (ENG-013: "재계산 결과가 단계 없음이 되는 경우도
//     있다").
//
// 출산 전환 오염은 이 설계에서 구조적으로 불가능하다: 재계산은 subject_id 로
// 스코프되고 축은 그 subject 자신의 kind 에서 나오므로, 새로 생긴 child
// subject 의 birth_date 가 fetus subject 의 기록에 닿을 경로가 없다.
func RecomputeSnapshotsForSubjectTx(ctx context.Context, tx *sql.Tx, subjectID string) (int, error) {
	basis, err := loadSubjectStageBasis(ctx, tx, subjectID)
	if err != nil {
		return 0, err
	}
	if !basis.found {
		// 기준값 행 부재 — 기존 스냅샷을 보존한다. 위 주석 참고.
		return 0, nil
	}

	rows, err := tx.QueryContext(ctx, `
		SELECT id, created_at FROM records WHERE subject_id = ?
	`, subjectID)
	if err != nil {
		return 0, fmt.Errorf("list records for recompute: %w", err)
	}
	type target struct {
		id        string
		createdAt time.Time
	}
	var targets []target
	for rows.Next() {
		var (
			id        string
			createdAt string
		)
		if err := rows.Scan(&id, &createdAt); err != nil {
			rows.Close()
			return 0, fmt.Errorf("scan record for recompute: %w", err)
		}
		t, err := time.Parse(sqliteTimeLayout, createdAt)
		if err != nil {
			// created_at 이 읽히지 않으면 단계를 지어낼 수 없다 — 기존 값을
			// 건드리지 않고 건너뛴다.
			continue
		}
		targets = append(targets, target{id: id, createdAt: t})
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return 0, fmt.Errorf("iterate records for recompute: %w", err)
	}
	rows.Close()

	for _, t := range targets {
		snap := computeStageSnapshot(basis.kind, basis.dueDate, basis.birthDate, t.createdAt)
		if err := writeSnapshotTx(ctx, tx, t.id, snap); err != nil {
			return 0, err
		}
	}
	return len(targets), nil
}
