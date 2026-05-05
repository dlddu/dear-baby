-- Replace the single-flow onboarding (PATCH /me with `due_date`) with the
-- case-branching onboarding defined in PRD-006 AC-006-01~04. Adds a `case_kind`
-- column to `onboarding`, normalizes child information into a dedicated
-- `children` table (covers both fetus and child via a `kind` discriminator),
-- and pulls per-child recording purposes out into a M:N join table.
--
-- The existing `onboarding.due_date` column loses its meaning — fetal due
-- dates now belong to individual children. We DROP COLUMN here, matching
-- the convention established in 0005_onboarding_move and supported by
-- modernc.org/sqlite. Down restores the column shape only ([O3] — there
-- are no production users to back-fill).
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
