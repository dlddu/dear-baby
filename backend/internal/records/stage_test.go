package records

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/users"
)

// ---------------------------------------------------------------------------
// computeStageSnapshot — ENG-001 경계값 표를 코드로 옮긴 것이 맞는지.
// ---------------------------------------------------------------------------

func nullStr(s string) sql.NullString { return sql.NullString{String: s, Valid: true} }

func at(day string) time.Time {
	t, err := time.Parse(dateLayout, day)
	if err != nil {
		panic(err)
	}
	return t
}

func TestComputeStageSnapshot_PregnancyBoundaries(t *testing.T) {
	const day = "2026-08-08"
	tests := []struct {
		name       string
		due        sql.NullString
		wantKind   string // "" => 단계 없음
		wantDays   int
		wantMonths *int
	}{
		{name: "due null → 단계 없음", due: sql.NullString{}},
		{name: "unparseable due → 단계 없음", due: nullStr("not-a-date")},
		// 예정일이 5주(35일) 이상 과거면 방치된 프로필로 보고 숨긴다.
		{name: "35일 과거는 아직 유효", due: nullStr("2026-07-04"), wantKind: stageKindPregnancy, wantDays: 315},
		{name: "36일 과거는 단계 없음", due: nullStr("2026-07-03")},
		// 45주(315일) 초과 미래는 Stage 1 피커 상한 밖.
		{name: "315일 미래는 아직 유효(0으로 clamp)", due: nullStr("2027-06-19"), wantKind: stageKindPregnancy, wantDays: 0},
		{name: "316일 미래는 단계 없음", due: nullStr("2027-06-20")},
		// 40주를 넘는 미래 예정일 → 음수 daysPregnant → 숨기지 않고 0 clamp.
		{name: "만삭 초과 미래는 0으로 clamp", due: nullStr("2027-06-04"), wantKind: stageKindPregnancy, wantDays: 0},
		{name: "정확히 만삭 시점", due: nullStr("2027-05-15"), wantKind: stageKindPregnancy, wantDays: 0},
		{name: "예정일 당일 = 280일", due: nullStr(day), wantKind: stageKindPregnancy, wantDays: 280},
		{name: "100일 남음 = 180일", due: nullStr("2026-11-16"), wantKind: stageKindPregnancy, wantDays: 180},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := computeStageSnapshot("fetus", tc.due, sql.NullString{}, at(day))
			if tc.wantKind == "" {
				if got.Kind != nil || got.Days != nil || got.Months != nil {
					t.Fatalf("want 단계 없음, got %s", formatSnapshot(got))
				}
				return
			}
			if got.Kind == nil || *got.Kind != tc.wantKind {
				t.Fatalf("kind: want %s, got %s", tc.wantKind, formatSnapshot(got))
			}
			if got.Days == nil || *got.Days != tc.wantDays {
				t.Fatalf("days: want %d, got %s", tc.wantDays, formatSnapshot(got))
			}
			// 임신 축에는 개월이 정의되지 않는다.
			if got.Months != nil {
				t.Fatalf("months must stay nil on the 임신 축, got %s", formatSnapshot(got))
			}
		})
	}
}

func TestComputeStageSnapshot_PostnatalBoundaries(t *testing.T) {
	tests := []struct {
		name                 string
		birth, day           string
		wantNone             bool
		wantDays, wantMonths int
	}{
		{name: "birth null → 단계 없음", birth: "", day: "2026-08-08", wantNone: true},
		{name: "미래 출생일 → 단계 없음", birth: "2026-08-09", day: "2026-08-08", wantNone: true},
		// 출생 당일은 daysOld = 0 이다 ("생후 1일째" 는 표기 시 +1).
		{name: "출생 당일", birth: "2026-08-08", day: "2026-08-08", wantDays: 0, wantMonths: 0},
		{name: "달력 기준 1개월", birth: "2026-03-15", day: "2026-04-15", wantDays: 31, wantMonths: 1},
		{name: "하루 모자라면 0개월", birth: "2026-03-15", day: "2026-04-14", wantDays: 30, wantMonths: 0},
		// ENG-001: 말일 출생(1/31 → 2/28)은 해당 월의 마지막 날로 절사한다.
		{name: "말일 절사 — 1/31생은 2/28에 1개월", birth: "2026-01-31", day: "2026-02-28", wantDays: 28, wantMonths: 1},
		{name: "말일 절사 — 2/27에는 아직 0개월", birth: "2026-01-31", day: "2026-02-27", wantDays: 27, wantMonths: 0},
		{name: "말일 절사 — 윤년 2/29", birth: "2024-01-31", day: "2024-02-29", wantDays: 29, wantMonths: 1},
		{name: "말일 절사 — 5/31생은 6/30에 1개월", birth: "2026-05-31", day: "2026-06-30", wantDays: 30, wantMonths: 1},
		{name: "만 1년", birth: "2025-08-08", day: "2026-08-08", wantDays: 365, wantMonths: 12},
		// 임신 축과 달리 생후 나이에는 상한이 없다.
		{name: "상한 없음 — 20년", birth: "2006-08-08", day: "2026-08-08", wantDays: 7305, wantMonths: 240},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			birth := sql.NullString{}
			if tc.birth != "" {
				birth = nullStr(tc.birth)
			}
			got := computeStageSnapshot("child", sql.NullString{}, birth, at(tc.day))
			if tc.wantNone {
				if got.Kind != nil || got.Days != nil || got.Months != nil {
					t.Fatalf("want 단계 없음, got %s", formatSnapshot(got))
				}
				return
			}
			if got.Kind == nil || *got.Kind != stageKindPostnatal {
				t.Fatalf("kind: want %s, got %s", stageKindPostnatal, formatSnapshot(got))
			}
			if got.Days == nil || *got.Days != tc.wantDays {
				t.Fatalf("days: want %d, got %s", tc.wantDays, formatSnapshot(got))
			}
			if got.Months == nil || *got.Months != tc.wantMonths {
				t.Fatalf("months: want %d, got %s", tc.wantMonths, formatSnapshot(got))
			}
		})
	}
}

