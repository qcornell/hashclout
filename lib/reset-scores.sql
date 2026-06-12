-- ============================================================
-- HashClout — pre-launch score reset
-- Run ONCE in the Supabase SQL Editor before going public.
-- Wipes all scoring stats so everyone starts clean on the new
-- Clout system. Does NOT delete accounts.
-- ============================================================

UPDATE public.profiles SET
  xp_total            = 0,      -- Clout (stored in this column)
  wins                = 0,
  losses              = 0,
  win_streak          = 0,
  total_battles       = 0,
  elo_rating          = 1000,   -- hidden matchmaking rating, back to baseline
  streak_count        = 0,
  daily_debate_count  = 0,
  last_debate_date    = NULL;

-- OPTIONAL — also clear historical matches + votes for a totally fresh slate.
-- Uncomment the two lines below if you want match history wiped too.
-- DELETE FROM public.round_votes;
-- DELETE FROM public.matches;
