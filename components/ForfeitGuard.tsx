"use client";

import { useEffect, useState, useCallback } from "react";

interface ForfeitGuardProps {
  active: boolean;
  onForfeit: () => void;
}

/**
 * Shows a warning modal when user tries to navigate away during a live debate.
 * Also blocks browser back/close via beforeunload.
 */
export default function ForfeitGuard({ active, onForfeit }: ForfeitGuardProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Block browser close/refresh
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You're in a live debate. Leaving will count as a forfeit.";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);

  // Intercept link clicks
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a[href], button");
      if (!link) return;

      // Check if it's a navigation link (not the debate UI)
      const href = link.getAttribute("href");
      if (href && (href.startsWith("/") || href.startsWith("http")) && href !== "#") {
        e.preventDefault();
        e.stopPropagation();
        setPendingHref(href);
        setShowWarning(true);
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [active]);

  const handleStay = useCallback(() => {
    setShowWarning(false);
    setPendingHref(null);
  }, []);

  const handleLeave = useCallback(() => {
    setShowWarning(false);
    onForfeit();
    if (pendingHref) {
      setTimeout(() => { window.location.href = pendingHref; }, 100);
    }
  }, [pendingHref, onForfeit]);

  if (!showWarning) return null;

  return (
    <div style={s.overlay} onClick={handleStay}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6, color: "rgba(255,255,255,.92)" }}>Leave Debate?</h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,.45)", marginBottom: 24, lineHeight: 1.5 }}>
          You're in a live debate. Leaving now will count as a <strong style={{ color: "#ff4d3d" }}>forfeit</strong> and your opponent wins.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={handleStay} style={s.stayBtn}>Stay in Debate</button>
          <button onClick={handleLeave} style={s.leaveBtn}>Leave & Forfeit</button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 200,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(7,7,12,.85)", backdropFilter: "blur(12px)",
  },
  modal: {
    width: "90%", maxWidth: 380, padding: "36px 28px", borderRadius: 20,
    background: "linear-gradient(180deg, rgba(18,14,22,.98), rgba(10,8,14,.99))",
    border: "1px solid rgba(255,255,255,.08)",
    boxShadow: "0 40px 100px rgba(0,0,0,.6)",
    textAlign: "center" as const,
  },
  stayBtn: {
    padding: "12px 24px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #ff4d3d, #ff7a45)", color: "#fff",
    fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer",
    boxShadow: "0 10px 30px rgba(255,77,61,.2)",
  },
  leaveBtn: {
    padding: "12px 24px", borderRadius: 12,
    border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.50)", fontFamily: "inherit", fontSize: 14,
    fontWeight: 700, cursor: "pointer",
  },
};
