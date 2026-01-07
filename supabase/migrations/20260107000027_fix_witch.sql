-- Fix: use_witch_potion has mutable search_path
CREATE OR REPLACE FUNCTION public.use_witch_potion(
    p_room_number TEXT,
    p_potion_type TEXT,
    p_expected_value BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_value BOOLEAN;
BEGIN
    IF p_potion_type NOT IN ('poison', 'antidote') THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_potion_type');
    END IF;
    
    IF p_potion_type = 'poison' THEN
        SELECT has_poison INTO v_current_value
        FROM public.rooms WHERE room_number = p_room_number FOR UPDATE;
    ELSE
        SELECT has_antidote INTO v_current_value
        FROM public.rooms WHERE room_number = p_room_number FOR UPDATE;
    END IF;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
    END IF;
    
    IF v_current_value != p_expected_value THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'value_mismatch',
            'current_value', v_current_value
        );
    END IF;
    
    IF p_potion_type = 'poison' THEN
        UPDATE public.rooms SET has_poison = false WHERE room_number = p_room_number;
    ELSE
        UPDATE public.rooms SET has_antidote = false WHERE room_number = p_room_number;
    END IF;
    
    RETURN jsonb_build_object('success', true);
END;
$$;
