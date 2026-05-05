-- Case-branching onboarding (PRD-006 AC-006-01..04). Replaces the single
-- "due_date" Stage 1 capture with a Q1/Q2 fork into Case A (pregnancy
-- only), Case B (parenting + pregnancy), or Case C (parenting only).
--
-- Three changes:
--   1. onboarding gains a `case_kind` column (A / B / C, nullable until
--      the user lands on Q2).
--   2. onboarding loses `due_date` — its meaning moves onto each child
--      row, and Stage 1 no longer collects a single user-level date.
--      No data preservation: the table is empty in production today
--      (no users), and the dev/staging seed sets get reset by the
--      reset-onboarding command anyway.
--   3. New `children` table holds both fetus and post-birth child rows
--      (kind discriminator), plus a `child_record_purposes` join table
--      for the multi-select recording purposes captured per child on
--      A3 / B6 / C3.

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
  purpose   TEXT NOT NULL,
  PRIMARY KEY (child_id, purpose)
);
