-- 케이스 분기 온보딩 (PRD-006 AC-006-01~04). 단일 due_date 흐름을
-- 들어내고, 사용자를 Case A/B/C로 분기한 뒤 한 명 이상의 아이(태아 +
-- 양육)를 입력받는 정규화 스키마로 교체한다.
--
-- 1) onboarding 테이블에 case_kind 추가, 의미를 잃은 due_date 제거.
-- 2) children 테이블 신설 — 태아·양육을 kind 컬럼으로 구분하여 한
--    테이블에 담는다. 출산 전환(AC-006-06)에서 같은 행을 UPDATE 만으로
--    fetus → child 로 변환할 수 있어야 하기 때문이다.
-- 3) child_record_purposes — 아이별 기록 목적 M:N. Case B 의 아이별
--    목적 분리를 자연스럽게 표현한다.
ALTER TABLE onboarding ADD COLUMN case_kind TEXT
  CHECK (case_kind IN ('A','B','C'));
ALTER TABLE onboarding DROP COLUMN due_date;

CREATE TABLE children (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('fetus','child')),
  display_name    TEXT,
  gender          TEXT NOT NULL CHECK (gender IN ('male','female','undecided')),
  introduction    TEXT,
  photo_s3_key    TEXT,
  birth_date      TEXT,
  pregnancy_weeks INTEGER,
  due_date        TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_children_user ON children(user_id);

CREATE TABLE child_record_purposes (
  child_id  TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  purpose   TEXT NOT NULL CHECK (purpose IN
              ('book_making','memory_keeping','family_share','emotion_diary')),
  PRIMARY KEY (child_id, purpose)
);
