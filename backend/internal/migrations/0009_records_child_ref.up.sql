-- Attach each record to the specific 아이 (태아 or 양육 아이) it was created
-- for. Until now `records` lived on (user_id, content, …) and the
-- active-아이 context was inferred client-side, so a multi-child user's
-- records were impossible to attribute. This migration adds
-- `child_kind` + `child_ordinal` referencing the (user_id, ordinal)
-- composite key used by `fetuses` and `children`.
--
-- SQLite cannot polymorphically FK a single column to two parent tables,
-- so we pair a discriminator (`child_kind`) with the ordinal and rely on:
--   1. A CHECK constraint pinning `child_kind` to the canonical labels.
--   2. Application-level validation in the records handler that the
--      (kind, ordinal) pair exists for the inserting user.
--
-- Backfill rules — each user's existing records map to (child_kind,
-- child_ordinal) by walking the candidates in order:
--   (a) ('child', 1) if the user has a children.ordinal=1 row, else
--   (b) ('fetus', 1) if the user has a fetuses.ordinal=1 row, else
--   (c) ('fetus', 1) after synthesizing one — the legacy
--       `completeOnboarding(dueDate)` path left users with an
--       `onboarding.due_date` but no entity row.
--
-- Records belonging to users with NO children, NO fetuses, AND NO
-- due_date cannot be attributed; the CREATE TABLE…NOT NULL copy step at
-- the end of this migration will fail on those rows so the migration
-- aborts rather than silently dropping them. Operators must clean them
-- up by hand before retrying.

ALTER TABLE records ADD COLUMN child_kind TEXT;
ALTER TABLE records ADD COLUMN child_ordinal INTEGER;

-- (c) Synthesize a fetus ordinal=1 row for users that have records and a
-- `due_date` but no fetus/child rows. INSERT OR IGNORE keeps this idempotent
-- in case a similar repair has already been applied out-of-band.
INSERT OR IGNORE INTO fetuses (user_id, ordinal, due_date)
SELECT DISTINCT r.user_id, 1, o.due_date
FROM records r
JOIN onboarding o ON o.user_id = r.user_id
WHERE o.due_date IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM fetuses f WHERE f.user_id = r.user_id)
  AND NOT EXISTS (SELECT 1 FROM children c WHERE c.user_id = r.user_id);

-- (a) Records for users with a child ordinal=1 map to ('child', 1).
UPDATE records
SET child_kind = 'child', child_ordinal = 1
WHERE EXISTS (
  SELECT 1 FROM children
  WHERE children.user_id = records.user_id AND children.ordinal = 1
);

-- (b) Records for users with a fetus ordinal=1 (real or just-synthesized)
-- map to ('fetus', 1). The `child_kind IS NULL` guard prevents overwriting
-- child-mapped rows for users who have both a child and a fetus
-- (양육 + 임신 동시).
UPDATE records
SET child_kind = 'fetus', child_ordinal = 1
WHERE child_kind IS NULL
  AND EXISTS (
    SELECT 1 FROM fetuses
    WHERE fetuses.user_id = records.user_id AND fetuses.ordinal = 1
  );

-- Recreate `records` with NOT NULL + CHECK constraints on the new columns.
-- SQLite cannot add NOT NULL via ALTER TABLE to a column that may hold
-- NULLs, so we rebuild the table. Any record row whose
-- child_kind/child_ordinal is still NULL (user has no children/fetuses and
-- no due_date) will fail the NOT NULL constraint during the INSERT…SELECT
-- below, aborting the migration cleanly.
CREATE TABLE records_new (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'text' CHECK(source IN ('text','voice')),
  audio_s3_key  TEXT,
  question_text TEXT,
  child_kind    TEXT NOT NULL CHECK(child_kind IN ('child','fetus')),
  child_ordinal INTEGER NOT NULL CHECK(child_ordinal >= 1),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO records_new (id, user_id, content, source, audio_s3_key, question_text, child_kind, child_ordinal, created_at)
SELECT id, user_id, content, source, audio_s3_key, question_text, child_kind, child_ordinal, created_at FROM records;

DROP TABLE records;
ALTER TABLE records_new RENAME TO records;

CREATE INDEX idx_records_user_id_created_at ON records(user_id, created_at DESC);
CREATE INDEX idx_records_user_child ON records(user_id, child_kind, child_ordinal, created_at DESC);
