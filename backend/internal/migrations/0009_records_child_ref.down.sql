-- Reverse the records.child_kind / records.child_ordinal addition. We
-- rebuild the table because SQLite < 3.35 cannot drop columns; even on
-- newer SQLite the recreate keeps this migration symmetric with the up
-- step.
--
-- Note: the synthesized fetuses rows from the up step are NOT rolled
-- back — they hold real data (a copy of onboarding.due_date) that down
-- should not silently destroy. Operators rolling back manually must
-- clean those up if they want a pristine pre-0009 state.

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
