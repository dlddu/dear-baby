-- Stores bcrypt password hashes for users that authenticate via
-- POST /auth/password-login. Currently used only for the seeded test
-- account that backs Apple beta review and the Maestro E2E flow, but
-- the table is generic enough to support additional password users
-- later if the product ever grows that path.
CREATE TABLE password_credentials (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
