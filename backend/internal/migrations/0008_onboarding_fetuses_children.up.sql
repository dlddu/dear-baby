-- Add per-fetus / per-child onboarding rows. The `onboarding` table keeps
-- user-scoped state (due_date, onboarded_at, voice_coachmark_dismissed_at,
-- ai_preview, …) while the new `fetuses` and `children` tables hold the
-- per-entity records that a single user may have several of (다태아, 다자녀).
--
-- Both tables use a (user_id, ordinal) composite primary key so the order
-- the user entered the rows in (currentFetusIndex / currentChildIndex on
-- the client) is round-trippable. The `purposes_json` column stores the
-- 기록 목적 칩 selection as a JSON-encoded array of Korean labels — the
-- labels themselves are the canonical identifier, see glossary.md.
CREATE TABLE fetuses (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ordinal        INTEGER NOT NULL,
  nickname       TEXT,
  gender         TEXT,
  pregnancy_week INTEGER,
  due_date       TEXT,
  purposes_json  TEXT NOT NULL DEFAULT '[]',
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, ordinal)
);

CREATE TABLE children (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ordinal        INTEGER NOT NULL,
  name           TEXT,
  gender         TEXT,
  birth_date     TEXT,
  bio            TEXT,
  purposes_json  TEXT NOT NULL DEFAULT '[]',
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, ordinal)
);
