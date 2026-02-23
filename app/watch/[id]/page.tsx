"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Eye, ArrowLeft, Flame, Clock, Trophy, ThumbsUp } from "lucide-react";
import Link from "next/link";
import HlsSpectator from "@/components/HlsSpectator";
import { castRoundVote, getRoundVotes, subscribeToRoundVotes, type RoundVoteTotals } from "@/lib/round-voting";

interface LiveMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  round: string | null;
  created_at: string;
}

interface MatchData {
  id: string;
  mode: string;
  topic: string;
  status: string;
  round: string;
  created_at: string;
  finished_at: string | null;
  winner: string | null;
  player_a: { id: string; username: string; display_name: string; elo_rating: number } | null;
  player_b: { id: string; username: string; display_name: string; elo_rating: number } | null;
}

const REACTION_EMOJIS = ["🔥", "💀", "😂", "👑", "💯", "🤯"];

function timeSince(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

export default function WatchMatch() {
  const { id: matchId } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();

  const [match, setMatch] = useState<MatchData | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [viewerCount, setViewerCount] = useState(1);
  const [reactions, setReactions] = useState<{ id: number; emoji: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundVotes, setRoundVotes] = useState<RoundVoteTotals>({});
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voteMsg, setVoteMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Fetch match + messages
  useEffect(() => {
    fetchMatch();
    fetchMessages();

    // Real-time messages
    const msgCh = supabase.channel(`spectate-msg-${matchId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "match_messages",
        filter: `match_id=eq.${matchId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as LiveMessage]);
      })
      .subscribe();

    // Real-time match status
    const matchCh = supabase.channel(`spectate-match-${matchId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "matches",
        filter: `id=eq.${matchId}`,
      }, () => fetchMatch())
      .subscribe();

    // Viewer count simulation (would be presence in production)
    const vc = setInterval(() => setViewerCount(p => Math.max(1, p + Math.floor(Math.random() * 4) - 1)), 3000);

    // Subscribe to round votes
    const unsubVotes = subscribeToRoundVotes(matchId, (round, votedFor) => {
      if (round === currentRound) {
        setRoundVotes(prev => ({ ...prev, [votedFor]: (prev[votedFor] || 0) + 1 }));
      }
    });

    // Load existing votes for current round
    getRoundVotes(matchId, currentRound).then(setRoundVotes);

    return () => {
      supabase.removeChannel(msgCh);
      supabase.removeChannel(matchCh);
      clearInterval(vc);
      unsubVotes();
    };
  }, [matchId, currentRound]);

  async function fetchMatch() {
    const { data } = await supabase.from("matches")
      .select(`
        id, mode, topic, status, round, created_at, finished_at, winner,
        player_a:profiles!matches_player_a_fkey(id, username, display_name, elo_rating),
        player_b:profiles!matches_player_b_fkey(id, username, display_name, elo_rating)
      `)
      .eq("id", matchId).single();
    if (data) setMatch(data as any);
    setLoading(false);
  }

  async function fetchMessages() {
    const { data } = await supabase.from("match_messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as LiveMessage[]);
  }

  const addReaction = (emoji: string) => {
    const id = Date.now() + Math.random();
    setReactions(prev => [...prev.slice(-20), { id, emoji }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3000);
  };

  if (loading) {
    return (
      <div style={s.page}>
        <div style={{ textAlign: "center", paddingTop: 120 }}>
          <Flame size={32} color="#ff7a45" style={{ animation: "mmq-spin .6s linear infinite" }} />
        </div>
        <style>{`@keyframes mmq-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!match) {
    return (
      <div style={s.page}>
        <div style={{ textAlign: "center", paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤷</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,.45)" }}>Match not found</div>
          <Link href="/watch" style={{ color: "#ff7a45", textDecoration: "none", fontSize: 13, fontWeight: 700, marginTop: 12, display: "inline-block" }}>
            ← Back to Live Debates
          </Link>
        </div>
      </div>
    );
  }

  const pA = match.player_a;
  const pB = match.player_b;
  const isFinished = match.status === "finished";
  const isVideoMatch = (match as any).format === "video";
  const hlsUrl = (match as any).hls_url;
  const winnerName = match.winner === pA?.id ? pA?.display_name : match.winner === pB?.id ? pB?.display_name : null;

  const isDebater = user && (user.id === pA?.id || user.id === pB?.id);
  const totalRoundVotes = Object.values(roundVotes).reduce((a, b) => a + b, 0);
  const aRoundVotes = pA?.id ? roundVotes[pA.id] || 0 : 0;
  const bRoundVotes = pB?.id ? roundVotes[pB.id] || 0 : 0;

  const handleRoundVote = async (playerId: string) => {
    if (!user || isDebater || myVote) return;
    const { success, error } = await castRoundVote(matchId, user.id, currentRound, playerId);
    if (success) {
      setMyVote(playerId);
      setVoteMsg("Vote recorded!");
      setTimeout(() => setVoteMsg(null), 2000);
    } else {
      setVoteMsg(error || "Vote failed");
      setTimeout(() => setVoteMsg(null), 2000);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Back + header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Link href="/watch" style={s.backBtn}><ArrowLeft size={16} /></Link>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {!isFinished ? (
                <span style={s.liveBadge}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: "#ff4d3d" }} /> LIVE
                </span>
              ) : (
                <span style={{ ...s.liveBadge, background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.35)" }}>🏁 ENDED</span>
              )}
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.20)", display: "flex", alignItems: "center", gap: 4 }}>
                <Eye size={11} /> {viewerCount} watching
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.20)", display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={11} /> {timeSince(match.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Topic */}
        <div style={s.topicCard}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,.90)", lineHeight: 1.3, marginBottom: 10 }}>
            {match.topic}
          </div>
          <div style={s.vsRow}>
            <div style={{ flex: 1, textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#ff7a45" }}>{pA?.display_name || "Player 1"}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.25)" }}>{pA?.elo_rating} ELO</div>
            </div>
            <div style={s.vsBadge}>VS</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#a855f7" }}>{pB?.display_name || "Player 2"}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.25)" }}>{pB?.elo_rating || "?"} ELO</div>
            </div>
          </div>
        </div>

        {/* HLS Video Player (for video matches) */}
        {isVideoMatch && hlsUrl && !isFinished && (
          <div style={{ marginBottom: 12 }}>
            <HlsSpectator hlsUrl={hlsUrl} matchId={matchId} />
          </div>
        )}

        {/* Winner banner */}
        {isFinished && winnerName && (
          <div style={s.winnerBanner}>
            <Trophy size={16} color="#fbbf24" />
            <span style={{ fontWeight: 800, color: "#fbbf24" }}>{winnerName}</span>
            <span style={{ color: "rgba(255,255,255,.40)" }}>won this debate</span>
          </div>
        )}

        {/* Per-Round Voting (spectators only, not debaters) */}
        {!isFinished && !isDebater && user && (
          <div style={s.voteCard}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,.35)", letterSpacing: ".06em" }}>
                ROUND {currentRound} VOTE
              </span>
              {totalRoundVotes > 0 && (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,.20)" }}>{totalRoundVotes} votes</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {[{ player: pA, color: "#ff7a45", votes: aRoundVotes }, { player: pB, color: "#a855f7", votes: bRoundVotes }].map(({ player, color, votes }) => {
                if (!player) return null;
                const voted = myVote === player.id;
                return (
                  <button key={player.id} onClick={() => handleRoundVote(player.id)} disabled={!!myVote} style={{
                    flex: 1, padding: "14px 12px", borderRadius: 12, textAlign: "center" as const,
                    border: voted ? `1px solid ${color}44` : "1px solid rgba(255,255,255,.06)",
                    background: voted ? `${color}11` : "rgba(255,255,255,.02)",
                    cursor: myVote ? "default" : "pointer", fontFamily: "inherit",
                    transition: "all .15s", opacity: myVote && !voted ? 0.4 : 1,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color, marginBottom: 4 }}>{player.display_name}</div>
                    {totalRoundVotes > 0 && (
                      <div style={{ fontSize: 20, fontWeight: 900, color: voted ? color : "rgba(255,255,255,.60)" }}>{votes}</div>
                    )}
                    {voted && <div style={{ fontSize: 10, color, marginTop: 4 }}>✓ Your vote</div>}
                  </button>
                );
              })}
            </div>
            {voteMsg && <div style={{ textAlign: "center", fontSize: 11, color: "#22c55e", fontWeight: 600, marginTop: 8 }}>{voteMsg}</div>}
          </div>
        )}

        {!user && !isFinished && (
          <div style={{ ...s.voteCard, textAlign: "center" as const }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,.35)" }}>Sign in to vote on this debate</span>
          </div>
        )}

        {/* Chat stream */}
        <div style={s.chatCard}>
          <div style={s.chatHeader}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.30)", letterSpacing: ".06em" }}>LIVE CHAT</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.15)" }}>{messages.length} messages</span>
          </div>
          <div style={s.chatArea}>
            {messages.length === 0 ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,.15)", padding: "40px 0", fontSize: 13 }}>
                Waiting for arguments...
              </div>
            ) : messages.map(msg => {
              const isA = msg.sender_id === pA?.id;
              const senderName = isA ? pA?.display_name : pB?.display_name;
              const senderColor = isA ? "#ff7a45" : "#a855f7";
              return (
                <div key={msg.id} style={{
                  padding: "10px 14px", borderRadius: 12, marginBottom: 6,
                  background: isA ? "rgba(255,122,69,.06)" : "rgba(168,85,247,.06)",
                  border: `1px solid ${isA ? "rgba(255,122,69,.10)" : "rgba(168,85,247,.10)"}`,
                  animation: "msg-fade-in .3s ease",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: senderColor, marginRight: 8 }}>{senderName}</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,.80)", lineHeight: 1.5 }}>{msg.content}</span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Reactions bar — removed for spectators per design (vote only, no reactions) */}

        {/* Floating reactions */}
        <div style={{ position: "fixed", right: 20, bottom: 120, pointerEvents: "none", zIndex: 30 }}>
          {reactions.map(r => (
            <div key={r.id} style={{
              fontSize: 28, position: "absolute", bottom: 0,
              right: Math.random() * 60,
              animation: "emoji-rise 3s ease-out forwards",
            }}>
              {r.emoji}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes mmq-spin { to { transform: rotate(360deg); } }
        @keyframes msg-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes emoji-rise {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-200px) scale(0.6); }
        }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", position: "relative", zIndex: 1,
    fontFamily: "'Inter', system-ui, sans-serif", padding: "0 0 100px",
  },
  container: { maxWidth: 640, margin: "0 auto", padding: "24px 16px" },
  backBtn: {
    width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
    color: "rgba(255,255,255,.50)", textDecoration: "none", flexShrink: 0,
    transition: "background .15s",
  },
  liveBadge: {
    fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 6,
    background: "rgba(255,77,61,.10)", color: "#ff4d3d",
    display: "flex", alignItems: "center", gap: 5,
  },
  topicCard: {
    padding: "20px 22px", borderRadius: 16, marginBottom: 12,
    background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
  },
  vsRow: { display: "flex", alignItems: "center", gap: 12 },
  vsBadge: {
    width: 34, height: 34, borderRadius: 999, flexShrink: 0,
    background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,.30)",
  },
  winnerBanner: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "14px 20px", borderRadius: 14, marginBottom: 12,
    background: "rgba(251,191,36,.06)", border: "1px solid rgba(251,191,36,.15)",
    fontSize: 14,
  },
  chatCard: {
    borderRadius: 16, overflow: "hidden",
    background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)",
    marginBottom: 12,
  },
  chatHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,.05)",
  },
  chatArea: {
    maxHeight: 450, overflowY: "auto" as const, padding: "12px 14px",
    scrollbarWidth: "thin" as const, scrollbarColor: "rgba(255,255,255,.08) transparent",
  },
  voteCard: {
    padding: "18px 20px", borderRadius: 16, marginBottom: 12,
    background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)",
  },
  reactionsBar: {
    display: "flex", justifyContent: "center", gap: 10, padding: "14px 0",
  },
  emojiBtn: {
    width: 48, height: 48, borderRadius: 14,
    background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
    fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    transition: "transform .15s, background .15s",
  },
};
