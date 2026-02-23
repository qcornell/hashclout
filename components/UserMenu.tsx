"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { User, LogOut, ChevronDown, Zap } from "lucide-react";
import Link from "next/link";
import AuthModal from "./AuthModal";

export default function UserMenu() {
  const { user, profile, loading, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) return null;

  const pill: React.CSSProperties = {
    position: "fixed", top: 14, right: 14, zIndex: 45,
    display: "flex", alignItems: "center", gap: 8,
    padding: "6px 14px", borderRadius: 999,
    background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)",
    backdropFilter: "blur(16px)", cursor: "pointer",
    fontFamily: "'Inter', system-ui, sans-serif",
    transition: "background .2s, border-color .2s",
  };

  // Logged out
  if (!user || !profile) {
    return (
      <>
        <button onClick={() => setShowModal(true)} style={{
          ...pill,
          fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.70)",
          letterSpacing: ".02em",
        }}>
          <User size={14} style={{ opacity: 0.5 }} />
          Sign In
        </button>
        <AuthModal open={showModal} onClose={() => setShowModal(false)} />
      </>
    );
  }

  // Logged in
  const initial = (profile.display_name || profile.username)[0].toUpperCase();

  return (
    <>
      <div ref={dropRef} style={{ position: "fixed", top: 14, right: 14, zIndex: 45, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          style={{
            ...pill, position: "relative",
            background: showDropdown ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.05)",
          }}
        >
          {/* Avatar */}
          <div style={{
            width: 26, height: 26, borderRadius: 999,
            background: "linear-gradient(135deg, #ff4d3d, #ff7a45)",
            display: "grid", placeItems: "center",
            fontSize: 12, fontWeight: 900, color: "#fff",
          }}>
            {initial}
          </div>

          {/* Name + Clout */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.85)", lineHeight: 1.1 }}>
              {profile.display_name || profile.username}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#ff7a45", display: "flex", alignItems: "center", gap: 3, lineHeight: 1 }}>
              <Zap size={9} fill="#ff7a45" /> {profile.elo_rating} ELO
            </span>
          </div>

          <ChevronDown size={12} style={{
            color: "rgba(255,255,255,.35)",
            transform: showDropdown ? "rotate(180deg)" : "rotate(0)",
            transition: "transform .2s",
          }} />
        </button>

        {/* Dropdown */}
        {showDropdown && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            width: 200, borderRadius: 14, padding: 6,
            background: "rgba(18,14,22,.97)", border: "1px solid rgba(255,255,255,.08)",
            boxShadow: "0 20px 60px rgba(0,0,0,.6)",
            backdropFilter: "blur(20px)",
            animation: "authFadeIn .2s ease",
          }}>
            {/* Stats row */}
            <div style={{
              display: "flex", justifyContent: "space-around", padding: "10px 8px",
              borderBottom: "1px solid rgba(255,255,255,.06)", marginBottom: 4,
            }}>
              {[
                { label: "W", value: profile.wins, color: "#22c55e" },
                { label: "L", value: profile.losses, color: "#ff4d3d" },
                { label: "🔥", value: profile.win_streak, color: "#ff7a45" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color, lineHeight: 1.2 }}>{value}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,.30)", letterSpacing: ".06em" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Profile link */}
            <Link href="/profile" onClick={() => setShowDropdown(false)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 8, textDecoration: "none",
              color: "rgba(255,255,255,.75)", fontSize: 13, fontWeight: 600,
              transition: "background .15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.06)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <User size={15} style={{ opacity: 0.5 }} /> Profile
            </Link>

            {/* Sign out */}
            <button onClick={() => { signOut(); setShowDropdown(false); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 8, border: "none", background: "transparent",
              color: "rgba(255,77,61,.7)", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", transition: "background .15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,77,61,.06)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <LogOut size={15} style={{ opacity: 0.6 }} /> Sign Out
            </button>
          </div>
        )}
      </div>

      <AuthModal open={showModal} onClose={() => setShowModal(false)} />

      <style>{`
        @keyframes authFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );
}
