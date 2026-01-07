-- Atomic witch action RPC
-- Handles save (antidote), poison, or skip in a single transaction
-- Prevents race conditions when network timeout occurs

CREATE OR REPLACE FUNCTION public.witch_action(
  p_room_number TEXT,
  p_expected_index INTEGER,
  p_action_type TEXT,  -- 'save', 'poison', or 'skip'
  p_target INTEGER DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ 
DECLARE 
  v_current_index INTEGER; 
  v_new_index INTEGER; 
  v_actions JSONB;
  v_has_antidote BOOLEAN;
  v_has_poison BOOLEAN;
BEGIN
  -- Lock the row for update
  SELECT current_actioner_index, actions, has_antidote, has_poison 
  INTO v_current_index, v_actions, v_has_antidote, v_has_poison 
  FROM public.rooms 
  WHERE room_number = p_room_number 
  FOR UPDATE;
  
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'room_not_found'); 
  END IF;
  
  -- Check if action already advanced (idempotency for retries)
  IF v_current_index > p_expected_index THEN 
    RETURN jsonb_build_object('success', true, 'already_advanced', true, 'current_index', v_current_index); 
  END IF;
  
  -- Check index mismatch (shouldn't happen if already_advanced check passes)
  IF v_current_index != p_expected_index THEN 
    RETURN jsonb_build_object('success', false, 'error', 'index_mismatch', 'current_index', v_current_index); 
  END IF;
  
  v_new_index := v_current_index + 1;
  v_actions := COALESCE(v_actions, '{}'::jsonb);
  
  IF p_action_type = 'save' THEN
    -- Use antidote
    v_actions := jsonb_set(v_actions, ARRAY['witch'], to_jsonb(p_target));
    UPDATE public.rooms 
    SET current_actioner_index = v_new_index, 
        actions = v_actions,
        has_antidote = false
    WHERE room_number = p_room_number;
    
  ELSIF p_action_type = 'poison' THEN
    -- Use poison
    v_actions := jsonb_set(v_actions, ARRAY['witch'], to_jsonb(p_target));
    UPDATE public.rooms 
    SET current_actioner_index = v_new_index, 
        actions = v_actions,
        has_poison = false
    WHERE room_number = p_room_number;
    
  ELSE
    -- Skip (no potion used)
    UPDATE public.rooms 
    SET current_actioner_index = v_new_index
    WHERE room_number = p_room_number;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'previous_index', v_current_index, 'new_index', v_new_index); 
END; $$;
