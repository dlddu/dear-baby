-- PRD-006 케이스 분기 온보딩.
--
-- onboarding 테이블에 두 개의 독립 체크 답변(임신/양육) 과 임신 단태/다태
-- 플래그를 추가하고, 양육 중 아이와 임신 중 아이를 한 테이블에서 다루는
-- children + child_purposes 테이블을 신설한다. 통합 vs 분리 결정 배경은
-- docs/engineering/onboarding-cases-data-model.md 참고.
ALTER TABLE onboarding ADD COLUMN is_pregnant         BOOLEAN;
ALTER TABLE onboarding ADD COLUMN has_children        BOOLEAN;
ALTER TABLE onboarding ADD COLUMN multiple_pregnancy  BOOLEAN;

CREATE TABLE children (
  id                      TEXT PRIMARY KEY,
  user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                  TEXT NOT NULL CHECK (status IN ('parenting','pregnancy')),
  name                    TEXT,
  gender                  TEXT NOT NULL CHECK (gender IN ('female','male','unknown')),
  birth_date              TEXT,
  due_date                TEXT,
  pregnancy_week          INTEGER,
  bio                     TEXT,
  photo_s3_key            TEXT,
  is_due_date_undecided   INTEGER NOT NULL DEFAULT 0,
  display_order           INTEGER NOT NULL DEFAULT 0,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (status = 'parenting' AND birth_date IS NOT NULL)
    OR
    (status = 'pregnancy' AND (due_date IS NOT NULL OR is_due_date_undecided = 1))
  )
);

CREATE INDEX idx_children_user_order ON children(user_id, display_order);

CREATE TABLE child_purposes (
  child_id  TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  purpose   TEXT NOT NULL,
  position  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (child_id, purpose)
);

CREATE INDEX idx_child_purposes_child ON child_purposes(child_id, position);
