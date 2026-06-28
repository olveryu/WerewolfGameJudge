-- Per-game camp history for per-user camp probability statistics.
-- One row per registered player per settled game. Camp is derived from the player's
-- role Faction at settlement time. Public reads apply a 2h delay
-- (settled_at <= datetime('now','-2 hours')); self reads count all rows.
-- Idempotent under settlement retries via composite PK (user_id, settle_key).

CREATE TABLE camp_settlements (
  user_id    TEXT NOT NULL,
  settle_key TEXT NOT NULL,
  camp       TEXT NOT NULL,
  settled_at TEXT NOT NULL,
  PRIMARY KEY (user_id, settle_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_camp_settlements_user_settled ON camp_settlements(user_id, settled_at);
