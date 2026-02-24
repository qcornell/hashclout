-- ============================================
-- HashClout: Stale Queue Cleanup
-- Automatically expires queue entries older than 5 minutes.
-- Run this in Supabase SQL Editor.
-- ============================================

-- Function to clean stale queue entries
CREATE OR REPLACE FUNCTION public.cleanup_stale_queue()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE matchmaking_queue
  SET status = 'expired'
  WHERE status = 'waiting'
    AND created_at < now() - interval '5 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Supabase pg_cron extension (if enabled) — runs every 2 minutes
-- Uncomment these if you have pg_cron enabled:
-- SELECT cron.schedule('cleanup-stale-queue', '*/2 * * * *', 'SELECT public.cleanup_stale_queue()');

-- Alternative: you can call this manually or from an edge function:
-- SELECT public.cleanup_stale_queue();
