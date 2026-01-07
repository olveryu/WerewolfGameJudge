-- V2: remove_field_key RPC

CREATE OR REPLACE FUNCTION remove_field_key(
  p_room_number TEXT,
  p_field TEXT,
  p_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_room RECORD;
  v_field_data JSONB;
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
  
  v_field_data := v_field_data - p_key;
  
  CASE p_field
    WHEN 'players' THEN
      UPDATE rooms SET players = v_field_data WHERE room_number = p_room_number;
    WHEN 'wolf_votes' THEN
      UPDATE rooms SET wolf_votes = v_field_data WHERE room_number = p_room_number;
    WHEN 'actions' THEN
      UPDATE rooms SET actions = v_field_data WHERE room_number = p_room_number;
  END CASE;
  
  RETURN jsonb_build_object('success', true, 'removed', p_key);
END;
$func$;
