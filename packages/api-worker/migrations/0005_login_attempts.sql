-- Track failed login attempts per email for brute-force rate limiting
CREATE TABLE IF NOT EXISTS login_attempts (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email_hash   TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_login_attempts_email_hash ON login_attempts(email_hash);
CREATE INDEX idx_login_attempts_at ON login_attempts(attempted_at);
