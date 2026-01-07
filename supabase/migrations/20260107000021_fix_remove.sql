-- Fix: remove_field_key has mutable search_path
CREATE OR REPLACE FUNCTION public.remove_field_key(
    p_room_number TEXT,
    p_field TEXT,
    p_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result JSONB;
BEGIN
    PERFORM 1 FROM public.rooms WHERE room_number = p_room_number FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
    END IF;
    
    EXECUTE format(
        'UPDATE public.rooms SET %I = COALESCE(%I, ''{}''::jsonb) - $1 WHERE room_number = $2',
        p_field, p_field
    ) USING p_key, p_room_number;
    
    SELECT 
        CASE p_field
            WHEN 'players' THEN players
            WHEN 'actions' THEN actions
            WHEN 'wolf_votes' THEN wolf_votes
            ELSE '{}'::JSONB
        END
    INTO v_result
    FROM public.rooms
    WHERE room_number = p_room_number;
    
    RETURN jsonb_build_object('success', true, 'updated', v_result);
END;
$$;
