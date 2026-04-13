CREATE TABLE diary_entries (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  entry_type  TEXT NOT NULL DEFAULT 'voice',
  week        INTEGER,
  duration    INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_diary_entries_user_id ON diary_entries(user_id);
CREATE INDEX idx_diary_entries_user_week ON diary_entries(user_id, week);
