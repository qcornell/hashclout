-- ============================================
-- HashClout: LiveKit Video Debate Support
-- Run this in Supabase SQL Editor
-- ============================================

-- Add video-related columns to matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'text';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS livekit_room text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS hls_url text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS egress_id text;

-- Per-round voting table
CREATE TABLE IF NOT EXISTS public.round_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  round integer NOT NULL,
  voted_for uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, voter_id, round)
);

ALTER TABLE public.round_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read votes
DROP POLICY IF EXISTS "Round votes are viewable by everyone" ON public.round_votes;
CREATE POLICY "Round votes are viewable by everyone"
  ON public.round_votes FOR SELECT USING (true);

-- Authenticated users can vote (but not debaters — enforced client-side)
DROP POLICY IF EXISTS "Users can vote" ON public.round_votes;
CREATE POLICY "Users can vote"
  ON public.round_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- Enable realtime for round_votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.round_votes;

-- Index for fast vote counting
CREATE INDEX IF NOT EXISTS idx_round_votes_match ON public.round_votes(match_id, round);
