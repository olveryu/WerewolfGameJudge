CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
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
  is_audio_playing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms(updated_at);
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can create rooms" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rooms" ON rooms FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete rooms" ON rooms FOR DELETE USING (true);
