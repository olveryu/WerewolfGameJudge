-- Shard system: add shards balance to user_stats + is_duplicate/shards_awarded to draw_history
-- Duplicates now award shards instead of being filtered out

ALTER TABLE user_stats ADD COLUMN shards INTEGER NOT NULL DEFAULT 0;

ALTER TABLE draw_history ADD COLUMN is_duplicate INTEGER NOT NULL DEFAULT 0;
ALTER TABLE draw_history ADD COLUMN shards_awarded INTEGER NOT NULL DEFAULT 0;
