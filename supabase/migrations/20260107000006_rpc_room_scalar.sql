-- V2: update_room_scalar RPC

CREATE OR REPLACE FUNCTION update_room_scalar(
  p_room_number TEXT,
  p_field TEXT,
  p_value JSONB,
  p_expected_value JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_room RECORD;
  v_current JSONB;
BEGIN
  SELECT * INTO v_room 
  FROM rooms 
  WHERE room_number = p_room_number 
  FOR UPDATE;
  
  IF v_room IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
  END IF;
  
  CASE p_field
    WHEN 'current_actioner_index' THEN v_current := to_jsonb(v_room.current_actioner_index);
    WHEN 'has_poison' THEN v_current := to_jsonb(v_room.has_poison);
    WHEN 'has_antidote' THEN v_current := to_jsonb(v_room.has_antidote);
    WHEN 'is_audio_playing' THEN v_current := to_jsonb(v_room.is_audio_playing);
    ELSE RETURN jsonb_build_object('success', false, 'error', 'invalid_field');
  END CASE;
  
  IF p_expected_value IS NOT NULL AND v_current != p_expected_value THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'stale_state',
      'current', v_current
    );
  END IF;
  
  CASE p_field
    WHEN 'current_actioner_index' THEN
      UPDATE rooms SET current_actioner_index = (p_value)::integer WHERE room_number = p_room_number;
    WHEN 'has_poison' THEN
      UPDATE rooms SET has_poison = (p_value)::boolean WHERE room_number = p_room_number;
    WHEN 'has_antidote' THEN
      UPDATE rooms SET has_antidote = (p_value)::boolean WHERE room_number = p_room_number;
    WHEN 'is_audio_playing' THEN
      UPDATE rooms SET is_audio_playing = (p_value)::boolean WHERE room_number = p_room_number;
  END CASE;
  
  RETURN jsonb_build_object('success', true, 'field', p_field, 'value', p_value);
END;
$func$;
