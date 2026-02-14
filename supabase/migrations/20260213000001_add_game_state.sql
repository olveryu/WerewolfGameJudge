-- Add game state persistence to rooms table for reliable state sync.
-- Host upserts state on every mutation; Players read via postgres_changes
-- or direct SELECT as fallback. Host in-memory GameStore remains the
-- single authority — DB is a replication target, not a source of truth.

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS game_state JSONB,
  ADD COLUMN IF NOT EXISTS state_revision INTEGER DEFAULT 0;
