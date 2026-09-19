CREATE TABLE admin_reward_grants (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL,
  draw_type TEXT NOT NULL CHECK (draw_type IN ('normal', 'golden')),
  count INTEGER NOT NULL CHECK (count BETWEEN 1 AND 10000),
  reason TEXT NOT NULL,
  balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
  balance_after INTEGER NOT NULL CHECK (balance_after = balance_before + count),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_admin_reward_grants_user_created
  ON admin_reward_grants(user_id, created_at DESC, id DESC);