-- ============================================
-- HashClout: Atomic Matchmaking RPC
-- Prevents race conditions where two players
-- both find each other and create duplicate matches.
-- Run this in Supabase SQL Editor.
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_match(
  p_my_queue_id uuid,
  p_my_user_id uuid,
  p_opponent_queue_id uuid,
  p_opponent_user_id uuid,
  p_topic text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_id uuid;
  v_claimed boolean;
BEGIN
  -- Try to atomically claim the opponent's queue entry.
  -- Only succeeds if it's still 'waiting'.
  -- We set status + matched_with but NOT match_id yet (need to create match first).
  UPDATE matchmaking_queue
  SET status = 'claimed'
  WHERE id = p_opponent_queue_id
    AND status = 'waiting'
  RETURNING true INTO v_claimed;

  -- If someone else already claimed it, return null
  IF NOT v_claimed THEN
    RETURN NULL;
  END IF;

  -- Create the match
  INSERT INTO matches (mode, topic, player_a, player_b, status, round)
  VALUES ('debate', p_topic, p_my_user_id, p_opponent_user_id, 'live', 'opening')
  RETURNING id INTO v_match_id;

  -- Now update BOTH queue entries in one shot with all fields populated.
  -- This ensures the Realtime listener sees match_id + matched_with together.
  UPDATE matchmaking_queue
  SET status = 'matched', match_id = v_match_id, matched_with = p_opponent_user_id
  WHERE id = p_my_queue_id;

  UPDATE matchmaking_queue
  SET status = 'matched', match_id = v_match_id, matched_with = p_my_user_id
  WHERE id = p_opponent_queue_id;

  RETURN v_match_id;
END;
$$;