// ---------------------------------------------------------------------------
// 쓰기 경로 — Create 가 작성 시점 단계를 박는가 (AC-002-03 / AC-002-05).
// ---------------------------------------------------------------------------

// seedSubjectWithBasis creates a record_subjects row of `kind` plus the
// matching fetuses / children profile row carrying `basis` (empty => NULL).
func seedSubjectWithBasis(t *testing.T, db *sql.DB, userID, subjectID, kind, basis string, ordinal int) {
	t.Helper()
	if _, err := db.Exec(
		`INSERT INTO record_subjects (id, user_id, kind, ordinal) VALUES (?, ?, ?, ?)`,
		subjectID, userID, kind, ordinal); err != nil {
		t.Fatalf("seed subject: %v", err)
	}
	var v any
	if basis != "" {
		v = basis
	}
	switch kind {
	case "fetus":
		if _, err := db.Exec(
			`INSERT INTO fetuses (id, user_id, ordinal, due_date) VALUES (?, ?, ?, ?)`,
			subjectID, userID, ordinal, v); err != nil {
			t.Fatalf("seed fetus: %v", err)
		}
	case "child":
		if _, err := db.Exec(
			`INSERT INTO children (id, user_id, ordinal, birth_date) VALUES (?, ?, ?, ?)`,
			subjectID, userID, ordinal, v); err != nil {
			t.Fatalf("seed child: %v", err)
		}
	}
}

func TestCreate_StampsPregnancyStageSnapshot(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	// 오늘로부터 100일 뒤가 예정일이면 daysPregnant = 280 - 100 = 180.
	due := time.Now().UTC().AddDate(0, 0, 100).Format(dateLayout)
	seedSubjectWithBasis(t, db, "u1", "subj-preg", "fetus", due, 7)

	store := &Store{DB: db}
	res, err := store.CreateText(context.Background(), &users.Store{DB: db}, "u1", "hi", "subj-preg")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if res.Record.StageKind == nil || *res.Record.StageKind != stageKindPregnancy {
		t.Fatalf("stage kind: got %s", formatSnapshot(recordSnapshot(res.Record)))
	}
	if res.Record.StageDays == nil || *res.Record.StageDays != 180 {
		t.Fatalf("stage days: want 180, got %s", formatSnapshot(recordSnapshot(res.Record)))
	}
	if res.Record.StageMonths != nil {
		t.Fatalf("임신 축에 개월이 붙었다: %s", formatSnapshot(recordSnapshot(res.Record)))
	}

	// 응답만이 아니라 컬럼에 실제로 박혔는지.
	if got := readSnapshot(t, db, res.Record.ID); got.Days == nil || *got.Days != 180 {
		t.Fatalf("persisted: want days=180, got %s", formatSnapshot(got))
	}
}

func TestCreate_StampsPostnatalStageSnapshot(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")

	birth := time.Now().UTC().AddDate(-1, 0, 0).Format(dateLayout)
	seedSubjectWithBasis(t, db, "u1", "subj-child", "child", birth, 7)

	store := &Store{DB: db}
	res, err := store.CreateText(context.Background(), &users.Store{DB: db}, "u1", "hi", "subj-child")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if res.Record.StageKind == nil || *res.Record.StageKind != stageKindPostnatal {
		t.Fatalf("stage kind: got %s", formatSnapshot(recordSnapshot(res.Record)))
	}
	if res.Record.StageMonths == nil || *res.Record.StageMonths != 12 {
		t.Fatalf("stage months: want 12, got %s", formatSnapshot(recordSnapshot(res.Record)))
	}
	if res.Record.StageDays == nil || *res.Record.StageDays < 365 {
		t.Fatalf("stage days: want >=365, got %s", formatSnapshot(recordSnapshot(res.Record)))
	}
}

