"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Eye, Flame, Clock, Swords, Users } from "lucide-react";

interface LiveMatch {
  id: string;
  mode: string;
  topic: string;
  status: string;
  round: string;
  created_at: string;
  player_a: { id: string; username: string; display_name: string; elo_rating: number } | null;
  player_b: { id: string; username: string; display_name: string; elo_rating: number } | null;
}

function timeSince(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m`;
}

export default function WatchPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLive();

    // Real-time updates
    const channel = supabase
      .channel("live-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => fetchLive())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchLive() {
    // Only show matches created in the last 30 minutes that are still "live"
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("matches")
      .select(`
        id, mode, topic, status, round, created_at,
        player_a:profiles!matches_player_a_fkey(id, username, display_name, elo_rating),
        player_b:profiles!matches_player_b_fkey(id, username, display_name, elo_rating)
      `)
      .eq("status", "live")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setMatches(data as any);
    setLoading(false);
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={s.subtitle}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#ff4d3d", display: "inline-block", marginRight: 6, boxShadow: "0 0 8px rgba(255,77,61,.5)", animation: "live-pulse 1.5s ease-in-out infinite" }} />
            Spectate
          </div>
          <h1 style={s.title}>Live Debates</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,.35)", marginTop: 6 }}>
            Watch debates in real-time. React and learn.
          </p>
        </div>

        {/* Live count */}
        <div style={s.liveBar}>
          <Flame size={14} color="#ff7a45" />
          <span style={{ fontWeight: 800, color: "#ff7a45" }}>{matches.length}</span>
          <span style={{ color: "rgba(255,255,255,.35)" }}>live now</span>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Flame size={32} color="#ff7a45" style={{ animation: "mmq-spin .6s linear infinite" }} />
          </div>
        ) : matches.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏟️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,.45)" }}>No live debates right now</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.25)", marginTop: 6 }}>Start one yourself! Head to the main page.</div>
            <Link href="/" style={s.startBtn}>
              <Swords size={14} /> Start a Debate
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {matches.map(match => {
              const pA = match.player_a;
              const pB = match.player_b;
              return (
                <Link key={match.id} href={`/watch/${match.id}`} style={s.card}>
                  {/* Live badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={s.liveBadge}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: "#ff4d3d" }} /> LIVE
                    </span>
                    <span style={s.modeBadge}>
                      {match.mode === "debate" ? "🎙" : "🔥"} {match.mode.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,.20)", marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={10} /> {timeSince(match.created_at)} ago
                    </span>
                  </div>

                  {/* Topic */}
                  <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,.88)", marginBottom: 12, lineHeight: 1.3 }}>
                    {match.topic}
                  </div>

                  {/* Players */}
                  <div style={s.players}>
                    <div style={s.playerLeft}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#ff7a45" }}>{pA?.display_name || "Player 1"}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.25)" }}>{pA?.elo_rating || "?"} ELO</div>
                    </div>
                    <div style={s.vsBadge}>VS</div>
                    <div style={s.playerRight}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#a855f7" }}>{pB?.display_name || "Waiting..."}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.25)" }}>{pB?.elo_rating || "?"} ELO</div>
                    </div>
                  </div>

                  {/* Watch CTA */}
                  <div style={s.watchCta}>
                    <Eye size={13} /> Watch Live
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes mmq-spin { to { transform: rotate(360deg); } }
        @keyframes live-pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", position: "relative", zIndex: 1,
    fontFamily: "'Inter', system-ui, sans-serif", padding: "0 0 100px",
  },
  container: { maxWidth: 640, margin: "0 auto", padding: "32px 16px" },
  subtitle: {
    fontSize: 11, fontWeight: 800, letterSpacing: ".14em", color: "#ff4d3d",
    textTransform: "uppercase" as const, marginBottom: 4,
    display: "flex", alignItems: "center",
  },
  title: { fontSize: 32, fontWeight: 900, letterSpacing: "-.02em", color: "rgba(255,255,255,.92)" },
  liveBar: {
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 13, fontWeight: 600, marginBottom: 20,
    padding: "10px 16px", borderRadius: 12,
    background: "rgba(255,77,61,.06)", border: "1px solid rgba(255,77,61,.12)",
  },
  empty: {
    textAlign: "center" as const, padding: "60px 20px",
    background: "rgba(255,255,255,.02)", borderRadius: 18,
    border: "1px solid rgba(255,255,255,.05)",
  },
  startBtn: {
    display: "inline-flex", alignItems: "center", gap: 8,
    marginTop: 20, padding: "12px 24px", borderRadius: 12,
    background: "linear-gradient(135deg, #ff4d3d, #ff7a45)", color: "#fff",
    textDecoration: "none", fontWeight: 800, fontSize: 13,
    boxShadow: "0 10px 30px rgba(255,77,61,.2)",
  },
  card: {
    display: "block", padding: "18px 20px", borderRadius: 16, textDecoration: "none",
    background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)",
    transition: "border-color .2s, background .2s",
    cursor: "pointer",
  },
  liveBadge: {
    fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 6,
    background: "rgba(255,77,61,.10)", color: "#ff4d3d",
    display: "flex", alignItems: "center", gap: 5,
  },
  modeBadge: {
    fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 6,
    background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.40)",
  },
  players: {
    display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
  },
  playerLeft: { flex: 1, textAlign: "right" as const },
  playerRight: { flex: 1 },
  vsBadge: {
    width: 32, height: 32, borderRadius: 999, flexShrink: 0,
    background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,.30)",
  },
  watchCta: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "10px 0", borderRadius: 10,
    background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)",
    fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.50)",
    transition: "background .15s",
  },
};
