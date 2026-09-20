package onboarding

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
)

// ENG-013 재계산 트리거. `due_date` / `birth_date` 의 유일한 write 경로가
// UpsertCaseA/B/C 이므로, 그 세 함수가 T1·T2 를 실제로 발화시키는지와,
// **발화시키면 안 되는 경우에 발화하지 않는지**를 여기서 못 박는다.
//
// 이 테스트들이 지키는 성질 3가지:
//   1. 기준값 정정 → 같은 축 기록 스냅샷 재계산 (T1·T2). 되돌리면 멱등하게 복원.
//   2. 출산 전환(= 아이 추가) 은 재계산 대상이 아니다 — 임신기 기록이
//      "생후 -N개월" 로 오염되지 않는다. ENG-013 이 "구현상 가장 틀리기 쉬운
//      지점" 으로 지목한 곳이다.
//   3. 기준값 **행 자체가 사라진** subject 의 스냅샷은 보존된다. 물리 저장을
//      택한 이유가 "기준값이 사라져도 표시 가능" 이므로, 여기서 NULL 로 덮으면
//      결정 자체가 무의미해진다. (행은 있고 날짜만 NULL 인 경우와 구분된다.)

type snapshot struct {
	kind   sql.NullString
	days   sql.NullInt64
	months sql.NullInt64
}

func (s snapshot) String() string {
	f := func(v sql.NullInt64) string {
		if !v.Valid {
			return "nil"
		}
		return fmt.Sprint(v.Int64)
	}
	k := "nil"
	if s.kind.Valid {
		k = s.kind.String
	}
	return fmt.Sprintf("{kind:%s days:%s months:%s}", k, f(s.days), f(s.months))
}

func readStage(t *testing.T, db *sql.DB, recordID string) snapshot {
	t.Helper()
	var s snapshot
	if err := db.QueryRow(
		`SELECT stage_kind, stage_days, stage_months FROM records WHERE id = ?`, recordID,
	).Scan(&s.kind, &s.days, &s.months); err != nil {
		t.Fatalf("read stage of %s: %v", recordID, err)
	}
	return s
}

func readCreatedAt(t *testing.T, db *sql.DB, recordID string) string {
	t.Helper()
	var v string
	if err := db.QueryRow(`SELECT created_at FROM records WHERE id = ?`, recordID).Scan(&v); err != nil {
		t.Fatalf("read created_at of %s: %v", recordID, err)
	}
	return v
}

// seedRecordAt inserts a record written on `day` (YYYY-MM-DD) against subjectID.
// The snapshot columns start NULL — the point of each test is what the upsert
// does to them.
func seedRecordAt(t *testing.T, db *sql.DB, recordID, userID, subjectID, day string) {
	t.Helper()
	if _, err := db.Exec(`
		INSERT INTO records (id, user_id, subject_id, content, visibility, created_at)
		VALUES (?, ?, ?, 'entry', 'private', ?)
	`, recordID, userID, subjectID, day+" 09:30:00"); err != nil {
		t.Fatalf("seed record %s: %v", recordID, err)
	}
}

func subjectIDOf(t *testing.T, db *sql.DB, userID, kind string, ordinal int) string {
	t.Helper()
	var id string
	if err := db.QueryRow(
		`SELECT id FROM record_subjects WHERE user_id = ? AND kind = ? AND ordinal = ?`,
		userID, kind, ordinal,
	).Scan(&id); err != nil {
		t.Fatalf("lookup subject (%s,%d): %v", kind, ordinal, err)
	}
	return id
}

// T1 — 출산 예정일을 2주 앞당기면 그 아이의 임신 축 기록이 재계산된다.
// 작성일 자체는 변하지 않고, 원래 값으로 되돌리면 최초 스냅샷으로 복원된다.
func TestUpsertCaseA_DueDateCorrection_RecomputesSnapshots(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")
	ctx := context.Background()
	s := &Store{DB: db}

	// 2026-08-08 작성, 예정일 2026-11-16 → 100일 남음 → daysPregnant 180.
	if err := s.UpsertCaseA(ctx, "u1", []Fetus{{DueDate: ptrStr("2026-11-16")}}); err != nil {
		t.Fatalf("initial upsert: %v", err)
	}
	subj := subjectIDOf(t, db, "u1", "fetus", 0)
	seedRecordAt(t, db, "r1", "u1", subj, "2026-08-08")

	// 기록을 심은 뒤 한 번 더 같은 값으로 upsert — 여기서 백필된다.
	if err := s.UpsertCaseA(ctx, "u1", []Fetus{{DueDate: ptrStr("2026-11-16")}}); err != nil {
		t.Fatalf("re-upsert: %v", err)
	}
	before := readStage(t, db, "r1")
	if !before.days.Valid || before.days.Int64 != 180 {
		t.Fatalf("baseline: want days=180, got %s", before)
	}
	createdAtBefore := readCreatedAt(t, db, "r1")

	// 예정일을 2주 앞당긴다 → 같은 작성일이 2주 더 진행된 상태로 해석된다.
	if err := s.UpsertCaseA(ctx, "u1", []Fetus{{DueDate: ptrStr("2026-11-02")}}); err != nil {
		t.Fatalf("corrected upsert: %v", err)
	}
	after := readStage(t, db, "r1")
	if !after.days.Valid || after.days.Int64 != 194 {
		t.Fatalf("after correction: want days=194, got %s", after)
	}
	if got := readCreatedAt(t, db, "r1"); got != createdAtBefore {
		t.Errorf("created_at must not move: %q → %q", createdAtBefore, got)
	}

	// 되돌리면 최초 값으로 정확히 복원된다 (재계산은 멱등이다).
	if err := s.UpsertCaseA(ctx, "u1", []Fetus{{DueDate: ptrStr("2026-11-16")}}); err != nil {
		t.Fatalf("revert upsert: %v", err)
	}
	if got := readStage(t, db, "r1"); got.String() != before.String() {
		t.Errorf("revert not idempotent: want %s, got %s", before, got)
	}
}

