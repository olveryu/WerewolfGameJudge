-- Persist exact rewards for at-least-once game-ended effect processing.
-- The composite key is the business idempotency boundary for one user in one effect.

CREATE TABLE game_settlement_results (
  effect_id               TEXT NOT NULL,
  user_id                 TEXT NOT NULL,
  room_code               TEXT NOT NULL,
  participant_fingerprint TEXT NOT NULL,
  camp                    TEXT NOT NULL CHECK (camp IN ('wolf', 'god', 'villager', 'third')),
  previous_xp             INTEGER NOT NULL CHECK (previous_xp >= 0),
  xp_earned               INTEGER NOT NULL CHECK (xp_earned >= 0),
  new_xp                  INTEGER NOT NULL CHECK (new_xp = previous_xp + xp_earned),
  previous_level          INTEGER NOT NULL CHECK (previous_level >= 0),
  new_level               INTEGER NOT NULL CHECK (new_level >= previous_level),
  normal_draws_earned     INTEGER NOT NULL CHECK (normal_draws_earned >= 0),
  golden_draws_earned     INTEGER NOT NULL CHECK (golden_draws_earned >= 0),
  stats_applied           INTEGER NOT NULL DEFAULT 0 CHECK (stats_applied IN (0, 1)),
  settled_at              TEXT NOT NULL,
  PRIMARY KEY (effect_id, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_game_settlement_results_user_settled
  ON game_settlement_results(user_id, settled_at);
