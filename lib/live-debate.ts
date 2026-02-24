import { supabase } from "./supabase";

export interface LiveMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  round: string | null;
  created_at: string;
}

/**
 * Send a message in a live debate.
 */
export async function sendDebateMessage(
  matchId: string,
  senderId: string,
  content: string,
  round?: string,
): Promise<LiveMessage | null> {
  console.log("[LIVE] sendDebateMessage:", { matchId, senderId, content, round });
  const { data, error } = await supabase
    .from("match_messages")
    .insert({
      match_id: matchId,
      sender_id: senderId,
      content,
      round: round || null,
    })
    .select()
    .single();

  if (error) { console.error("[LIVE] Send message INSERT error:", error); return null; }
  console.log("[LIVE] Message inserted successfully:", data);
  return data as LiveMessage;
}

/**
 * Subscribe to new messages in a match.
 * Returns an unsubscribe function.
 */
export function subscribeToMessages(
  matchId: string,
  onMessage: (msg: LiveMessage) => void,
): () => void {
  console.log("[LIVE] subscribeToMessages called, matchId:", matchId);
  const channel = supabase
    .channel(`debate-${matchId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "match_messages",
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => {
        console.log("[LIVE] Received message via Realtime:", payload.new);
        onMessage(payload.new as LiveMessage);
      },
    )
    .subscribe((status) => {
      console.log("[LIVE] Messages channel status:", status, "matchId:", matchId);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Fetch existing messages for a match (for reconnection).
 */
export async function fetchMessages(matchId: string): Promise<LiveMessage[]> {
  const { data } = await supabase
    .from("match_messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  return (data || []) as LiveMessage[];
}

/**
 * Update match status (e.g., finish it).
 */
export async function finishMatch(
  matchId: string,
  winnerId: string | null,
): Promise<void> {
  await supabase
    .from("matches")
    .update({
      status: "finished",
      finished_at: new Date().toISOString(),
      winner: winnerId,
    })
    .eq("id", matchId);
}

/**
 * Subscribe to match status changes (opponent disconnect, match end, etc).
 */
export function subscribeToMatch(
  matchId: string,
  onUpdate: (match: any) => void,
): () => void {
  console.log("[LIVE] subscribeToMatch called, matchId:", matchId);
  const channel = supabase
    .channel(`match-status-${matchId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "matches",
        filter: `id=eq.${matchId}`,
      },
      (payload) => {
        console.log("[LIVE] Match status update:", payload.new);
        onUpdate(payload.new);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Broadcast typing indicator via Supabase Realtime Broadcast (no DB).
 */
export function createTypingChannel(matchId: string) {
  const channel = supabase.channel(`typing-${matchId}`);

  return {
    subscribe: () => channel.subscribe(),
    sendTyping: (userId: string, isTyping: boolean) => {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, isTyping },
      });
    },
    onTyping: (callback: (userId: string, isTyping: boolean) => void) => {
      channel.on("broadcast", { event: "typing" }, (payload) => {
        callback(payload.payload.userId, payload.payload.isTyping);
      });
    },
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}
