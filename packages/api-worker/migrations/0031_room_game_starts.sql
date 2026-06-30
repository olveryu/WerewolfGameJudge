-- 0031: Track game starts per room (for admin portal "has a game started?" visibility).
-- games_started increments each time startNight succeeds (Ready→Ongoing); survives DO
-- state resets (restart), so the admin room list can tell played vs never-played rooms.

ALTER TABLE rooms ADD COLUMN games_started INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN last_started_at TEXT;
