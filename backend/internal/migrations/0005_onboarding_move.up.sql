-- Move all onboarding-related user state into a dedicated `onboarding`
-- table, and extend it with `ai_preview` for the LLM-edited
-- preview. The rename from stage2_coachmark_dismissed_at →
-- voice_coachmark_dismissed_at drops the "stage" vocabulary from the schema
-- so names reflect what the column means, not the UX phase it was first
-- introduced in.
CREATE TABLE onboarding (
  user_id                      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  due_date                     TEXT,
  onboarded_at                 TEXT,
  voice_coachmark_dismissed_at TEXT,
  first_record_at              TEXT,
  ai_preview                   TEXT,
  updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO onboarding (user_id, due_date, onboarded_at, voice_coachmark_dismissed_at, first_record_at)
  SELECT id, due_date, onboarded_at, stage2_coachmark_dismissed_at, first_record_at FROM users;

ALTER TABLE users DROP COLUMN due_date;
ALTER TABLE users DROP COLUMN onboarded_at;
ALTER TABLE users DROP COLUMN stage2_coachmark_dismissed_at;
ALTER TABLE users DROP COLUMN first_record_at;
