-- PRD-008 (일기 탭) 데이터 모델 확장:
--   1) record_subjects 신규 테이블 — 한 사용자의 "기록 대상"(태아/아이) 을
--      단일 uuid 로 정규화한다. records.subject_id 는 여기를 가리켜
--      어떤 아이의 기록인지 식별한다. fetuses/children PK 는
--      (user_id, ordinal) 복합이라 records 가 직접 가리키기 어려워
--      한 단계 우회한다.
--   2) fetuses/children 에 uuid `id` 컬럼을 추가하고 기존 row 에 채움 —
--      record_subjects 와 1:1 매핑되는 안정적인 식별자가 된다.
--   3) records 에 subject_id (NOT NULL) + visibility (NOT NULL, CHECK) 컬럼.
--      visibility 디폴트는 'private' — PRD-008 후속 검토(휴지통·다중 선택
--      삭제 등) 까지는 사용자 신뢰 우선 정책.
--   4) 기존 records 휴리스틱 backfill: 사용자가 children 을 가지고 있으면
--      MIN(ordinal) children id, 없으면 MIN(ordinal) fetuses id 로 매핑.
--      둘 다 없으면 가상의 subject 를 만들어 매핑(기록은 보존). visibility
--      는 일괄 'private'.
--
-- SQLite 의 ALTER TABLE 은 NOT NULL 컬럼을 빈 컬럼에 직접 부과하지 못해
-- (DEFAULT 가 있어야 함), records 컬럼은 임시 컬럼 → backfill → 신규
-- 테이블로 RENAME 패턴을 쓴다.

-- (1) record_subjects 정규화 테이블.
--   kind 는 'fetus' | 'child' — record_subjects 만 보고 어떤 종류의 대상인지
--   알 수 있도록 저장한다. (user_id, kind, ordinal) UNIQUE 로 fetuses/children
--   복합 PK 와 1:1 매핑.
CREATE TABLE record_subjects (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK(kind IN ('fetus','child')),
  ordinal    INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, kind, ordinal)
);
CREATE INDEX idx_record_subjects_user_id ON record_subjects(user_id);

-- (2) fetuses/children 에 uuid id 컬럼 추가.
--   SQLite 는 NOT NULL UNIQUE 컬럼을 ADD COLUMN 으로 단독 추가하지 못한다
--   (DEFAULT 없이는 빈 컬럼이 NOT NULL 위배). 임시 nullable 로 추가 → backfill
--   → UNIQUE INDEX 로 유일성 보장. (CHECK NOT NULL 은 INSERT 가드는 아래
--   onboarding 코드 + 트리거 없는 단순 컬럼이라 어플리케이션 레벨에서 보장한다.)
ALTER TABLE fetuses  ADD COLUMN id TEXT;
ALTER TABLE children ADD COLUMN id TEXT;

-- 기존 fetuses/children row 에 uuid 부여 + record_subjects row 생성.
-- 두 단계는 같은 마이그레이션 안에 있어 트랜잭션으로 묶인다.
-- lower-hex uuid (v4) — sqlite 에 uuid() 함수가 없으므로 randomblob+hex 조합으로
-- 직접 생성한다 (RFC 4122 strict variant 까지 강제하진 않지만 단조성·고유성은 충분).
UPDATE fetuses
SET id = lower(
    hex(randomblob(4)) || '-' ||
    hex(randomblob(2)) || '-' ||
    '4' || substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
    hex(randomblob(6))
)
WHERE id IS NULL;
UPDATE children
SET id = lower(
    hex(randomblob(4)) || '-' ||
    hex(randomblob(2)) || '-' ||
    '4' || substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
    hex(randomblob(6))
)
WHERE id IS NULL;

INSERT INTO record_subjects (id, user_id, kind, ordinal)
  SELECT id, user_id, 'fetus', ordinal FROM fetuses;
INSERT INTO record_subjects (id, user_id, kind, ordinal)
  SELECT id, user_id, 'child', ordinal FROM children;

-- 추후 INSERT 시 id 가 빠지지 않도록 UNIQUE 인덱스 (NOT NULL 은 어플리케이션이
-- 보장; SQLite ALTER 한계로 컬럼 정의 변경은 다음 마이그레이션에서 테이블
-- 재작성으로 처리할 수 있음).
CREATE UNIQUE INDEX idx_fetuses_id  ON fetuses(id);
CREATE UNIQUE INDEX idx_children_id ON children(id);

-- (3·4) records 에 subject_id + visibility 추가.
--   3a. nullable 컬럼으로 추가
--   3b. backfill (다자녀: MIN(ordinal) children → fetuses → 가상 subject 순)
--   3c. 신규 테이블로 옮기면서 NOT NULL 활성화
ALTER TABLE records ADD COLUMN subject_id TEXT;
ALTER TABLE records ADD COLUMN visibility TEXT;

