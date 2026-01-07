CREATE OR REPLACE FUNCTION public.atomic_field_update(p_room_number TEXT, p_field TEXT, p_key TEXT, p_value JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ DECLARE v_result JSONB; v_current JSONB; v_existing JSONB; v_existing_uid TEXT; BEGIN
SELECT CASE p_field WHEN 'players' THEN players WHEN 'actions' THEN actions WHEN 'wolf_votes' THEN wolf_votes ELSE '{}'::JSONB END INTO v_current FROM public.rooms WHERE room_number = p_room_number FOR UPDATE;
IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'room_not_found'); END IF;
IF p_field = 'players' AND v_current ? p_key THEN 
  v_existing := v_current #> ARRAY[p_key];
  v_existing_uid := v_existing->>'uid';
  IF v_existing_uid IS NOT NULL AND v_existing_uid IS DISTINCT FROM p_value->>'uid' THEN 
    RETURN jsonb_build_object('success', false, 'error', 'seat_taken'); 
  END IF; 
END IF;
IF p_field = 'wolf_votes' AND v_current ? p_key THEN
  RETURN jsonb_build_object('success', true, 'already_voted', true);
END IF;
EXECUTE format('UPDATE public.rooms SET %I = jsonb_set(COALESCE(%I, ''{}''::jsonb), $1, $2) WHERE room_number = $3', p_field, p_field) USING ARRAY[p_key], p_value, p_room_number;
SELECT CASE p_field WHEN 'players' THEN players WHEN 'actions' THEN actions WHEN 'wolf_votes' THEN wolf_votes ELSE '{}'::JSONB END INTO v_result FROM public.rooms WHERE room_number = p_room_number;
RETURN jsonb_build_object('success', true, 'updated', v_result); END; $$;
