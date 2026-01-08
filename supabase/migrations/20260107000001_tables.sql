CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT UNIQUE NOT NULL,
  host_uid TEXT NOT NULL,
  room_status INTEGER NOT NULL DEFAULT 0,
  roles JSONB DEFAULT '[]'::jsonb,
  players JSONB DEFAULT '{}'::jsonb,
  action_order JSONB DEFAULT '[]'::jsonb,
  action_index INTEGER DEFAULT 0,
  audio_playing BOOLEAN DEFAULT false,
  wolf_votes JSONB DEFAULT '{}'::jsonb,
  has_poison BOOLEAN DEFAULT true,
  has_antidote BOOLEAN DEFAULT true,
  night_phase JSONB,
  night_actions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON public.rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_rooms_host_uid ON public.rooms(host_uid);
