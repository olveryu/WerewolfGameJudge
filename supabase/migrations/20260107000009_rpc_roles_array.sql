-- V2: update_roles_array RPC

CREATE OR REPLACE FUNCTION update_roles_array(
  p_room_number TEXT,
  p_roles TEXT[],
  p_host_uid TEXT
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
  
  IF v_room.host_uid != p_host_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_host');
  END IF;
  
  IF v_room.room_status > 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'game_started');
  END IF;
  
  UPDATE rooms SET 
    roles = p_roles,
    players = '{}'::jsonb,
    room_status = 0
  WHERE room_number = p_room_number;
  
  RETURN jsonb_build_object('success', true, 'roles_count', array_length(p_roles, 1));
END;
$func$;