// AC-002-05: 단계를 산출할 수 없는 상태에서 작성된 기록은 스냅샷이 비어 있다.
// 기록 자체는 정상 저장된다 (폴백은 결함이 아니다).
func TestCreate_NoDerivableStage_LeavesSnapshotNull(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")
	// "아직 정해지지 않았어요" 로 예정일을 건너뛴 온보딩 (PRD-006 AC-006-02).
	seedSubjectWithBasis(t, db, "u1", "subj-nodate", "fetus", "", 7)

	store := &Store{DB: db}
	res, err := store.CreateText(context.Background(), &users.Store{DB: db}, "u1", "hi", "subj-nodate")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if res.Record.StageKind != nil || res.Record.StageDays != nil || res.Record.StageMonths != nil {
		t.Fatalf("want empty snapshot, got %s", formatSnapshot(recordSnapshot(res.Record)))
	}
	if got := readSnapshot(t, db, res.Record.ID); got.Kind != nil {
		t.Fatalf("persisted snapshot should be null, got %s", formatSnapshot(got))
	}
	if res.Record.Content != "hi" {
		t.Fatalf("record itself must still be saved normally")
	}
}

// 스냅샷을 되돌려주지 않는 조회 경로가 하나라도 있으면 그 화면만 조용히 단계를
// 잃는다. 세 경로를 모두 덮는다.
func TestReadPaths_AllReturnStageSnapshot(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")
	due := time.Now().UTC().AddDate(0, 0, 100).Format(dateLayout)
	seedSubjectWithBasis(t, db, "u1", "subj-preg", "fetus", due, 7)

	ctx := context.Background()
	store := &Store{DB: db}
	res, err := store.Create(ctx, &users.Store{DB: db}, "u1", "hi", SourceVoice, nil, "subj-preg", VisibilityPrivate)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	id := res.Record.ID

	got, err := store.GetByIDForUser(ctx, "u1", id)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	assertPregnancyDays(t, "GetByIDForUser", got, 180)

	list, _, err := store.ListForUser(ctx, "u1", ListFilter{}, "", 10)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("list: want 1 record, got %d", len(list))
	}
	assertPregnancyDays(t, "ListForUser", &list[0], 180)

	attached, err := store.AttachAudio(ctx, "u1", id, "some/key.m4a")
	if err != nil {
		t.Fatalf("attach: %v", err)
	}
	assertPregnancyDays(t, "AttachAudio", attached, 180)
}

func assertPregnancyDays(t *testing.T, where string, rec *Record, wantDays int) {
	t.Helper()
	if rec.StageKind == nil || *rec.StageKind != stageKindPregnancy {
		t.Errorf("%s: stage kind missing — %s", where, formatSnapshot(recordSnapshot(rec)))
		return
	}
	if rec.StageDays == nil || *rec.StageDays != wantDays {
		t.Errorf("%s: want days=%d, got %s", where, wantDays, formatSnapshot(recordSnapshot(rec)))
	}
}

func recordSnapshot(rec *Record) stageSnapshot {
	return stageSnapshot{Kind: rec.StageKind, Days: rec.StageDays, Months: rec.StageMonths}
}

// ---------------------------------------------------------------------------
// RecomputeSnapshotsForSubjectTx — 재계산의 두 안전 성질.
//
// 이 둘은 온보딩 경유 테스트로는 잡히지 않는다: 호출자가 이미 대상 subject 만
// 넘기고, 여러 subject 를 연달아 재계산하면 뒤 호출이 앞 호출의 오염을 덮어
// 가려 버린다. 그래서 함수 자체를 직접 부른다.
// ---------------------------------------------------------------------------

