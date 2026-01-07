-- V2: advance_action_index RPC

CREATE OR REPLACE FUNCTION advance_action_index(
  p_room_number TEXT,
  p_expected_index INTEGER,
  p_action_data JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_room RECORD;
  v_new_index INTEGER;
  v_actions JSONB;
  v_role TEXT;
  v_target INTEGER;
BEGIN
  SELECT * INTO v_room 
  FROM rooms 
  WHERE room_number = p_room_number 
  FOR UPDATE;
  
  IF v_room IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
  END IF;
  
  IF v_room.current_actioner_index != p_expected_index THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'stale_index',
      'current_index', v_room.current_actioner_index
    );
  END IF;
  
  v_new_index := p_expected_index + 1;
  v_actions := COALESCE(v_room.actions, '{}'::jsonb);
  
  IF p_action_data IS NOT NULL THEN
    v_role := p_action_data ->> 'role';
    v_target := (p_action_data ->> 'target')::integer;
    IF v_role IS NOT NULL THEN
      v_actions := jsonb_set(v_actions, ARRAY[v_role], to_jsonb(v_target));
    END IF;
  END IF;
  
  UPDATE rooms SET 
    current_actioner_index = v_new_index,
    actions = v_actions
  WHERE room_number = p_room_number;
  
  RETURN jsonb_build_object(
    'success', true, 
    'previous_index', p_expected_index,
    'new_index', v_new_index
  );
END;
$func$;
