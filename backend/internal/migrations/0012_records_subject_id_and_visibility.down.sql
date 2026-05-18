-- Reverse of 0012. Drops new indexes/columns/tables in reverse creation order.
-- records 테이블은 다시 재작성해서 subject_id / visibility 컬럼을 떼어낸다.
-- 가상 fetus row 와 record_subjects row 는 down 시 그대로 두고 (records 가
-- 사라지면 어차피 참조 없음), fetuses/children.id 만 정리한다.
PRAGMA foreign_keys = OFF;

CREATE TABLE records_old (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'text' CHECK(source IN ('text','voice')),
  audio_s3_key  TEXT,
  question_text TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO records_old (id, user_id, content, source, audio_s3_key, question_text, created_at)
  SELECT id, user_id, content, source, audio_s3_key, question_text, created_at FROM records;

DROP TABLE records;
ALTER TABLE records_old RENAME TO records;
CREATE INDEX idx_records_user_id_created_at ON records(user_id, created_at DESC);

PRAGMA foreign_keys = ON;

DROP INDEX IF EXISTS idx_fetuses_id;
DROP INDEX IF EXISTS idx_children_id;
ALTER TABLE fetuses  DROP COLUMN id;
ALTER TABLE children DROP COLUMN id;

DROP INDEX IF EXISTS idx_record_subjects_user_id;
DROP TABLE record_subjects;
