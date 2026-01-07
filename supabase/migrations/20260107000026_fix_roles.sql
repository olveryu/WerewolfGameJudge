-- Fix: update_roles_array has mutable search_path
CREATE OR REPLACE FUNCTION public.update_roles_array(
    p_room_number TEXT,
    p_roles TEXT[],
    p_action_order TEXT[],
    p_host_uid TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_host_uid TEXT;
    v_room_status INTEGER;
BEGIN
    SELECT host_uid, room_status
    INTO v_host_uid, v_room_status
    FROM public.rooms
    WHERE room_number = p_room_number
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
    END IF;
    
    IF v_host_uid != p_host_uid THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_host');
    END IF;
    
    IF v_room_status > 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'game_already_started');
    END IF;
    
    UPDATE public.rooms
    SET 
        template_roles = p_roles,
        template_action_order = p_action_order,
        template_number_of_players = array_length(p_roles, 1)
    WHERE room_number = p_room_number;
    
    RETURN jsonb_build_object('success', true);
END;
$$;
