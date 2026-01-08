-- Fix update_room_scalar to properly cast JSONB to correct types
CREATE OR REPLACE FUNCTION public.update_room_scalar(p_room_number TEXT, p_field TEXT, p_value JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ 
DECLARE 
  v_allowed_fields TEXT[] := ARRAY['is_audio_playing', 'current_actioner_index']; 
BEGIN
  IF NOT (p_field = ANY(v_allowed_fields)) THEN 
    RETURN jsonb_build_object('success', false, 'error', 'invalid_field'); 
  END IF;
  
  PERFORM 1 FROM public.rooms WHERE room_number = p_room_number FOR UPDATE;
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'room_not_found'); 
  END IF;
  
  -- Handle different field types by casting JSONB to proper type
  IF p_field = 'is_audio_playing' THEN
    UPDATE public.rooms SET is_audio_playing = (p_value)::boolean WHERE room_number = p_room_number;
  ELSIF p_field = 'current_actioner_index' THEN
    UPDATE public.rooms SET current_actioner_index = (p_value)::integer WHERE room_number = p_room_number;
  END IF;
  
  RETURN jsonb_build_object('success', true); 
END; 
$$;
