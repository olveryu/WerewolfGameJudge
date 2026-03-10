-- Create cleanup_anonymous_users(p_limit) for batched stale anonymous-user deletion.
-- This keeps daily cleanup predictable when anonymous user volume grows.

CREATE OR REPLACE FUNCTION public.cleanup_anonymous_users(p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  deleted_count integer;
  batch_limit integer;
BEGIN
  batch_limit := GREATEST(COALESCE(p_limit, 1000), 1);

  WITH targets AS (
    SELECT id
    FROM auth.users
    WHERE is_anonymous = true
      AND last_sign_in_at < now() - interval '14 days'
    ORDER BY last_sign_in_at ASC
    LIMIT batch_limit
  ),
  deleted AS (
    DELETE FROM auth.users u
    USING targets t
    WHERE u.id = t.id
    RETURNING u.id
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_anonymous_users(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_anonymous_users(integer) TO service_role;
