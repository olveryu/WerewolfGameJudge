-- V2: batch_update_players RPC

CREATE OR REPLACE FUNCTION batch_update_players(
  p_room_number TEXT,
  p_updates JSONB,
  p_host_uid TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_room RECORD;
  v_players JSONB;
  v_key TEXT;
  v_value JSONB;
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
  
  v_players := COALESCE(v_room.players, '{}'::jsonb);
  
  FOR v_key, v_value IN SELECT * FROM jsonb_each(p_updates)
  LOOP
    v_players := jsonb_set(v_players, ARRAY[v_key], v_value);
  END LOOP;
  
  UPDATE rooms SET players = v_players WHERE room_number = p_room_number;
  
  RETURN jsonb_build_object('success', true);
END;
$func$;
