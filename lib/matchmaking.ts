import { supabase } from "./supabase";
import type { Topic } from "./topics";

export interface QueueEntry {
  id: string;
  user_id: string;
  topic_id: string | null;
  topic_title: string | null;
  format: string;
  side: string;
  elo_rating: number;
  status: string;
  match_id: string | null;
  matched_with: string | null;
  created_at: string;
}

export interface MatchResult {
  matchId: string;
  opponentId: string;
  opponentSide: string;
  opponentElo: number;
  opponentUsername: string;
  opponentDisplayName: string;
}

const ELO_RANGE = 300; // Match within 300 ELO initially

/**
 * Join the matchmaking queue.
 * Returns the queue entry ID to listen for updates.
 */
export async function joinQueue(
  userId: string,
  topic: Topic,
  format: "text" | "video",
  side: "yes" | "no",
  eloRating: number,
): Promise<{ queueId: string | null; error: string | null }> {
  // Cancel any existing queue entries first
  await supabase
    .from("matchmaking_queue")
    .update({ status: "cancelled" })
    .eq("user_id", userId)
    .eq("status", "waiting");

  // Insert into queue
  const { data, error } = await supabase
    .from("matchmaking_queue")
    .insert({
      user_id: userId,
      topic_id: topic.id,
      topic_title: topic.title,
      format,
      side,
      elo_rating: eloRating,
      status: "waiting",
    })
    .select()
    .single();

  if (error) return { queueId: null, error: error.message };
  return { queueId: data.id, error: null };
}

/**
 * Try to find a match for the given queue entry.
 * Looks for another waiting player on the SAME topic with OPPOSITE side.
 * Returns match details or null.
 */
export async function findMatch(
  queueId: string,
  userId: string,
  topicId: string,
  format: string,
  side: string,
  eloRating: number,
): Promise<MatchResult | null> {
  const oppositeSide = side === "yes" ? "no" : "yes";

  // Find waiting opponents on same topic, opposite side, within ELO range
  const { data: candidates } = await supabase
    .from("matchmaking_queue")
    .select("*")
    .eq("status", "waiting")
    .eq("topic_id", topicId)
    .eq("format", format)
    .eq("side", oppositeSide)
    .neq("user_id", userId)
    .gte("elo_rating", eloRating - ELO_RANGE)
    .lte("elo_rating", eloRating + ELO_RANGE)
    .order("created_at", { ascending: true })
    .limit(1);

  if (!candidates || candidates.length === 0) {
    // Widen search: any side, same topic
    const { data: wider } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .eq("status", "waiting")
      .eq("topic_id", topicId)
      .eq("format", format)
      .neq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!wider || wider.length === 0) return null;
    return await createMatchFromQueue(queueId, userId, wider[0]);
  }

  return await createMatchFromQueue(queueId, userId, candidates[0]);
}

/**
 * Create a match from two queue entries.
 */
async function createMatchFromQueue(
  myQueueId: string,
  myUserId: string,
  opponent: QueueEntry,
): Promise<MatchResult | null> {
  // Create the match
  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .insert({
      mode: "debate",
      topic: opponent.topic_title,
      player_a: myUserId,
      player_b: opponent.user_id,
      status: "live",
      round: "opening",
    })
    .select()
    .single();

  if (matchErr || !match) return null;

  // Update both queue entries
  await supabase
    .from("matchmaking_queue")
    .update({ status: "matched", match_id: match.id, matched_with: opponent.user_id })
    .eq("id", myQueueId);

  await supabase
    .from("matchmaking_queue")
    .update({ status: "matched", match_id: match.id, matched_with: myUserId })
    .eq("id", opponent.id);

  // Fetch opponent profile
  const { data: oppProfile } = await supabase
    .from("profiles")
    .select("username, display_name, elo_rating")
    .eq("id", opponent.user_id)
    .single();

  return {
    matchId: match.id,
    opponentId: opponent.user_id,
    opponentSide: opponent.side,
    opponentElo: oppProfile?.elo_rating || 1000,
    opponentUsername: oppProfile?.username || "Opponent",
    opponentDisplayName: oppProfile?.display_name || "Opponent",
  };
}

/**
 * Subscribe to queue entry changes (for real-time match notifications).
 * When someone else matches with you, your queue entry gets updated to "matched".
 */
export function subscribeToQueue(
  queueId: string,
  onMatched: (entry: QueueEntry) => void,
): () => void {
  const channel = supabase
    .channel(`queue-${queueId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "matchmaking_queue",
        filter: `id=eq.${queueId}`,
      },
      (payload) => {
        const entry = payload.new as QueueEntry;
        if (entry.status === "matched") {
          onMatched(entry);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Cancel a queue entry.
 */
export async function leaveQueue(queueId: string): Promise<void> {
  await supabase
    .from("matchmaking_queue")
    .update({ status: "cancelled" })
    .eq("id", queueId);
}
