-- V2: update_room_status RPC

CREATE OR REPLACE FUNCTION update_room_status(
  p_room_number TEXT,
  p_new_status INTEGER,
  p_expected_status INTEGER DEFAULT NULL,
  p_host_uid TEXT DEFAULT NULL,
  p_reset_fields BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_room RECORD;
BEGIN
  SELECT * INTO v_room 
  FROM rooms 
  WHERE room_number = p_room_number 
  FOR UPDATE;
  
  IF v_room IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
  END IF;
  
  IF p_host_uid IS NOT NULL AND v_room.host_uid != p_host_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_host');
  END IF;
  
  IF p_expected_status IS NOT NULL AND v_room.room_status != p_expected_status THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'wrong_status',
      'current_status', v_room.room_status
    );
  END IF;
  
  IF p_reset_fields THEN
    UPDATE rooms SET 
      room_status = p_new_status,
      current_actioner_index = 0,
      actions = '{}'::jsonb,
      wolf_votes = '{}'::jsonb,
      has_poison = true,
      has_antidote = true,
      is_audio_playing = false
    WHERE room_number = p_room_number;
  ELSE
    UPDATE rooms SET room_status = p_new_status WHERE room_number = p_room_number;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'new_status', p_new_status);
END;
$func$;
