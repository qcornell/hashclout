"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { X, Mail, Lock, User, Loader2 } from "lucide-react";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: "signin" | "signup";
}

export default function AuthModal({ open, onClose, initialTab = "signin" }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">(initialTab);

  // Sync tab with initialTab when modal opens
  const [lastOpen, setLastOpen] = useState(false);
  if (open && !lastOpen) { if (tab !== initialTab) setTab(initialTab); }
  if (open !== lastOpen) setLastOpen(open);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Track where a mouse-press started so a text-selection drag that ends on the
  // backdrop doesn't close the modal. We only close when BOTH the press and the
  // release happen on the overlay itself.
  const mouseDownOnOverlay = useRef(false);

  if (!open) return null;

  const reset = () => {
    setEmail(""); setPassword(""); setConfirmPassword(""); setUsername("");
    setError(null); setSuccess(null);
  };

  const switchTab = (t: "signin" | "signup") => {
    setTab(t); reset();
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) { setError(error); return; }
    onClose();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (username.length < 3) { setError("Username must be at least 3 characters"); return; }
    if (!/^[a-z0-9_]+$/.test(username.toLowerCase())) { setError("Username: letters, numbers, underscore only"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    setLoading(true);
    const { error } = await signUp(email, password, username, username);
    setLoading(false);
    if (error) { setError(error); return; }
    setSuccess("Account created! Check your email to confirm, then sign in.");
    setTimeout(() => switchTab("signin"), 2500);
  };

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 60,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(7,7,12,.82)", backdropFilter: "blur(20px)",
    animation: "authFadeIn .3s ease",
  };

  const card: React.CSSProperties = {
    width: "92%", maxWidth: 420, borderRadius: 22, padding: 2,
    background: "linear-gradient(135deg, rgba(255,77,61,.25), rgba(255,122,69,.12) 40%, rgba(115,47,109,.20) 70%, rgba(53,33,97,.35))",
    boxShadow: "0 50px 120px rgba(0,0,0,.55)",
  };

  const inner: React.CSSProperties = {
    background: "linear-gradient(180deg, rgba(18,14,22,.97), rgba(10,8,14,.99))",
    borderRadius: 20, padding: "36px 32px 32px", position: "relative",
  };

  const input: React.CSSProperties = {
    width: "100%", height: 46, borderRadius: 10,
    background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
    color: "rgba(255,255,255,.92)", fontFamily: "inherit", fontSize: 16,
    padding: "0 14px 0 42px", outline: "none",
    transition: "border-color .2s",
  };

  const btnPrimary: React.CSSProperties = {
    width: "100%", height: 48, borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #ff4d3d, #ff7a45)", color: "#fff",
    fontFamily: "inherit", fontSize: 15, fontWeight: 800, letterSpacing: ".04em",
    cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: "0 12px 35px rgba(255,77,61,.2)",
    transition: "transform .15s, filter .15s",
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "10px 0", border: "none", borderRadius: 8,
    background: active ? "rgba(255,255,255,.08)" : "transparent",
    color: active ? "rgba(255,255,255,.92)" : "rgba(255,255,255,.35)",
    fontFamily: "inherit", fontSize: 13, fontWeight: 700,
    cursor: "pointer", transition: "all .2s",
  });

  const iconWrap: React.CSSProperties = {
    position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
    color: "rgba(255,255,255,.25)", pointerEvents: "none",
  };

  return (
    <div
      style={overlay}
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownOnOverlay.current) onClose();
        mouseDownOnOverlay.current = false;
      }}
    >
      <div style={card}>
        <div style={inner}>
          {/* Close */}
          <button onClick={onClose} style={{
            position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, width: 32, height: 32,
            display: "grid", placeItems: "center", cursor: "pointer", color: "rgba(255,255,255,.4)",
            transition: "background .2s",
          }}>
            <X size={14} />
          </button>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-.02em", marginBottom: 4 }}>
              {tab === "signin" ? "Welcome Back" : "Join the Arena"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.40)", fontWeight: 500 }}>
              {tab === "signin" ? "Sign in to your account" : "Create your debater profile"}
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex", gap: 4, padding: 4, borderRadius: 10,
            background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
            marginBottom: 20,
          }}>
            <button style={tabBtn(tab === "signin")} onClick={() => switchTab("signin")}>Sign In</button>
            <button style={tabBtn(tab === "signup")} onClick={() => switchTab("signup")}>Sign Up</button>
          </div>

          {/* Error / Success */}
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 10, marginBottom: 16,
              background: "rgba(255,77,61,.08)", border: "1px solid rgba(255,77,61,.18)",
              color: "#ff7a45", fontSize: 12, fontWeight: 600,
            }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{
              padding: "10px 14px", borderRadius: 10, marginBottom: 16,
              background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.18)",
              color: "#22c55e", fontSize: 12, fontWeight: 600,
            }}>
              {success}
            </div>
          )}

          {/* Sign In Form */}
          {tab === "signin" && (
            <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <div style={iconWrap}><Mail size={16} /></div>
                <input style={input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div style={{ position: "relative" }}>
                <div style={iconWrap}><Lock size={16} /></div>
                <input style={input} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <button type="submit" style={btnPrimary} disabled={loading}>
                {loading ? <Loader2 size={18} style={{ animation: "mmq-spin .6s linear infinite" }} /> : "Sign In"}
              </button>
              {/* Facebook OAuth temporarily disabled — re-enable once the Facebook
                  provider is configured in Supabase and an /auth/callback route exists. */}
            </form>
          )}

          {/* Sign Up Form */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <div style={iconWrap}><Mail size={16} /></div>
                <input style={input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div style={{ position: "relative" }}>
                <div style={iconWrap}><User size={16} /></div>
                <input style={input} type="text" placeholder="Username" value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  maxLength={20} required />
              </div>
              <div style={{ position: "relative" }}>
                <div style={iconWrap}><Lock size={16} /></div>
                <input style={input} type="password" placeholder="Password (6+ chars)" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div style={{ position: "relative" }}>
                <div style={iconWrap}><Lock size={16} /></div>
                <input style={{ ...input, borderColor: confirmPassword && password !== confirmPassword ? "rgba(255,77,61,.4)" : undefined }} type="password" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <div style={{ fontSize: 11, color: "#ff4d3d", fontWeight: 600, marginTop: -4 }}>Passwords don't match</div>
              )}
              <button type="submit" style={btnPrimary} disabled={loading}>
                {loading ? <Loader2 size={18} style={{ animation: "mmq-spin .6s linear infinite" }} /> : "Create Account"}
              </button>
              {/* Facebook OAuth temporarily disabled — re-enable once the Facebook
                  provider is configured in Supabase and an /auth/callback route exists. */}
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes authFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
