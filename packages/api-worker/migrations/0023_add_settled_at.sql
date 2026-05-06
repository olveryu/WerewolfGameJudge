-- Add settled_at column to track when the last settlement occurred.
-- The level+draws update now uses lastRoomCode guard to prevent double-awarding.

ALTER TABLE user_stats ADD COLUMN settled_at TEXT;
