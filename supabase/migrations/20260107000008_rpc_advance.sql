CREATE OR REPLACE FUNCTION public.advance_action_index(p_room_number TEXT, p_expected_index INTEGER, p_action_data JSONB DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ DECLARE v_current_index INTEGER; v_new_index INTEGER; v_actions JSONB; v_role TEXT; v_target INTEGER; BEGIN
SELECT current_actioner_index, actions INTO v_current_index, v_actions FROM public.rooms WHERE room_number = p_room_number FOR UPDATE;
IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'room_not_found'); END IF;
IF v_current_index != p_expected_index THEN RETURN jsonb_build_object('success', false, 'error', 'index_mismatch', 'current_index', v_current_index); END IF;
v_new_index := v_current_index + 1;
IF p_action_data IS NOT NULL THEN
  v_role := p_action_data->>'role';
  v_target := (p_action_data->>'target')::INTEGER;
  v_actions := jsonb_set(COALESCE(v_actions, '{}'::jsonb), ARRAY[v_role], to_jsonb(v_target));
  UPDATE public.rooms SET current_actioner_index = v_new_index, actions = v_actions WHERE room_number = p_room_number;
ELSE
  UPDATE public.rooms SET current_actioner_index = v_new_index WHERE room_number = p_room_number;
END IF;
RETURN jsonb_build_object('success', true, 'previous_index', v_current_index, 'new_index', v_new_index); END; $$;
