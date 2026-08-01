-- Make gacha stats, history, and replay one atomic D1 batch ledger.

ALTER TABLE idempotency_keys RENAME TO _idempotency_keys_before_ledger;

CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL CHECK (length(claim_id) > 0),
  operation TEXT NOT NULL CHECK (operation IN ('draw', 'exchange')),
  is_applied INTEGER NOT NULL CHECK (is_applied IN (0, 1)),
  response TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO idempotency_keys (
  key,
  user_id,
  claim_id,
  operation,
  is_applied,
  response,
  created_at
)
SELECT
  key,
  user_id,
  key,
  CASE
    WHEN json_type(response, '$.results') = 'array' THEN 'draw'
    WHEN json_type(response, '$.rewardId') = 'text' THEN 'exchange'
    ELSE NULL
  END,
  1,
  response,
  created_at
FROM _idempotency_keys_before_ledger;

DROP TABLE _idempotency_keys_before_ledger;

CREATE UNIQUE INDEX idx_idempotency_keys_claim_id ON idempotency_keys(claim_id);
CREATE INDEX idx_idempotency_keys_created_at ON idempotency_keys(created_at);
