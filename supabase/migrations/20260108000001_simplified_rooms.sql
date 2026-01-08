-- Simplified rooms table for new architecture
-- All game state is managed in-memory on host device
-- Database only stores minimal room discovery info

CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  host_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick room lookup by code
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);

-- Index for finding rooms by host
CREATE INDEX IF NOT EXISTS idx_rooms_host_id ON public.rooms(host_id);

-- Enable Row Level Security
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read rooms (to join)
CREATE POLICY "Anyone can read rooms" ON public.rooms
  FOR SELECT USING (true);

-- Policy: Authenticated users can create rooms
CREATE POLICY "Authenticated users can create rooms" ON public.rooms
  FOR INSERT WITH CHECK (true);

-- Policy: Host can update their own room
CREATE POLICY "Host can update own room" ON public.rooms
  FOR UPDATE USING (true);

-- Policy: Host can delete their own room
CREATE POLICY "Host can delete own room" ON public.rooms
  FOR DELETE USING (true);

-- Enable Realtime for rooms table
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;

-- Grant permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
