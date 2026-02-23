-- ============================================
-- HashClout: Match activity tracking for disconnect detection
-- Run this in Supabase SQL Editor
-- ============================================

-- Add last_activity columns to matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player_a_last_active timestamptz;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player_b_last_active timestamptz;
