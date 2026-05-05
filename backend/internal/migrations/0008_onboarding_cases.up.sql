-- 케이스 분기 온보딩 (PRD-006 AC-006-01~04). due_date 단일 흐름을 폐기하고
-- 다음 세 가지 변경을 적용한다:
--
--   1. onboarding.case_kind — 회원이 거친 케이스 분기 결과 (A/B/C). 폐기되는
--      onboarding.due_date 컬럼은 children 행에 흡수되므로 삭제한다. SQLite의
--      ALTER TABLE ... DROP COLUMN 은 modernc.org/sqlite 빌드에서 지원되며
--      0006_records_audio.down.sql 도 동일한 패턴을 사용한다.
--
--   2. children — 양육(kind='child') 또는 임신(kind='fetus') 단일 테이블.
--      AC-006-06 의 출산 전환은 같은 행을 UPDATE 만으로 fetus → child 로 옮길
--      수 있어야 하므로 두 테이블이 아닌 한 테이블 + kind 컬럼 구조를 택한다.
--      양육 전용 필드(birth_date), 임신 전용 필드(pregnancy_weeks/due_date) 는
--      모두 nullable. 한 행의 정합성은 애플리케이션 검증에서 보장한다.
--
--   3. child_record_purposes — 아이별 기록 목적 (M:N). Case B(AC-006-03) 의
--      "아이별로 다른 목적" 요구를 자연스럽게 표현한다. Case A/C 처럼 모든
--      아이에 동일 목적을 적용하는 경우엔 같은 값을 N번 INSERT 한다.
ALTER TABLE onboarding ADD COLUMN case_kind TEXT
  CHECK (case_kind IN ('A','B','C'));
ALTER TABLE onboarding DROP COLUMN due_date;

CREATE TABLE children (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('fetus','child')),
  -- 공통
  display_name    TEXT,
  gender          TEXT NOT NULL CHECK (gender IN ('male','female','undecided')),
  introduction    TEXT,
  photo_s3_key    TEXT,
  -- 양육 전용
  birth_date      TEXT,
  -- 임신 전용
  pregnancy_weeks INTEGER,
  due_date        TEXT,
  -- 메타
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_children_user ON children(user_id);

CREATE TABLE child_record_purposes (
  child_id  TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  purpose   TEXT NOT NULL
            CHECK (purpose IN ('book_making','memory_keeping','family_share','emotion_diary')),
  PRIMARY KEY (child_id, purpose)
);