// T2 — 출생일 정정도 같은 성질. 양육 축은 일수와 달력 개월을 함께 다시 쓴다.
func TestUpsertCaseC_BirthDateCorrection_RecomputesSnapshots(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")
	ctx := context.Background()
	s := &Store{DB: db}

	if err := s.UpsertCaseC(ctx, "u1", []Child{{BirthDate: ptrStr("2025-08-08")}}); err != nil {
		t.Fatalf("initial upsert: %v", err)
	}
	subj := subjectIDOf(t, db, "u1", "child", 0)
	seedRecordAt(t, db, "r1", "u1", subj, "2026-08-08")
	if err := s.UpsertCaseC(ctx, "u1", []Child{{BirthDate: ptrStr("2025-08-08")}}); err != nil {
		t.Fatalf("re-upsert: %v", err)
	}
	if got := readStage(t, db, "r1"); !got.months.Valid || got.months.Int64 != 12 || got.days.Int64 != 365 {
		t.Fatalf("baseline: want {postnatal 365 12}, got %s", got)
	}

	// 출생일을 한 달 뒤로 정정 → 같은 기록이 11개월로 다시 계산된다.
	if err := s.UpsertCaseC(ctx, "u1", []Child{{BirthDate: ptrStr("2025-09-08")}}); err != nil {
		t.Fatalf("corrected upsert: %v", err)
	}
	got := readStage(t, db, "r1")
	if !got.months.Valid || got.months.Int64 != 11 || got.days.Int64 != 334 {
		t.Errorf("after correction: want {postnatal 334 11}, got %s", got)
	}
}

// 기준값이 "행은 있는데 날짜가 비었다" 로 바뀌면 스냅샷은 NULL 로 덮인다.
// ENG-013: "재계산 결과가 단계 없음이 되는 경우도 있다".
func TestUpsertCaseA_DueDateCleared_NullsSnapshot(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")
	ctx := context.Background()
	s := &Store{DB: db}

	if err := s.UpsertCaseA(ctx, "u1", []Fetus{{DueDate: ptrStr("2026-11-16")}}); err != nil {
		t.Fatalf("initial upsert: %v", err)
	}
	subj := subjectIDOf(t, db, "u1", "fetus", 0)
	seedRecordAt(t, db, "r1", "u1", subj, "2026-08-08")
	if err := s.UpsertCaseA(ctx, "u1", []Fetus{{DueDate: ptrStr("2026-11-16")}}); err != nil {
		t.Fatalf("re-upsert: %v", err)
	}
	if got := readStage(t, db, "r1"); !got.days.Valid {
		t.Fatalf("baseline should have a stage, got %s", got)
	}

	// "아직 정해지지 않았어요" 로 되돌아간 경우.
	if err := s.UpsertCaseA(ctx, "u1", []Fetus{{DueDate: nil}}); err != nil {
		t.Fatalf("cleared upsert: %v", err)
	}
	if got := readStage(t, db, "r1"); got.kind.Valid || got.days.Valid || got.months.Valid {
		t.Errorf("want all-null snapshot after clearing due_date, got %s", got)
	}
}

