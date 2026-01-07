CREATE OR REPLACE FUNCTION public.update_room_scalar(p_room_number TEXT, p_field TEXT, p_value JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ DECLARE v_allowed_fields TEXT[] := ARRAY['is_audio_playing', 'has_poison', 'has_antidote', 'current_actioner_index']; BEGIN
IF NOT (p_field = ANY(v_allowed_fields)) THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_field'); END IF;
PERFORM 1 FROM public.rooms WHERE room_number = p_room_number FOR UPDATE;
IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'room_not_found'); END IF;
EXECUTE format('UPDATE public.rooms SET %I = $1 WHERE room_number = $2', p_field) USING p_value, p_room_number;
RETURN jsonb_build_object('success', true); END; $$;
