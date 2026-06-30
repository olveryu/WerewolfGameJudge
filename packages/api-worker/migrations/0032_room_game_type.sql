-- 0032: Add game_type to rooms so create/join can route by game (werewolf, fibking, …).
-- Existing rows backfill to 'werewolf' via the column DEFAULT.

ALTER TABLE rooms ADD COLUMN game_type TEXT NOT NULL DEFAULT 'werewolf';