// **출산 전환은 재계산 트리거가 아니다.** 임신 기록을 가진 사용자에게 아이를
// 추가해도(= birth_date 최초 설정) 임신기 기록의 스냅샷은 한 비트도 변하지
// 않아야 한다. 이 단정이 깨지면 임신기 기록 전체가 "생후 -N개월" 로 오염된다.
func TestUpsertCaseB_AddingChild_DoesNotRepaintPregnancyRecords(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")
	ctx := context.Background()
	s := &Store{DB: db}

	if err := s.UpsertCaseA(ctx, "u1", []Fetus{{DueDate: ptrStr("2026-11-16")}}); err != nil {
		t.Fatalf("case A: %v", err)
	}
	fetusSubj := subjectIDOf(t, db, "u1", "fetus", 0)
	seedRecordAt(t, db, "r1", "u1", fetusSubj, "2026-08-08")
	if err := s.UpsertCaseA(ctx, "u1", []Fetus{{DueDate: ptrStr("2026-11-16")}}); err != nil {
		t.Fatalf("case A again: %v", err)
	}
	before := readStage(t, db, "r1")
	if !before.kind.Valid || before.kind.String != "pregnancy" || before.days.Int64 != 180 {
		t.Fatalf("baseline: want {pregnancy 180 nil}, got %s", before)
	}

	// 출산 전환에 해당하는 상태 변화: 같은 사용자에게 아이가 생긴다.
	if err := s.UpsertCaseB(ctx, "u1",
		[]Child{{BirthDate: ptrStr("2026-11-16")}},
		[]Fetus{{DueDate: ptrStr("2026-11-16")}},
	); err != nil {
		t.Fatalf("case B: %v", err)
	}

	after := readStage(t, db, "r1")
	if after.String() != before.String() {
		t.Errorf("출산 전환이 임신기 기록을 다시 칠했다: %s → %s", before, after)
	}
	if after.months.Valid {
		t.Errorf("임신기 기록에 생후 개월이 붙었다: %s", after)
	}

	// 전환 이후 양육 축 기록이 생긴 상태에서 한 번 더 upsert 한다. 여기서부터는
	// 두 축의 기록이 공존하므로, 재계산이 subject 스코프를 벗어나면 **어느 쪽이든**
	// 반대 축 기준값으로 칠해진다 (upsert 안의 재계산 순서에 따라 살아남는 쪽이
	// 달라지므로 두 축을 모두 단정해야 오염이 가려지지 않는다).
	childSubj := subjectIDOf(t, db, "u1", "child", 0)
	seedRecordAt(t, db, "r2", "u1", childSubj, "2027-02-16")
	if err := s.UpsertCaseB(ctx, "u1",
		[]Child{{BirthDate: ptrStr("2026-11-16")}},
		[]Fetus{{DueDate: ptrStr("2026-11-16")}},
	); err != nil {
		t.Fatalf("case B again: %v", err)
	}

	if got := readStage(t, db, "r1"); got.String() != before.String() {
		t.Errorf("임신기 기록이 양육 기준값으로 칠해졌다: %s → %s", before, got)
	}
	post := readStage(t, db, "r2")
	if !post.kind.Valid || post.kind.String != "postnatal" || post.months.Int64 != 3 {
		t.Errorf("양육 기록이 임신 기준값으로 칠해졌다: want {postnatal 92 3}, got %s", post)
	}
}

// 온보딩에서 아이를 목록에서 빼면 fetuses/children 행은 사라지지만
// record_subjects 와 그 기록은 남는다. 그 subject 를 재계산하면 기준값이 없어
// 스냅샷이 통째로 지워진다 — 물리 저장을 택한 이유("기준값이 사라져도 표시
// 가능")를 정면으로 무효화하므로, 재계산 대상에서 빠져야 한다.
func TestUpsertCaseA_SubjectDroppedFromList_PreservesSnapshot(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUserWithOnboarding(t, db, "u1", "a@b.com")
	ctx := context.Background()
	s := &Store{DB: db}

	// 쌍둥이 — ordinal 1 의 기록을 남긴다.
	twins := []Fetus{{DueDate: ptrStr("2026-11-16")}, {DueDate: ptrStr("2026-11-16")}}
	if err := s.UpsertCaseA(ctx, "u1", twins); err != nil {
		t.Fatalf("initial upsert: %v", err)
	}
	second := subjectIDOf(t, db, "u1", "fetus", 1)
	seedRecordAt(t, db, "r2", "u1", second, "2026-08-08")
	if err := s.UpsertCaseA(ctx, "u1", twins); err != nil {
		t.Fatalf("re-upsert: %v", err)
	}
	before := readStage(t, db, "r2")
	if !before.days.Valid || before.days.Int64 != 180 {
		t.Fatalf("baseline: want days=180, got %s", before)
	}

	// 사용자가 목록을 한 명으로 줄인다 → ordinal 1 의 fetuses 행이 사라진다.
	if err := s.UpsertCaseA(ctx, "u1", []Fetus{{DueDate: ptrStr("2026-11-16")}}); err != nil {
		t.Fatalf("shrink upsert: %v", err)
	}
	var remaining int
	if err := db.QueryRow(`SELECT count(*) FROM fetuses WHERE id = ?`, second).Scan(&remaining); err != nil {
		t.Fatalf("count fetus rows: %v", err)
	}
	if remaining != 0 {
		t.Fatalf("precondition: the dropped fetus row should be gone, got %d", remaining)
	}

	if after := readStage(t, db, "r2"); after.String() != before.String() {
		t.Errorf("기준값 행이 사라졌다고 과거 스냅샷을 지웠다: %s → %s", before, after)
	}
}
