import { supabase } from "./supabase";

export interface RoundVoteTotals {
  [playerId: string]: number;
}

/**
 * Cast a vote for a specific round.
 * One vote per user per round (enforced by unique constraint).
 */
export async function castRoundVote(
  matchId: string,
  voterId: string,
  round: number,
  votedFor: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("round_votes")
    .insert({ match_id: matchId, voter_id: voterId, round, voted_for: votedFor });

  if (error) {
    if (error.code === "23505") return { success: false, error: "Already voted this round" };
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Get vote totals for a specific round.
 */
export async function getRoundVotes(matchId: string, round: number): Promise<RoundVoteTotals> {
  const { data } = await supabase
    .from("round_votes")
    .select("voted_for")
    .eq("match_id", matchId)
    .eq("round", round);

  const totals: RoundVoteTotals = {};
  (data || []).forEach(v => {
    totals[v.voted_for] = (totals[v.voted_for] || 0) + 1;
  });
  return totals;
}

/**
 * Get all round votes for a match (for final tally).
 */
export async function getAllRoundVotes(matchId: string): Promise<Record<number, RoundVoteTotals>> {
  const { data } = await supabase
    .from("round_votes")
    .select("round, voted_for")
    .eq("match_id", matchId);

  const byRound: Record<number, RoundVoteTotals> = {};
  (data || []).forEach(v => {
    if (!byRound[v.round]) byRound[v.round] = {};
    byRound[v.round][v.voted_for] = (byRound[v.round][v.voted_for] || 0) + 1;
  });
  return byRound;
}

/**
 * Subscribe to real-time vote updates for a round.
 */
export function subscribeToRoundVotes(
  matchId: string,
  onVote: (round: number, votedFor: string) => void,
): () => void {
  const channel = supabase
    .channel(`round-votes-${matchId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "round_votes", filter: `match_id=eq.${matchId}` },
      (payload) => {
        const { round, voted_for } = payload.new as any;
        onVote(round, voted_for);
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
