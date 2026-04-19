-- Optimistic concurrency control for gacha draws.
-- Prevents duplicate rewards from concurrent draw requests (read-modify-write race).
ALTER TABLE user_stats ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
