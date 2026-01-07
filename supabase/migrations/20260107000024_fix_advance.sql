-- Fix: advance_action_index has mutable search_path
CREATE OR REPLACE FUNCTION public.advance_action_index(
    p_room_number TEXT,
    p_expected_index INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_index INTEGER;
    v_new_index INTEGER;
BEGIN
    SELECT current_actioner_index
    INTO v_current_index
    FROM public.rooms
    WHERE room_number = p_room_number
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
    END IF;
    
    IF v_current_index != p_expected_index THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'index_mismatch',
            'current_index', v_current_index
        );
    END IF;
    
    v_new_index := v_current_index + 1;
    
    UPDATE public.rooms
    SET current_actioner_index = v_new_index
    WHERE room_number = p_room_number;
    
    RETURN jsonb_build_object('success', true, 'new_index', v_new_index);
END;
$$;
