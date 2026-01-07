-- Security fixes for Supabase advisor issues
-- Fix: Function has a role mutable search_path

-- 1. Fix update_updated_at_column trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 2. Fix atomic_field_update
CREATE OR REPLACE FUNCTION public.atomic_field_update(
    p_room_number TEXT,
    p_field TEXT,
    p_key TEXT,
    p_value JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result JSONB;
    v_current JSONB;
BEGIN
    -- Use FOR UPDATE to lock the row
    SELECT 
        CASE p_field
            WHEN 'players' THEN players
            WHEN 'actions' THEN actions
            WHEN 'wolf_votes' THEN wolf_votes
            ELSE '{}'::JSONB
        END
    INTO v_current
    FROM public.rooms
    WHERE room_number = p_room_number
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
    END IF;
    
    -- Check if key already exists with a different value (for seat taking)
    IF p_field = 'players' AND v_current ? p_key THEN
        -- Key exists, check if it's the same user trying to re-take
        IF v_current->p_key->>'uid' IS DISTINCT FROM p_value->>'uid' THEN
            RETURN jsonb_build_object('success', false, 'error', 'seat_taken');
        END IF;
    END IF;
    
    -- Perform atomic update using jsonb_set
    EXECUTE format(
        'UPDATE public.rooms SET %I = jsonb_set(COALESCE(%I, ''{}''::jsonb), $1, $2) WHERE room_number = $3',
        p_field, p_field
    ) USING ARRAY[p_key], p_value, p_room_number;
    
    -- Return success with updated field
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

-- 3. Fix remove_field_key
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
    -- Lock the row
    PERFORM 1 FROM public.rooms WHERE room_number = p_room_number FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
    END IF;
    
    -- Remove the key from the JSONB field
    EXECUTE format(
        'UPDATE public.rooms SET %I = COALESCE(%I, ''{}''::jsonb) - $1 WHERE room_number = $2',
        p_field, p_field
    ) USING p_key, p_room_number;
    
    -- Return success
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

-- 4. Fix update_room_status
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
    -- Lock and get current state
    SELECT room_status, host_uid
    INTO v_current_status, v_host_uid
    FROM public.rooms
    WHERE room_number = p_room_number
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
    END IF;
    
    -- Verify host if provided
    IF p_host_uid IS NOT NULL AND v_host_uid != p_host_uid THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_host');
    END IF;
    
    -- Verify expected status
    IF v_current_status != p_expected_status THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'status_mismatch',
            'current_status', v_current_status
        );
    END IF;
    
    -- Update status
    UPDATE public.rooms
    SET room_status = p_new_status
    WHERE room_number = p_room_number;
    
    RETURN jsonb_build_object('success', true, 'new_status', p_new_status);
END;
$$;

-- 5. Fix update_room_scalar
CREATE OR REPLACE FUNCTION public.update_room_scalar(
    p_room_number TEXT,
    p_field TEXT,
    p_value JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_allowed_fields TEXT[] := ARRAY[
        'is_audio_playing', 
        'has_poison', 
        'has_antidote',
        'current_actioner_index'
    ];
BEGIN
    -- Validate field name
    IF NOT (p_field = ANY(v_allowed_fields)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_field');
    END IF;
    
    -- Lock the row
    PERFORM 1 FROM public.rooms WHERE room_number = p_room_number FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
    END IF;
    
    -- Update the field dynamically
    EXECUTE format(
        'UPDATE public.rooms SET %I = $1 WHERE room_number = $2',
        p_field
    ) USING p_value, p_room_number;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Fix advance_action_index
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
    -- Lock and get current index
    SELECT current_actioner_index
    INTO v_current_index
    FROM public.rooms
    WHERE room_number = p_room_number
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
    END IF;
    
    -- Verify expected index (optimistic locking)
    IF v_current_index != p_expected_index THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'index_mismatch',
            'current_index', v_current_index
        );
    END IF;
    
    -- Increment index
    v_new_index := v_current_index + 1;
    
    UPDATE public.rooms
    SET current_actioner_index = v_new_index
    WHERE room_number = p_room_number;
    
    RETURN jsonb_build_object('success', true, 'new_index', v_new_index);
END;
$$;

-- 7. Fix batch_update_players
CREATE OR REPLACE FUNCTION public.batch_update_players(
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
    -- Lock and verify
    SELECT host_uid, players
    INTO v_host_uid, v_current_players
    FROM public.rooms
    WHERE room_number = p_room_number
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
    END IF;
    
    -- Verify host if provided
    IF p_host_uid IS NOT NULL AND v_host_uid != p_host_uid THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_host');
    END IF;
    
    -- Merge players: iterate through p_players and set each key
    FOR v_key, v_value IN SELECT * FROM jsonb_each(p_players)
    LOOP
        v_current_players := jsonb_set(
            COALESCE(v_current_players, '{}'::jsonb),
            ARRAY[v_key],
            v_value
        );
    END LOOP;
    
    -- Update the room
    UPDATE public.rooms
    SET players = v_current_players
    WHERE room_number = p_room_number;
    
    RETURN jsonb_build_object('success', true, 'players', v_current_players);
END;
$$;

-- 8. Fix update_roles_array
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
    -- Lock and verify
    SELECT host_uid, room_status
    INTO v_host_uid, v_room_status
    FROM public.rooms
    WHERE room_number = p_room_number
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
    END IF;
    
    -- Verify host
    IF v_host_uid != p_host_uid THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_host');
    END IF;
    
    -- Only allow changes before game starts (status 0, 1, or 2)
    IF v_room_status > 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'game_already_started');
    END IF;
    
    -- Update template
    UPDATE public.rooms
    SET 
        template_roles = p_roles,
        template_action_order = p_action_order,
        template_number_of_players = array_length(p_roles, 1)
    WHERE room_number = p_room_number;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 9. Fix use_witch_potion
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
    -- Validate potion type
    IF p_potion_type NOT IN ('poison', 'antidote') THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_potion_type');
    END IF;
    
    -- Lock and get current value
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
    
    -- Verify expected value (optimistic locking)
    IF v_current_value != p_expected_value THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'value_mismatch',
            'current_value', v_current_value
        );
    END IF;
    
    -- Use potion (set to false)
    IF p_potion_type = 'poison' THEN
        UPDATE public.rooms SET has_poison = false WHERE room_number = p_room_number;
    ELSE
        UPDATE public.rooms SET has_antidote = false WHERE room_number = p_room_number;
    END IF;
    
    RETURN jsonb_build_object('success', true);
END;
$$;
