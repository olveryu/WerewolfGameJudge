-- RPC function to clean up stale anonymous users.
-- Called daily by GitHub Actions (cleanup-rooms.yml).
-- Deletes anonymous users who have not signed in for 14 days.
-- Returns the number of deleted users for logging.

CREATE OR REPLACE FUNCTION public.cleanup_anonymous_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM auth.users
    WHERE is_anonymous = true
      AND last_sign_in_at < now() - interval '14 days'
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

-- Only service_role can call this function (via REST API with service_role_key)
REVOKE ALL ON FUNCTION public.cleanup_anonymous_users() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_anonymous_users() TO service_role;
