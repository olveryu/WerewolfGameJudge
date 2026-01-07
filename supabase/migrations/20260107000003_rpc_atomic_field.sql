-- V2: atomic_field_update RPC

CREATE OR REPLACE FUNCTION atomic_field_update(
  p_room_number TEXT,
  p_field TEXT,
  p_key TEXT,
  p_value JSONB,
  p_condition TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_room RECORD;
  v_field_data JSONB;
  v_current_value JSONB;
BEGIN
  SELECT * INTO v_room 
  FROM rooms 
  WHERE room_number = p_room_number 
  FOR UPDATE;
  
  IF v_room IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
  END IF;
  
  CASE p_field
    WHEN 'players' THEN v_field_data := COALESCE(v_room.players, '{}'::jsonb);
    WHEN 'wolf_votes' THEN v_field_data := COALESCE(v_room.wolf_votes, '{}'::jsonb);
    WHEN 'actions' THEN v_field_data := COALESCE(v_room.actions, '{}'::jsonb);
    ELSE RETURN jsonb_build_object('success', false, 'error', 'invalid_field');
  END CASE;
  
  v_current_value := v_field_data -> p_key;
  
  IF p_condition = 'empty' THEN
    IF v_current_value IS NOT NULL AND v_current_value != 'null'::jsonb THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_taken', 'current', v_current_value);
    END IF;
  ELSIF p_condition = 'not_exists' THEN
    IF v_field_data ? p_key THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_exists', 'current', v_current_value);
    END IF;
  END IF;
  
  v_field_data := jsonb_set(v_field_data, ARRAY[p_key], p_value);
  
  CASE p_field
    WHEN 'players' THEN
      UPDATE rooms SET players = v_field_data WHERE room_number = p_room_number;
    WHEN 'wolf_votes' THEN
      UPDATE rooms SET wolf_votes = v_field_data WHERE room_number = p_room_number;
    WHEN 'actions' THEN
      UPDATE rooms SET actions = v_field_data WHERE room_number = p_room_number;
  END CASE;
  
  RETURN jsonb_build_object('success', true, 'field', p_field, 'key', p_key);
END;
$func$;
