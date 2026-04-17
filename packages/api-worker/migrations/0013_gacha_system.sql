-- Gacha system: draw tickets + pity counters + draw history
-- Applied as part of gacha feature deployment

-- Add gacha-related columns to user_stats
ALTER TABLE user_stats ADD COLUMN normal_draws INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN golden_draws INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN normal_pity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN golden_pity INTEGER NOT NULL DEFAULT 0;

-- Draw history table for audit trail + duplicate detection
CREATE TABLE IF NOT EXISTS draw_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  draw_type TEXT NOT NULL,        -- 'normal' | 'golden'
  rarity TEXT NOT NULL,           -- 'common' | 'rare' | 'epic' | 'legendary'
  reward_type TEXT NOT NULL,      -- 'avatar' | 'frame' | 'seatFlair' | 'nameStyle'
  reward_id TEXT NOT NULL,
  pity_count INTEGER NOT NULL,    -- pity counter at time of draw
  pity_triggered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_draw_history_user ON draw_history(user_id);
CREATE INDEX idx_draw_history_created ON draw_history(created_at);
