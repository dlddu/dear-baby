CREATE TABLE records (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_records_user_id_created_at
  ON records(user_id, created_at DESC);

ALTER TABLE users ADD COLUMN first_record_at TEXT;
