CREATE TABLE product_game_reward_claims (
  id TEXT PRIMARY KEY,
  input_json TEXT NOT NULL,
  is_settled INTEGER NOT NULL DEFAULT 0 CHECK (is_settled IN (0, 1))
);

CREATE TABLE product_game_reward_results (
  settlement_id TEXT NOT NULL REFERENCES product_game_reward_claims(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL CHECK (game_type IN ('werewolf', 'fibking', 'pictionary')),
  reward_kind TEXT NOT NULL CHECK (reward_kind IN ('completion', 'mvp')),
  reward_date TEXT NOT NULL,
  previous_xp INTEGER NOT NULL CHECK (previous_xp >= 0),
  xp_earned INTEGER NOT NULL CHECK (xp_earned >= 0),
  new_xp INTEGER NOT NULL CHECK (new_xp = previous_xp + xp_earned),
  previous_level INTEGER NOT NULL CHECK (previous_level >= 0),
  new_level INTEGER NOT NULL CHECK (new_level >= 0),
  normal_draws_earned INTEGER NOT NULL CHECK (normal_draws_earned >= 0),
  golden_draws_earned INTEGER NOT NULL CHECK (golden_draws_earned >= 0),
  stats_applied INTEGER NOT NULL DEFAULT 0 CHECK (stats_applied IN (0, 1)),
  PRIMARY KEY (settlement_id, user_id)
);

CREATE INDEX idx_product_game_reward_daily
  ON product_game_reward_results(user_id, game_type, reward_kind, reward_date);