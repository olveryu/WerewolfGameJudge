-- V2: use_witch_potion RPC

CREATE OR REPLACE FUNCTION use_witch_potion(
  p_room_number TEXT,
  p_potion_type TEXT,
  p_target INTEGER,
  p_expected_index INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_room RECORD;
  v_new_index INTEGER;
  v_actions JSONB;
  v_witch_action INTEGER;
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
  
  v_actions := COALESCE(v_room.actions, '{}'::jsonb);
  v_new_index := p_expected_index + 1;
  
  IF p_potion_type = 'antidote' THEN
    IF NOT v_room.has_antidote THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_antidote');
    END IF;
    v_actions := jsonb_set(v_actions, '{witch}', to_jsonb(p_target));
    UPDATE rooms SET 
      has_antidote = false,
      actions = v_actions,
      current_actioner_index = v_new_index
    WHERE room_number = p_room_number;
  ELSIF p_potion_type = 'poison' THEN
    IF NOT v_room.has_poison THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_poison');
    END IF;
    v_witch_action := -(p_target + 1);
    v_actions := jsonb_set(v_actions, '{witch}', to_jsonb(v_witch_action));
    UPDATE rooms SET 
      has_poison = false,
      actions = v_actions,
      current_actioner_index = v_new_index
    WHERE room_number = p_room_number;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_potion_type');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'potion_type', p_potion_type,
    'new_index', v_new_index
  );
END;
$func$;
