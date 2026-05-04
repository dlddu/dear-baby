-- Replace the single-due-date Stage 1 onboarding model with the case-branching
-- onboarding (PRD-006 AC-006-01..04). The schema keeps onboarding(user_id) as
-- the primary owner of "where is the user in the funnel" with a new case_kind
-- column, and adds two child-scoped tables:
--
--   children                — one row per fetus or already-born child, kind
--                             column distinguishes them so the AC-006-06
--                             birth transition is a UPDATE rather than a
--                             cross-table move
--   child_record_purposes   — M:N for the per-child record purposes that
--                             Case B requires (B6); A/C share the same
--                             purposes across all children by replication
--
-- due_date on onboarding loses its meaning under the new model — it now
-- lives on children instead. Drop the column to keep the schema honest.
-- The convention follows 0005_onboarding_move.up.sql (which already drops
-- columns), and modernc.org/sqlite supports ALTER TABLE … DROP COLUMN.
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
