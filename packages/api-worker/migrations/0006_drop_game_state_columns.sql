-- Phase 2 cleanup: game_state + state_revision moved to DO SQLite
-- D1 rooms table no longer stores game state (managed by GameRoom DO)

ALTER TABLE rooms DROP COLUMN game_state;
ALTER TABLE rooms DROP COLUMN state_revision;
