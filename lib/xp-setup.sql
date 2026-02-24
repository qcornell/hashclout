-- ============================================
-- HashClout: XP + AI Pipeline Database Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- Add XP and daily tracking fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp_total bigint NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_debate_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_debate_date timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS strike_count integer NOT NULL DEFAULT 0;

-- Add AI pipeline fields to matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS transcript_text text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS moderation_flags jsonb;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS ai_scores jsonb;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS ai_quality_bonus integer NOT NULL DEFAULT 0;

-- Add vote tracking fields to matches (for winner determination)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS vote_player_a integer NOT NULL DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS vote_player_b integer NOT NULL DEFAULT 0;

-- Add XP breakdown to matches (for results display)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS xp_player_a integer NOT NULL DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS xp_player_b integer NOT NULL DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS xp_breakdown_a jsonb;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS xp_breakdown_b jsonb;

-- Add AI feedback fields to matches (for win/loss encouragement)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS ai_feedback_a text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS ai_feedback_b text;

-- Index for daily count lookups
CREATE INDEX IF NOT EXISTS idx_profiles_last_debate ON public.profiles(last_debate_date);
