"use client";

import { Clock, User, Send } from "lucide-react";
import type { MatchResult } from "@/lib/matchmaking";
import type { RefObject } from "react";

export interface TextDebateViewProps {
  topicTitle: string;
  isLiveMatch: boolean;
  debateTimer: number;
  textCurrentRound: number;
  totalRounds: number;
  profile: any;
  opponent: MatchResult | null;
  userSideLabel: string;
  oppSideLabel: string;
  userClout: number;
  opponentClout: number;
  messages: { id: number; sender: "user" | "opponent" | "system"; text: string; clout?: number }[];
  inputValue: string;
  opponentTyping: boolean;
  oppTyping: boolean;
  moderationWarning: string | null;
  messagesEndRef: RefObject<HTMLDivElement>;
  handleInputChange: (v: string) => void;
  handleSendMessage: () => void;
  setModerationWarning: (v: string | null) => void;
  setShowExitConfirm: (v: boolean) => void;
}

function formatTime(s: number) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`; }

export default function TextDebateView(props: TextDebateViewProps) {
  const {
    topicTitle, isLiveMatch, debateTimer, textCurrentRound, totalRounds,
    profile, opponent, userSideLabel, oppSideLabel, userClout, opponentClout,
    messages, inputValue, opponentTyping, oppTyping, moderationWarning,
    messagesEndRef,
    handleInputChange, handleSendMessage, setModerationWarning, setShowExitConfirm,
  } = props;

  return (
    <div className="debate-view">
      <div className="debate-header-bar">
        <span className="debate-topic-label">{topicTitle}</span>
        <span className="debate-format-badge dfb-text">{isLiveMatch ? "🔴 LIVE" : "⌨️ TEXT"}</span>
        <div className={`debate-timer-box ${debateTimer <= 30 ? "timer-low" : ""}`}><Clock size={15} /><span>{formatTime(debateTimer)}</span></div>
        <span className="debate-round-label">Round {textCurrentRound}/{totalRounds}</span>
      </div>
      <div className="debate-scores-bar">
        <div className="score-card sc-user"><div className="sc-avatar"><User size={18} /></div><div className="sc-info"><span className="sc-side">{profile?.display_name || profile?.username || "You"} · {userSideLabel}</span><div className="sc-clout-row"><span className="sc-clout-value">{userClout}</span><span className="sc-clout-label">CLOUT</span></div></div></div>
        <div className="score-vs-pill">VS</div>
        <div className="score-card sc-opponent"><div className="sc-avatar"><User size={18} /></div><div className="sc-info"><span className="sc-side">{opponent?.opponentDisplayName || "Opponent"} · {oppSideLabel}</span><div className="sc-clout-row"><span className="sc-clout-value">{opponentClout}</span><span className="sc-clout-label">CLOUT</span></div></div></div>
      </div>
      <div className="messages-area">
        {messages.map(msg => msg.sender === "system" ? (
          <div key={msg.id} className="msg-system">{msg.text}</div>
        ) : (
          <div key={msg.id} className={`msg-bubble ${msg.sender === "user" ? "msg-user" : "msg-opponent"}`}>
            <div className="msg-sender-row"><span className="msg-sender-name">{msg.sender === "user" ? (profile?.display_name || profile?.username || "You") : (opponent?.opponentDisplayName || "Opponent")}</span>{msg.clout && <span className="msg-clout-badge">+{msg.clout} 🔥</span>}</div>
            <div className="msg-text">{msg.text}</div>
          </div>
        ))}
        {(opponentTyping || oppTyping) && <div className="typing-bubble"><span /><span /><span /></div>}
        <div ref={messagesEndRef} />
      </div>
      {moderationWarning && (
        <div style={{ padding: "8px 14px", margin: "0 0 6px", borderRadius: 10, background: "rgba(255,77,61,.08)", border: "1px solid rgba(255,77,61,.18)", color: "#ff7a45", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🛡️</span> {moderationWarning}
          <button onClick={() => setModerationWarning(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,.30)", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>×</button>
        </div>
      )}
      <div className="debate-input-bar">
        <input type="text" className="debate-input" value={inputValue} onChange={e => { handleInputChange(e.target.value); if (moderationWarning) setModerationWarning(null); }} onKeyDown={e => e.key === "Enter" && handleSendMessage()} placeholder={isLiveMatch ? "Argue your point…" : "Make your argument…"} disabled={!isLiveMatch && opponentTyping} />
        <button className="btn-send-debate" onClick={handleSendMessage} disabled={(!isLiveMatch && opponentTyping) || !inputValue.trim()}><Send size={16} /></button>
        <button onClick={() => setShowExitConfirm(true)} style={{
          width: 42, height: 42, flexShrink: 0, borderRadius: 10,
          background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
          color: "rgba(255,255,255,.30)", fontSize: 18, cursor: "pointer",
          display: "grid", placeItems: "center",
        }}>×</button>
      </div>
    </div>
  );
}
