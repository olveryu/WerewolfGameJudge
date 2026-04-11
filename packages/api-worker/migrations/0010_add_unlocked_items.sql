-- Add unlocked_items column to track per-player random unlocks (JSON string array)

ALTER TABLE user_stats ADD COLUMN unlocked_items TEXT NOT NULL DEFAULT '[]';