-- 기존 records.subject_id backfill — 사용자 단위 휴리스틱:
--   1순위: MIN(ordinal) 의 child
--   2순위: MIN(ordinal) 의 fetus
--   3순위: 가상 subject ("legacy") — 일관성을 깨지 않기 위해 마지막 안전망
-- 휴리스틱 매핑은 다자녀 사용자의 일부 기록을 잘못 분류할 수 있음을 PRD-008
-- 마이그레이션 노트에 명시. 사후 보정 UI 는 별도 후속 PRD.
WITH first_child AS (
  SELECT user_id, id
  FROM children c1
  WHERE ordinal = (SELECT MIN(ordinal) FROM children c2 WHERE c2.user_id = c1.user_id)
),
first_fetus AS (
  SELECT user_id, id
  FROM fetuses f1
  WHERE ordinal = (SELECT MIN(ordinal) FROM fetuses f2 WHERE f2.user_id = f1.user_id)
)
UPDATE records
SET subject_id = COALESCE(
  (SELECT id FROM first_child WHERE first_child.user_id = records.user_id),
  (SELECT id FROM first_fetus WHERE first_fetus.user_id = records.user_id)
)
WHERE subject_id IS NULL;

-- 양쪽 모두 비어 있는 (기록은 있는데 fetuses/children 모두 없는) 레거시
-- 사용자에게는 가상 subject 를 만들어 매핑. 'fetus' 종류로 ordinal=0 잡고
-- 비어있는 fetuses row 도 함께 생성해 (user_id, kind, ordinal) UNIQUE 제약을
-- 만족. 0009 의 backfill_legacy_fetuses 와 비슷한 안전망 역할이며, 다음
-- 로그인 시 사용자가 Stage 1 을 다시 거치면 자연스럽게 본인의 row 가 채워진다.
INSERT INTO fetuses (user_id, ordinal, id)
  SELECT DISTINCT r.user_id, 0,
    lower(
      hex(randomblob(4)) || '-' ||
      hex(randomblob(2)) || '-' ||
      '4' || substr(hex(randomblob(2)), 2) || '-' ||
      substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
      hex(randomblob(6))
    )
  FROM records r
  WHERE r.subject_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM fetuses  f WHERE f.user_id = r.user_id)
    AND NOT EXISTS (SELECT 1 FROM children c WHERE c.user_id = r.user_id);
INSERT INTO record_subjects (id, user_id, kind, ordinal)
  SELECT f.id, f.user_id, 'fetus', f.ordinal
  FROM fetuses f
  WHERE NOT EXISTS (
    SELECT 1 FROM record_subjects rs
    WHERE rs.user_id = f.user_id AND rs.kind = 'fetus' AND rs.ordinal = f.ordinal
  );
UPDATE records
SET subject_id = (
  SELECT id FROM fetuses
  WHERE fetuses.user_id = records.user_id AND fetuses.ordinal = 0
)
WHERE subject_id IS NULL;

-- visibility backfill — 일괄 'private'.
UPDATE records SET visibility = 'private' WHERE visibility IS NULL;

-- (3c) records 테이블 재생성으로 NOT NULL + CHECK 활성화. golang-migrate 가
-- 트랜잭션으로 감싸 실행하므로 외래 데이터를 잃지 않는다. PRAGMA foreign_keys
-- 는 ALTER 흐름 내에서만 비활성 — modernc/sqlite 는 connection 단위 PRAGMA
-- 라 본 마이그레이션 동안만 영향 (DSN 의 foreign_keys(1) 은 connection
-- pool 재진입 시 복원).
PRAGMA foreign_keys = OFF;

CREATE TABLE records_new (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id    TEXT NOT NULL REFERENCES record_subjects(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'text' CHECK(source IN ('text','voice')),
  audio_s3_key  TEXT,
  question_text TEXT,
  visibility    TEXT NOT NULL CHECK(visibility IN ('private','public')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO records_new (id, user_id, subject_id, content, source, audio_s3_key, question_text, visibility, created_at)
  SELECT id, user_id, subject_id, content, source, audio_s3_key, question_text, visibility, created_at FROM records;

DROP TABLE records;
ALTER TABLE records_new RENAME TO records;
CREATE INDEX idx_records_user_id_created_at  ON records(user_id, created_at DESC);
CREATE INDEX idx_records_subject_id          ON records(subject_id, created_at DESC);
CREATE INDEX idx_records_user_visibility     ON records(user_id, visibility, created_at DESC);

PRAGMA foreign_keys = ON;
