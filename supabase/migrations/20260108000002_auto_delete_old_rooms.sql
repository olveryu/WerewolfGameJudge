-- Enable pg_cron extension for scheduled tasks
-- Note: pg_cron is available on Supabase Pro plan and above
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to delete rooms older than 24 hours
CREATE OR REPLACE FUNCTION delete_old_rooms()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.rooms
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Schedule the cleanup job to run every hour
-- This ensures rooms are cleaned up reasonably quickly after 24h expiry
SELECT cron.schedule(
  'delete-old-rooms',           -- job name
  '0 * * * *',                  -- cron schedule: every hour at minute 0
  'SELECT delete_old_rooms()'   -- command to execute
);

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION delete_old_rooms() TO postgres;
