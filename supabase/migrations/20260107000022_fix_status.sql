-- Fix: update_room_status has mutable search_path
CREATE OR REPLACE FUNCTION public.update_room_status(
    p_room_number TEXT,
    p_new_status INTEGER,
    p_expected_status INTEGER,
    p_host_uid TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_status INTEGER;
    v_host_uid TEXT;
BEGIN
    SELECT room_status, host_uid
    INTO v_current_status, v_host_uid
    FROM public.rooms
    WHERE room_number = p_room_number
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
    END IF;
    
    IF p_host_uid IS NOT NULL AND v_host_uid != p_host_uid THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_host');
    END IF;
    
    IF v_current_status != p_expected_status THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'status_mismatch',
            'current_status', v_current_status
        );
    END IF;
    
    UPDATE public.rooms
    SET room_status = p_new_status
    WHERE room_number = p_room_number;
    
    RETURN jsonb_build_object('success', true, 'new_status', p_new_status);
END;
$$;
