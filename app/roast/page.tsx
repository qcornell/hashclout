"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Flame, Send, Volume2, VolumeX, Camera, Share2, RotateCcw, ArrowLeft, Loader2 } from "lucide-react";

const ROUNDS = 3;
const BOT_OPENER = "Step right up, human. You roast first — give me your best shot. I'll be… underwhelmed.";

interface Line { who: "you" | "bot"; text: string; }

/* Robot avatar (on-brand). */
function CloutBot({ size = 96, talking = false }: { size?: number; talking?: boolean }) {
  return (
    <div style={{ width: size, height: size, position: "relative", filter: "drop-shadow(0 8px 24px rgba(255,77,61,.35))" }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <linearGradient id="botg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff4d3d" />
            <stop offset="100%" stopColor="#ff7a45" />
          </linearGradient>
        </defs>
        <rect x="22" y="26" width="56" height="48" rx="14" fill="url(#botg)" />
        <rect x="28" y="32" width="44" height="32" rx="9" fill="#120e16" />
        <circle cx="42" cy="48" r={talking ? 6 : 5} fill="#fff" />
        <circle cx="58" cy="48" r={talking ? 6 : 5} fill="#fff" />
        <rect x="40" y={talking ? 58 : 59} width="20" height={talking ? 5 : 3} rx="2" fill="#ff7a45" />
        <rect x="46" y="14" width="8" height="12" rx="3" fill="url(#botg)" />
        <circle cx="50" cy="12" r="4" fill="#ffd27a" />
      </svg>
    </div>
  );
}

export default function RoastPage() {
  const { profile } = useAuth();
  const username = profile?.display_name || profile?.username || "challenger";

  const [stage, setStage] = useState<"intro" | "battle" | "verdict">("intro");
  const [round, setRound] = useState(1);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<string>("");
  const [reaction, setReaction] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);

  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, loading]);

  // Stop any speech if the user leaves the page.
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch {} }, []);

  const speak = useCallback((text: string) => {
    if (mutedRef.current || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const pref = voices.find(v => /en[-_]US/i.test(v.lang) && /google|daniel|alex|zarvox/i.test(v.name))
        || voices.find(v => /en/i.test(v.lang)) || voices[0];
      if (pref) u.voice = pref;
      u.rate = 0.98; u.pitch = 0.7; // robotic, deadpan
      setTalking(true);
      u.onend = () => setTalking(false);
      u.onerror = () => setTalking(false);
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  const startBattle = () => {
    // This runs on a user gesture — good moment to unlock mobile speech.
    try { window.speechSynthesis?.resume(); } catch {}
    setStage("battle");
    setRound(1);
    setLines([{ who: "bot", text: BOT_OPENER }]);
    speak(BOT_OPENER);
  };

  const sendRoast = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next = [...lines, { who: "you" as const, text }];
    setLines(next);
    setLoading(true);
    try {
      const r = await fetch("/api/roast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "roast", userRoast: text, username, round }),
      }).then(r => r.json());
      const reply = r?.reply || "…even my error messages are funnier than that.";
      setLines([...next, { who: "bot", text: reply }]);
      speak(reply);
      if (round >= ROUNDS) {
        setTimeout(() => runVerdict([...next, { who: "bot", text: reply }]), 900);
      } else {
        setRound(round + 1);
      }
    } catch {
      setLines([...next, { who: "bot", text: "Connection dropped. Saved by the router." }]);
    } finally {
      setLoading(false);
    }
  };

  const runVerdict = async (finalLines: Line[]) => {
    setStage("verdict");
    setLoading(true);
    const transcript = finalLines.map(l => `${l.who === "you" ? "Human" : "CloutBot"}: ${l.text}`).join("\n");
    try {
      const r = await fetch("/api/roast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "verdict", transcript, username }),
      }).then(r => r.json());
      setScore(typeof r?.score === "number" ? r.score : 6);
      setVerdict(r?.reply || "Respectable effort, meatbag.");
      speak(r?.reply || "Respectable effort, meatbag.");
    } catch {
      setScore(6); setVerdict("My judgment circuits glitched — we'll call it a draw.");
    } finally {
      setLoading(false);
    }
  };

  // Optional one-frame webcam snapshot for the share card. Track is stopped
  // immediately — no live video loop, so nothing stays running/hot.
  const captureReaction = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      const video = document.createElement("video");
      video.srcObject = stream; video.muted = true; await video.play();
      await new Promise(r => setTimeout(r, 350));
      const c = document.createElement("canvas");
      c.width = 320; c.height = 320;
      const ctx = c.getContext("2d");
      if (ctx) {
        const v = video, s = Math.min(v.videoWidth, v.videoHeight);
        ctx.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, 320, 320);
        setReaction(c.toDataURL("image/jpeg", 0.8));
      }
      stream.getTracks().forEach(t => t.stop());
    } catch {}
  };

  const handleShare = async () => {
    const best = [...lines].reverse().find(l => l.who === "bot")?.text || "";
    const text = `I scored ${score ?? "?"}/10 roasting CLOUTBOT on HashClout 🔥 "${best}" — think you can do better?`;
    const url = typeof window !== "undefined" ? `${window.location.origin}/roast` : "https://hashclout.io/roast";
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "HashClout Roast", text, url }); return; } catch (e: any) { if (e?.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(`${text} ${url}`); alert("Copied! Paste it anywhere."); } catch {}
  };

  const playAgain = () => {
    try { window.speechSynthesis?.cancel(); } catch {}
    setStage("intro"); setRound(1); setLines([]); setInput("");
    setScore(null); setVerdict(""); setReaction(null);
  };

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.topRow}>
          <Link href="/" style={S.back}><ArrowLeft size={18} /></Link>
          <div style={S.brand}><Flame size={16} color="#ff4d3d" /> ROAST LAB</div>
          <button onClick={() => setMuted(m => !m)} style={S.iconBtn} aria-label="Toggle voice">
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* INTRO */}
        {stage === "intro" && (
          <div style={S.center}>
            <CloutBot size={120} />
            <h1 style={S.title}>Roast <span style={{ color: "#ff4d3d" }}>CLOUTBOT</span></h1>
            <p style={S.sub}>3 rounds. You go first. The bot fires back — out loud. Survive, then get rated. Clip it. Share it.</p>
            <button style={S.cta} onClick={startBattle}><Flame size={18} /> START THE ROAST</button>
            <p style={S.fineprint}>Keep it playful — CloutBot roasts your bars, not your face.</p>
          </div>
        )}

        {/* BATTLE */}
        {stage === "battle" && (
          <>
            <div style={S.roundPill}>ROUND {round} / {ROUNDS}</div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><CloutBot size={84} talking={talking} /></div>
            <div ref={feedRef} style={S.feed}>
              {lines.map((l, i) => (
                <div key={i} style={{ ...S.bubble, ...(l.who === "you" ? S.you : S.bot) }}>
                  <span style={S.bubbleName}>{l.who === "you" ? "YOU" : "CLOUTBOT"}</span>
                  {l.text}
                </div>
              ))}
              {loading && <div style={{ ...S.bubble, ...S.bot, opacity: .7 }}><span style={S.bubbleName}>CLOUTBOT</span><Loader2 size={14} style={{ animation: "rspin .7s linear infinite" }} /> cooking…</div>}
            </div>
            <div style={S.inputRow}>
              <input
                style={S.input} value={input} onChange={e => setInput(e.target.value)}
                placeholder="Type your roast…" maxLength={400} enterKeyHint="send"
                onKeyDown={e => { if (e.key === "Enter") sendRoast(); }}
                autoFocus
              />
              <button style={S.send} onClick={sendRoast} disabled={loading || !input.trim()}><Send size={16} /></button>
            </div>
          </>
        )}

        {/* VERDICT */}
        {stage === "verdict" && (
          <div style={S.center}>
            <CloutBot size={88} talking={talking} />
            <div style={S.cardLabel}>CLOUTBOT'S VERDICT</div>
            {loading ? (
              <div style={{ color: "rgba(255,255,255,.5)", margin: "20px 0" }}><Loader2 size={22} style={{ animation: "rspin .7s linear infinite" }} /></div>
            ) : (
              <>
                <div style={S.score}>{score}<span style={{ fontSize: 22, color: "rgba(255,255,255,.4)" }}>/10</span></div>
                <p style={S.verdictLine}>&ldquo;{verdict}&rdquo;</p>
                {reaction && <img src={reaction} alt="your reaction" style={S.reactionImg} />}
                <div style={S.cardActions}>
                  {!reaction && <button style={S.ghost} onClick={captureReaction}><Camera size={15} /> Add reaction pic</button>}
                  <button style={S.cta} onClick={handleShare}><Share2 size={16} /> Share</button>
                  <button style={S.ghost} onClick={playAgain}><RotateCcw size={15} /> Run it back</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes rspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "radial-gradient(120% 80% at 50% -10%, rgba(255,77,61,.10), transparent 60%), var(--bg)", color: "var(--text)", padding: "16px 16px 90px" },
  wrap: { maxWidth: 520, margin: "0 auto" },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  back: { width: 38, height: 38, borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", display: "grid", placeItems: "center", color: "rgba(255,255,255,.6)", textDecoration: "none" },
  brand: { fontSize: 13, fontWeight: 900, letterSpacing: ".12em", display: "flex", alignItems: "center", gap: 6 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", display: "grid", placeItems: "center", color: "rgba(255,255,255,.6)", cursor: "pointer" },
  center: { textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 24 },
  title: { fontSize: 32, fontWeight: 900, letterSpacing: "-.02em", marginTop: 14 },
  sub: { fontSize: 14, color: "rgba(255,255,255,.5)", maxWidth: 360, lineHeight: 1.6, marginTop: 8 },
  cta: { display: "inline-flex", alignItems: "center", gap: 8, marginTop: 22, padding: "14px 28px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #ff4d3d, #ff7a45)", color: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 800, letterSpacing: ".03em", cursor: "pointer", boxShadow: "0 12px 32px rgba(255,77,61,.3)" },
  fineprint: { fontSize: 11, color: "rgba(255,255,255,.3)", marginTop: 14 },
  roundPill: { alignSelf: "center", margin: "0 auto 4px", width: "fit-content", fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "#ff7a45", background: "rgba(255,77,61,.1)", border: "1px solid rgba(255,77,61,.25)", padding: "5px 14px", borderRadius: 999, display: "block", textAlign: "center" },
  feed: { display: "flex", flexDirection: "column", gap: 8, height: "42vh", overflowY: "auto", padding: "8px 2px", marginBottom: 10 },
  bubble: { maxWidth: "85%", padding: "10px 14px", borderRadius: 14, fontSize: 14, lineHeight: 1.5, position: "relative", display: "flex", flexDirection: "column", gap: 3 },
  bubbleName: { fontSize: 9, fontWeight: 800, letterSpacing: ".1em", opacity: .55 },
  you: { alignSelf: "flex-end", background: "linear-gradient(135deg, rgba(255,77,61,.9), rgba(255,122,69,.85))", color: "#fff", borderBottomRightRadius: 4 },
  bot: { alignSelf: "flex-start", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", borderBottomLeftRadius: 4 },
  inputRow: { display: "flex", gap: 8, alignItems: "center" },
  input: { flex: 1, height: 48, borderRadius: 14, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "var(--text)", fontFamily: "inherit", fontSize: 16, padding: "0 16px", outline: "none" },
  send: { width: 48, height: 48, flexShrink: 0, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #ff4d3d, #ff7a45)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" },
  cardLabel: { fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: "rgba(255,255,255,.4)", marginTop: 14 },
  score: { fontSize: 64, fontWeight: 900, lineHeight: 1, marginTop: 8, background: "linear-gradient(135deg, #ff4d3d, #ff7a45)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  verdictLine: { fontSize: 16, color: "rgba(255,255,255,.8)", maxWidth: 380, lineHeight: 1.6, marginTop: 14, fontStyle: "italic" },
  reactionImg: { width: 120, height: 120, borderRadius: 16, objectFit: "cover", marginTop: 18, border: "2px solid rgba(255,77,61,.4)" },
  cardActions: { display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 24 },
  ghost: { display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 18px", borderRadius: 12, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.8)", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" },
};
