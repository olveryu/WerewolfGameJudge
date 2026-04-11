-- Simplify growth system: drop game_results & role_collection, add idempotency column

DROP TABLE IF EXISTS game_results;
DROP TABLE IF EXISTS user_role_collection;

ALTER TABLE user_stats ADD COLUMN last_room_code TEXT;
