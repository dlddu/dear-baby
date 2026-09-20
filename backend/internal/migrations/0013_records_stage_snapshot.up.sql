-- ENG-013 (단계 스냅샷 저장·재계산 정책) 의 저장 스키마.
--
-- 기록이 "작성 당시" 어느 단계였는지를 물리 저장한다. 단계는
--   stage = f(작성일, 기준값)          기준값 = due_date | birth_date
-- 라는 순수 함수의 결과이고 작성일은 불변이므로, 이 컬럼들은 그 함수의
-- 캐시다. 입력(기준값)이 바뀌는 지점에서 재계산하면 캐시는 항상 정확하다.
--
-- 컬럼이 둘이 아니라 셋인 이유: 달력 기준 개월(ENG-001)은 일수에서 복원되지
-- 않는다 (3/15 생과 1/31 생은 같은 일수에서 개월이 다르다). 값 하나만 두면
-- 개월 표시와 ENG-011 의 ±1개월 반경이 다시 birth_date 를 필요로 해서, 물리
-- 저장을 택한 이유("기준값이 사라져도 표시 가능", "컬럼 인덱스로 직접 필터")
-- 가 무효가 된다. 개월과 일수는 같은 함수의 서로 환산되지 않는 두 출력이다.
--
-- stage_kind 가 record_subjects.kind ('fetus'|'child') 와 일부러 다른 어휘를
-- 쓰는 이유: 스냅샷의 축은 아이의 *현재* 축과 독립이다 (출산 전환은 과거
-- 기록을 다시 칠하지 않는다). 같은 리터럴을 쓰면 언젠가 "중복이니 조인으로
-- 대체하자" 는 정리가 들어오고 그 순간 계약이 깨진다.
--
-- 세 컬럼은 모두 nullable 이어야 한다 — 단계 산출 불가 상태로 작성된 기록
-- (PRD-002 AC-002-05), 그리고 재계산 결과가 "단계 없음" 이 되는 경우
-- (예정일을 5주 이상 과거로 정정) 는 NULL 이다.

ALTER TABLE records ADD COLUMN stage_kind   TEXT;    -- 'pregnancy' | 'postnatal' | NULL
ALTER TABLE records ADD COLUMN stage_days   INTEGER; -- pregnancy: daysPregnant(>=0) / postnatal: daysOld(0-based)
ALTER TABLE records ADD COLUMN stage_months INTEGER; -- postnatal 전용 달력 만개월. pregnancy·단계없음은 NULL

-- ENG-011 (커뮤니티 유사 시기 추천) 의 반경 필터가 쓸 인덱스. ENG-011 본
-- 구현은 아직 없으므로 선반영이다 — 물리 저장을 택한 첫째 근거가 "컬럼
-- 인덱스로 직접 필터" 라 스키마와 함께 둔다.
CREATE INDEX idx_records_stage ON records(stage_kind, stage_months, stage_days);

-- ---------------------------------------------------------------------------
-- T3: 컬럼 도입 시 1회 백필 (ENG-013 "도입 시 1회 백필")
--
-- 아래 두 UPDATE 는 **1회성 역사 산출물**이다. 앞으로 스냅샷을 쓰는 권위는
-- backend/internal/records/stage.go 의 Go 계산기 하나뿐이며, 이 SQL 이 그것과
-- 동치라는 사실은 도입 시점에 db 패키지의 등가성 테스트가 못 박는다
-- (TestMigration0013_BackfillMatchesGoCalculator). 중복 구현으로 보고 지우지
-- 말 것 — 마이그레이션은 이미 적용된 DB 를 되돌릴 수 없으므로 불변이다.
--
-- 작성일은 date(records.created_at) — created_at 은 SQLite datetime('now') 이라
-- UTC 다. 단말 로컬 타임존과 최대 1일 어긋날 수 있다는 한계는 ENG-013 에 후속
-- 과제로 기재돼 있다 (기존 community.go 의 소급 계산과 동일한 관례를 따른다).
-- ---------------------------------------------------------------------------

-- 임신 축. ENG-001: 만삭 280일, daysPregnant = 280 - (due_date - 작성일).
-- 경계값 표 그대로 — due_date 가 5주(35일) 이상 과거거나 45주(315일) 초과
-- 미래면 단계 없음(NULL 유지), 40주 초과 미래 예정일이 만드는 음수는 0 으로
-- clamp 한다(숨기지 않는다).
UPDATE records
SET stage_kind = 'pregnancy',
    stage_days = (
      SELECT max(0, 280 - CAST(julianday(f.due_date) - julianday(date(records.created_at)) AS INTEGER))
      FROM record_subjects rs JOIN fetuses f ON f.id = rs.id
      WHERE rs.id = records.subject_id
    ),
    stage_months = NULL
WHERE EXISTS (
  SELECT 1
  FROM record_subjects rs JOIN fetuses f ON f.id = rs.id
  WHERE rs.id = records.subject_id
    AND rs.kind = 'fetus'
    AND f.due_date IS NOT NULL
    AND CAST(julianday(f.due_date) - julianday(date(records.created_at)) AS INTEGER) BETWEEN -35 AND 315
);

-- 양육 축. daysOld = 작성일 - birth_date (출생 당일 = 0; "n일째" 표기는 +1).
-- 개월은 30일 나눗셈이 아니라 달력 기준이며, 말일 출생(1/31 → 2/28)은 해당
-- 월의 마지막 날로 절사한다 (ENG-001). date(day,'start of month','+1 month',
-- '-1 day') 가 작성일이 속한 달의 말일이다.
-- birth_date 가 작성일보다 미래면 오탈자로 보고 단계 없음(NULL 유지).
UPDATE records
SET stage_kind = 'postnatal',
    stage_days = (
      SELECT CAST(julianday(date(records.created_at)) - julianday(c.birth_date) AS INTEGER)
      FROM record_subjects rs JOIN children c ON c.id = rs.id
      WHERE rs.id = records.subject_id
    ),
    stage_months = (
      SELECT (CAST(strftime('%Y', date(records.created_at)) AS INTEGER) - CAST(strftime('%Y', c.birth_date) AS INTEGER)) * 12
           + (CAST(strftime('%m', date(records.created_at)) AS INTEGER) - CAST(strftime('%m', c.birth_date) AS INTEGER))
           - (CASE WHEN CAST(strftime('%d', date(records.created_at)) AS INTEGER)
                        < min(CAST(strftime('%d', c.birth_date) AS INTEGER),
                              CAST(strftime('%d', date(date(records.created_at), 'start of month', '+1 month', '-1 day')) AS INTEGER))
                   THEN 1 ELSE 0 END)
      FROM record_subjects rs JOIN children c ON c.id = rs.id
      WHERE rs.id = records.subject_id
    )
WHERE EXISTS (
  SELECT 1
  FROM record_subjects rs JOIN children c ON c.id = rs.id
  WHERE rs.id = records.subject_id
    AND rs.kind = 'child'
    AND c.birth_date IS NOT NULL
    AND julianday(date(records.created_at)) >= julianday(c.birth_date)
);
