CREATE OR REPLACE FUNCTION public.update_room_status(p_room_number TEXT, p_new_status INTEGER, p_expected_status INTEGER DEFAULT NULL, p_host_uid TEXT DEFAULT NULL, p_reset_fields BOOLEAN DEFAULT false)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ DECLARE v_current_status INTEGER; v_host_uid TEXT; v_players JSONB; v_key TEXT; v_value JSONB; v_updated_players JSONB := '{}'::jsonb; BEGIN
SELECT room_status, host_uid, players INTO v_current_status, v_host_uid, v_players FROM public.rooms WHERE room_number = p_room_number FOR UPDATE;
IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'room_not_found'); END IF;
IF p_host_uid IS NOT NULL AND v_host_uid != p_host_uid THEN RETURN jsonb_build_object('success', false, 'error', 'not_host'); END IF;
IF p_expected_status IS NOT NULL AND v_current_status != p_expected_status THEN RETURN jsonb_build_object('success', false, 'error', 'status_mismatch', 'current_status', v_current_status); END IF;
IF p_reset_fields THEN
  FOR v_key, v_value IN SELECT * FROM jsonb_each(COALESCE(v_players, '{}'::jsonb)) LOOP
    v_updated_players := jsonb_set(v_updated_players, ARRAY[v_key], jsonb_set(v_value, '{hasViewedRole}', 'false'::jsonb));
  END LOOP;
  UPDATE public.rooms SET room_status = p_new_status, current_actioner_index = 0, actions = '{}'::jsonb, wolf_votes = '{}'::jsonb, has_poison = true, has_antidote = true, is_audio_playing = false, players = v_updated_players WHERE room_number = p_room_number;
ELSE UPDATE public.rooms SET room_status = p_new_status WHERE room_number = p_room_number; END IF;
RETURN jsonb_build_object('success', true, 'new_status', p_new_status); END; $$;
