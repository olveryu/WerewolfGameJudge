-- Daily login reward: track last claim date (player's local YYYY-MM-DD)
ALTER TABLE user_stats ADD COLUMN last_login_reward_at TEXT;