func recomputeInTx(t *testing.T, db *sql.DB, subjectID string) int {
	t.Helper()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback()
	n, err := RecomputeSnapshotsForSubjectTx(context.Background(), tx, subjectID)
	if err != nil {
		t.Fatalf("recompute: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}
	return n
}

func seedRawRecord(t *testing.T, db *sql.DB, id, userID, subjectID, day string) {
	t.Helper()
	if _, err := db.Exec(`
		INSERT INTO records (id, user_id, subject_id, content, visibility, created_at)
		VALUES (?, ?, ?, 'entry', 'private', ?)
	`, id, userID, subjectID, day+" 09:30:00"); err != nil {
		t.Fatalf("seed record %s: %v", id, err)
	}
}

// 기준값 행이 통째로 사라진 subject 는 재계산 대상이 아니다 — 온보딩이 아이
// 목록을 줄이면 fetuses/children 행만 지워지고 record_subjects 와 기록은 남는데,
// 그 상태로 재계산하면 과거 스냅샷이 NULL 로 덮여 사라진다. 물리 저장을 택한
// 이유("기준값이 사라져도 표시 가능", ENG-013) 를 정면으로 무효화하는 경로다.
func TestRecomputeSnapshotsForSubjectTx_MissingBasisRow_PreservesSnapshot(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")
	seedSubjectWithBasis(t, db, "u1", "subj-gone", "fetus", "2026-11-16", 7)
	seedRawRecord(t, db, "r1", "u1", "subj-gone", "2026-08-08")

	if n := recomputeInTx(t, db, "subj-gone"); n != 1 {
		t.Fatalf("baseline recompute: want 1 row, got %d", n)
	}
	before := readSnapshot(t, db, "r1")
	if before.Days == nil || *before.Days != 180 {
		t.Fatalf("baseline: want days=180, got %s", formatSnapshot(before))
	}

	// 아이가 목록에서 빠진 상태를 재현한다 — 프로필 행만 사라지고 subject 와
	// 기록은 남는다.
	if _, err := db.Exec(`DELETE FROM fetuses WHERE id = 'subj-gone'`); err != nil {
		t.Fatalf("drop fetus row: %v", err)
	}

	if n := recomputeInTx(t, db, "subj-gone"); n != 0 {
		t.Errorf("기준값 행이 없는데 %d 행을 다시 썼다 — 스냅샷이 지워진다", n)
	}
	if after := readSnapshot(t, db, "r1"); formatSnapshot(after) != formatSnapshot(before) {
		t.Errorf("기준값 행 소멸이 과거 스냅샷을 지웠다: %s → %s",
			formatSnapshot(before), formatSnapshot(after))
	}
}

// 재계산은 subject_id 로만 스코프된다. 이 성질이 깨지면 한 아이의 기준값이 다른
// 아이의 기록에 칠해지고, 그것이 ENG-013 이 "구현상 가장 틀리기 쉬운 지점" 으로
// 지목한 임신기 기록의 "생후 -N개월" 오염이다.
func TestRecomputeSnapshotsForSubjectTx_ScopedToSubject(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	seedUser(t, db, "u1", "a@b.com")
	// 같은 사용자의 두 아이: 임신 중인 아이와 이미 태어난 아이.
	seedSubjectWithBasis(t, db, "u1", "subj-fetus", "fetus", "2026-11-16", 7)
	seedSubjectWithBasis(t, db, "u1", "subj-child", "child", "2025-08-08", 8)
	seedRawRecord(t, db, "r-preg", "u1", "subj-fetus", "2026-08-08")
	seedRawRecord(t, db, "r-post", "u1", "subj-child", "2026-08-08")

	recomputeInTx(t, db, "subj-fetus")
	recomputeInTx(t, db, "subj-child")
	preg := readSnapshot(t, db, "r-preg")
	post := readSnapshot(t, db, "r-post")
	if preg.Kind == nil || *preg.Kind != stageKindPregnancy || *preg.Days != 180 {
		t.Fatalf("baseline 임신 기록: want {pregnancy 180 nil}, got %s", formatSnapshot(preg))
	}
	if post.Kind == nil || *post.Kind != stageKindPostnatal || *post.Months != 12 {
		t.Fatalf("baseline 양육 기록: want {postnatal 365 12}, got %s", formatSnapshot(post))
	}

	// 양육 아이만 재계산한다 — 임신 기록은 한 비트도 변하면 안 된다.
	if n := recomputeInTx(t, db, "subj-child"); n != 1 {
		t.Errorf("scope: want 1 row for subj-child, got %d", n)
	}
	if got := readSnapshot(t, db, "r-preg"); formatSnapshot(got) != formatSnapshot(preg) {
		t.Errorf("다른 아이의 재계산이 임신 기록을 칠했다: %s → %s",
			formatSnapshot(preg), formatSnapshot(got))
	}
	// 반대 방향도 같다.
	if n := recomputeInTx(t, db, "subj-fetus"); n != 1 {
		t.Errorf("scope: want 1 row for subj-fetus, got %d", n)
	}
	if got := readSnapshot(t, db, "r-post"); formatSnapshot(got) != formatSnapshot(post) {
		t.Errorf("다른 아이의 재계산이 양육 기록을 칠했다: %s → %s",
			formatSnapshot(post), formatSnapshot(got))
	}
}
