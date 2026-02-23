-- ============================================
-- HashClout: Matchmaking Queue
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id),
  topic_title text,
  format text NOT NULL DEFAULT 'text',
  side text NOT NULL DEFAULT 'yes',
  elo_rating integer NOT NULL DEFAULT 1000,
  status text NOT NULL DEFAULT 'waiting',  -- waiting, matched, cancelled, expired
  match_id uuid REFERENCES public.matches(id),
  matched_with uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Everyone can read queue (needed for matchmaking checks)
DROP POLICY IF EXISTS "Queue is readable by authenticated" ON public.matchmaking_queue;
CREATE POLICY "Queue is readable by authenticated"
  ON public.matchmaking_queue FOR SELECT
  USING (true);

-- Users can insert their own queue entry
DROP POLICY IF EXISTS "Users can join queue" ON public.matchmaking_queue;
CREATE POLICY "Users can join queue"
  ON public.matchmaking_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own queue entry (cancel)
DROP POLICY IF EXISTS "Users can update own queue entry" ON public.matchmaking_queue;
CREATE POLICY "Users can update own queue entry"
  ON public.matchmaking_queue FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = matched_with);

-- Also allow the matcher to update opponent's entry
DROP POLICY IF EXISTS "Matched users can update entries" ON public.matchmaking_queue;
CREATE POLICY "Matched users can update entries"
  ON public.matchmaking_queue FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Enable realtime on queue table
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;

-- Enable realtime on match_messages for live debate
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_messages;

-- Index for fast matchmaking lookups
CREATE INDEX IF NOT EXISTS idx_queue_waiting 
  ON public.matchmaking_queue(status, topic_id, format) 
  WHERE status = 'waiting';

-- Clean up stale queue entries (older than 5 min)
-- Run this periodically or via cron
-- DELETE FROM matchmaking_queue WHERE status = 'waiting' AND created_at < now() - interval '5 minutes';
