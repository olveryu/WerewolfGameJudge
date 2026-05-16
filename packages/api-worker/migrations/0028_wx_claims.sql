-- Pending WeChat login claims for web-view nonce-based auth flow.
-- Mini-program prepares tokens via wx.request, web-view claims them by nonce.
-- Rows auto-expire (checked on read); cron cleanup deletes stale rows.

CREATE TABLE IF NOT EXISTS wx_claims (
  nonce TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
