"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabase";
import { Trophy, Flame, Swords, Shield, TrendingUp, Edit3, Check, X, Camera, Loader2 } from "lucide-react";

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 480);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

function getTier(elo: number) {
  if (elo >= 2000) return { label: "GOAT", emoji: "🐐", color: "#fbbf24" };
  if (elo >= 1600) return { label: "ELITE", emoji: "💎", color: "#a855f7" };
  if (elo >= 1300) return { label: "VETERAN", emoji: "⚡", color: "#3b82f6" };
  if (elo >= 1100) return { label: "RISING", emoji: "🔥", color: "#ff7a45" };
  return { label: "ROOKIE", emoji: "🌱", color: "#6b7280" };
}

export default function ProfilePage() {
  const { user, profile, loading, updateProfile } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setEditName(profile.display_name || "");
      setEditBio(profile.bio || "");
    }
  }, [profile]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ fontSize: 32, textAlign: "center", paddingTop: 120 }}>
          <Flame size={32} style={{ animation: "mmq-spin 1s linear infinite" }} color="#ff7a45" />
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div style={styles.page}>
        <div style={styles.authPrompt}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚔️</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Enter the Arena</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,.45)", marginBottom: 24 }}>
            Sign in to track your clout, wins, and rank.
          </p>
          <button onClick={() => setShowAuth(true)} style={styles.ctaBtn}>
            Sign In to View Profile
          </button>
          <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
        </div>
      </div>
    );
  }

  const isMobile = useIsMobile();
  const tier = getTier(profile.elo_rating);
  const winRate = profile.total_battles > 0
    ? Math.round((profile.wins / profile.total_battles) * 100)
    : 0;

  const handleSave = async () => {
    setSaving(true);
    await updateProfile({ display_name: editName, bio: editBio });
    setSaving(false);
    setEditing(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) { alert("Image must be under 2MB"); return; }

    setUploadingAvatar(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      setUploadingAvatar(false);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = urlData.publicUrl + "?t=" + Date.now(); // cache bust

    // Update profile
    await updateProfile({ avatar_url: avatarUrl });
    setUploadingAvatar(false);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Back button */}
        <button onClick={() => window.location.href = "/"} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 10, padding: "8px 14px", color: "rgba(255,255,255,.50)",
          fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer",
          marginBottom: 16, transition: "background .15s",
        }}>
          ← Back
        </button>

        {/* Avatar + Name */}
        <div style={styles.hero}>
          <div style={styles.avatarOuter}>
            <div style={{ ...styles.avatar, position: "relative", cursor: "pointer" }} onClick={() => fileInputRef.current?.click()}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", borderRadius: 999, objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 42 }}>{tier.emoji}</span>
              )}
              <div style={styles.avatarOverlay}>
                {uploadingAvatar ? <Loader2 size={18} color="#fff" style={{ animation: "mmq-spin .6s linear infinite" }} /> : <Camera size={18} color="#fff" />}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
            </div>
          </div>

          {!editing ? (
            <>
              <h1 style={styles.displayName}>{profile.display_name || profile.username}</h1>
              <p style={styles.username}>@{profile.username}</p>
              <span style={{ ...styles.tierBadge, color: tier.color, borderColor: `${tier.color}33`, background: `${tier.color}11` }}>
                {tier.label}
              </span>
              {profile.bio && <p style={styles.bio}>{profile.bio}</p>}
              <button onClick={() => setEditing(true)} style={styles.editBtn}>
                <Edit3 size={12} /> Edit Profile
              </button>
            </>
          ) : (
            <div style={styles.editForm}>
              <input
                value={editName} onChange={e => setEditName(e.target.value)}
                placeholder="Display Name" maxLength={30}
                style={styles.editInput}
              />
              <textarea
                value={editBio} onChange={e => setEditBio(e.target.value)}
                placeholder="Write a short bio..." maxLength={160} rows={3}
                style={{ ...styles.editInput, height: "auto", padding: "12px 14px", resize: "none" }}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={handleSave} disabled={saving} style={{ ...styles.editBtn, background: "rgba(34,197,94,.12)", color: "#22c55e", borderColor: "rgba(34,197,94,.2)" }}>
                  <Check size={12} /> {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setEditing(false)} style={{ ...styles.editBtn, background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.45)", borderColor: "rgba(255,255,255,.08)" }}>
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Clout + Win Rate */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ ...styles.eloCard, flex: 1 }}>
            <div style={{ ...styles.eloNum, background: "linear-gradient(135deg, #fbbf24, #ff7a45)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {((profile as any).xp_total || 0).toLocaleString()}
            </div>
            <div style={styles.eloLabel}>CLOUT</div>
          </div>
          <div style={{ ...styles.eloCard, flex: 1 }}>
            <div style={styles.eloNum}>{profile.total_battles ? Math.round((profile.wins / profile.total_battles) * 100) : 0}%</div>
            <div style={styles.eloLabel}>WIN RATE</div>
          </div>
        </div>

        {/* Streak + Daily */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#ff7a45" }}>
              {(profile as any).streak_count > 0 ? `🔥 ${(profile as any).streak_count}` : "—"}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", color: "rgba(255,255,255,.25)", marginTop: 4 }}>DAY STREAK</div>
          </div>
          <div style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,.60)" }}>
              {(profile as any).daily_debate_count || 0}/10
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", color: "rgba(255,255,255,.25)", marginTop: 4 }}>DEBATES TODAY</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ ...styles.statsGrid, gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)" }}>
          {[
            { label: "Battles", value: profile.total_battles, icon: <Swords size={18} />, color: "rgba(255,255,255,.85)" },
            { label: "Wins", value: profile.wins, icon: <Trophy size={18} />, color: "#22c55e" },
            { label: "Losses", value: profile.losses, icon: <Shield size={18} />, color: "#ff4d3d" },
            { label: "Streak", value: profile.win_streak > 0 ? `🔥${profile.win_streak}` : "—", icon: <Flame size={18} />, color: "#ff7a45" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} style={styles.statCard}>
              <div style={{ color, opacity: 0.5, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>

        {/* Win Rate */}
        <div style={styles.winRateCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.40)", display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={13} /> Win Rate
            </span>
            <span style={{ fontSize: 14, fontWeight: 900, color: "rgba(255,255,255,.85)" }}>{winRate}%</span>
          </div>
          <div style={styles.winRateTrack}>
            <div style={{ ...styles.winRateFill, width: `${winRate}%` }} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes mmq-spin { to { transform: rotate(360deg); } }
        [style*="cursor: pointer"]:hover > [style*="opacity: 0"] { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
    padding: "40px 16px 100px", position: "relative", zIndex: 1,
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  container: {
    width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 16,
  },
  authPrompt: {
    textAlign: "center", paddingTop: 80,
  },
  ctaBtn: {
    height: 48, padding: "0 28px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #ff4d3d, #ff7a45)", color: "#fff",
    fontFamily: "inherit", fontSize: 15, fontWeight: 800, cursor: "pointer",
    boxShadow: "0 12px 35px rgba(255,77,61,.2)",
  },
  hero: {
    textAlign: "center", paddingBottom: 8,
  },
  avatarOuter: {
    display: "flex", justifyContent: "center", marginBottom: 16,
  },
  avatar: {
    width: 88, height: 88, borderRadius: 999,
    background: "rgba(255,255,255,.04)", border: "2px solid rgba(255,255,255,.08)",
    display: "grid", placeItems: "center",
    boxShadow: "0 0 40px rgba(255,77,61,.06)",
    overflow: "hidden",
  },
  avatarOverlay: {
    position: "absolute" as const, bottom: 0, left: 0, right: 0,
    height: 30, display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)",
    opacity: 0, transition: "opacity .2s",
  },
  displayName: {
    fontSize: 28, fontWeight: 900, letterSpacing: "-.02em", marginBottom: 2,
  },
  username: {
    fontSize: 13, color: "rgba(255,255,255,.35)", fontWeight: 500, marginBottom: 8,
  },
  tierBadge: {
    display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: ".14em",
    padding: "4px 14px", borderRadius: 20, border: "1px solid",
    marginBottom: 10,
  },
  bio: {
    fontSize: 13, color: "rgba(255,255,255,.50)", fontWeight: 500, lineHeight: 1.6,
    maxWidth: 360, margin: "0 auto 10px",
  },
  editBtn: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.50)",
    fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer",
    transition: "background .2s",
  },
  editForm: {
    display: "flex", flexDirection: "column", gap: 10, alignItems: "center", marginTop: 8,
  },
  editInput: {
    width: "100%", maxWidth: 300, height: 42, borderRadius: 10,
    background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
    color: "rgba(255,255,255,.92)", fontFamily: "inherit", fontSize: 16,
    padding: "0 14px", outline: "none", textAlign: "center",
  },
  eloCard: {
    textAlign: "center", padding: "28px 20px", borderRadius: 16,
    background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
  },
  eloNum: {
    fontSize: 48, fontWeight: 900, lineHeight: 1,
    background: "linear-gradient(135deg, #ff4d3d, #ff7a45)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    marginBottom: 4,
  },
  eloLabel: {
    fontSize: 10, fontWeight: 800, letterSpacing: ".16em", color: "rgba(255,255,255,.30)",
  },
  statsGrid: {
    display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10,
  },
  statCard: {
    textAlign: "center", padding: "18px 8px", borderRadius: 14,
    background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
  },
  statLabel: {
    fontSize: 9, fontWeight: 700, letterSpacing: ".1em", color: "rgba(255,255,255,.25)",
    textTransform: "uppercase" as const, marginTop: 4,
  },
  winRateCard: {
    padding: "18px 22px", borderRadius: 14,
    background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
  },
  winRateTrack: {
    height: 8, borderRadius: 999, background: "rgba(255,255,255,.06)", overflow: "hidden",
  },
  winRateFill: {
    height: "100%", borderRadius: 999,
    background: "linear-gradient(90deg, #ff4d3d, #ff7a45)",
    boxShadow: "0 0 12px rgba(255,77,61,.3)",
    transition: "width .5s ease",
  },
};
