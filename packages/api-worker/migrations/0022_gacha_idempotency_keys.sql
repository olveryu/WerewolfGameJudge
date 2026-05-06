-- Idempotency keys for gacha draw/exchange operations.
-- Prevents duplicate ticket consumption on network retry.
-- Cleaned up daily by cron (TTL: 24h).

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  response TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_idempotency_keys_created_at ON idempotency_keys(created_at);
