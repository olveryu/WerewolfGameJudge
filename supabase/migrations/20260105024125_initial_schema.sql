-- ============================================
-- Initial Schema for Werewolf Judge
-- ============================================

-- Enable UUID extension (with schema for Supabase compatibility)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  room_number TEXT UNIQUE NOT NULL,
  host_uid TEXT NOT NULL,
  room_status INTEGER DEFAULT 0,
  roles TEXT[] NOT NULL,
  players JSONB DEFAULT '{}',
  actions JSONB DEFAULT '{}',
  wolf_votes JSONB DEFAULT '{}',
  current_actioner_index INTEGER DEFAULT 0,
  has_poison BOOLEAN DEFAULT true,
  has_antidote BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on room_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON rooms(room_number);

-- Create index on updated_at for inactive room cleanup queries
CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms(updated_at);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read rooms (needed for joining)
CREATE POLICY "Anyone can read rooms" ON rooms
  FOR SELECT
  USING (true);

-- Policy: Anyone can create rooms (including anonymous users)
CREATE POLICY "Anyone can create rooms" ON rooms
  FOR INSERT
  WITH CHECK (true);

-- Policy: Anyone can update rooms (for taking seats, game actions)
CREATE POLICY "Anyone can update rooms" ON rooms
  FOR UPDATE
  USING (true);

-- Policy: Anyone can delete rooms
CREATE POLICY "Anyone can delete rooms" ON rooms
  FOR DELETE
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up inactive rooms (no activity for 2 hours)
CREATE OR REPLACE FUNCTION cleanup_inactive_rooms()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rooms WHERE updated_at < NOW() - INTERVAL '2 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================
-- Storage: Avatar Bucket
-- ============================================

-- Create avatars bucket for user profile pictures
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Policy: Authenticated users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Enable realtime for rooms table
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
