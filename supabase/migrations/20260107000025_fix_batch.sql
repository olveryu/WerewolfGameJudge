-- Fix: batch_update_players has mutable search_path
-- First drop and recreate to change parameter name
DROP FUNCTION IF EXISTS public.batch_update_players(TEXT, JSONB, TEXT);

CREATE FUNCTION public.batch_update_players(
    p_room_number TEXT,
    p_players JSONB,
    p_host_uid TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_host_uid TEXT;
    v_key TEXT;
    v_value JSONB;
    v_current_players JSONB;
BEGIN
    SELECT host_uid, players
    INTO v_host_uid, v_current_players
    FROM public.rooms
    WHERE room_number = p_room_number
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
    END IF;
    
    IF p_host_uid IS NOT NULL AND v_host_uid != p_host_uid THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_host');
    END IF;
    
    FOR v_key, v_value IN SELECT * FROM jsonb_each(p_players)
    LOOP
        v_current_players := jsonb_set(
            COALESCE(v_current_players, '{}'::jsonb),
            ARRAY[v_key],
            v_value
        );
    END LOOP;
    
    UPDATE public.rooms
    SET players = v_current_players
    WHERE room_number = p_room_number;
    
    RETURN jsonb_build_object('success', true, 'players', v_current_players);
END;
$$;
