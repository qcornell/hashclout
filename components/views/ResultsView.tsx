"use client";

import { Play, User } from "lucide-react";
import type { MatchResult } from "@/lib/matchmaking";
import type { XPBreakdown } from "@/lib/xp";

export interface ResultsViewProps {
  isWin: boolean;
  isTie: boolean;
  profile: any;
  eloDelta: number;
  xpResult: XPBreakdown | null;
  aiFeedback: string | null;
  aiProcessing: boolean;
  userClout: number;
  opponentClout: number;
  userSideLabel: string;
  oppSideLabel: string;
  opponent: MatchResult | null;
  debateFormat: "text" | "video" | null;
  userSpeakTime: number;
  emojiCounts: Record<string, number>;
  videoComments: { id: number; sender: "user" | "opponent"; text: string }[];
  userMsgCount: number;
  debateTimer: number;
  textCurrentRound: number;
  totalRounds: number;
  handlePlayAgain: () => void;
}

export default function ResultsView(props: ResultsViewProps) {
  const {
    isWin, isTie, profile, eloDelta, xpResult,
    aiFeedback, aiProcessing, userClout, opponentClout,
    userSideLabel, oppSideLabel, opponent, debateFormat,
    userSpeakTime, emojiCounts, videoComments, userMsgCount,
    debateTimer, textCurrentRound, totalRounds, handlePlayAgain,
  } = props;

  return (
    <div className="results-view">
      <div className="results-card">
        <div className="results-overline">DEBATE OVER</div>
        <div className={`results-verdict ${isTie ? "verdict-tie" : isWin ? "verdict-win" : "verdict-lose"}`}>
          {isTie ? "IT'S A TIE" : isWin ? "🏆 YOU WIN!" : "OPPONENT WINS"}
        </div>

        {/* ELO + XP row */}
        {profile && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12, marginTop: -8 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: eloDelta > 0 ? "#22c55e" : eloDelta < 0 ? "#ff4d3d" : "rgba(255,255,255,.40)" }}>
              {eloDelta > 0 ? `+${eloDelta}` : eloDelta === 0 ? "±0" : `${eloDelta}`} ELO
            </div>
            {xpResult && (
              <div style={{ fontSize: 14, fontWeight: 800, color: xpResult.finalXP > 0 ? "#fbbf24" : "#ff4d3d" }}>
                {xpResult.finalXP > 0 ? `+${xpResult.finalXP.toLocaleString()}` : xpResult.finalXP.toLocaleString()} XP
              </div>
            )}
          </div>
        )}

        {/* XP Breakdown */}
        {xpResult && xpResult.finalXP > 0 && (
          <div style={{
            padding: "14px 18px", borderRadius: 14, marginBottom: 16,
            background: "rgba(251,191,36,.04)", border: "1px solid rgba(251,191,36,.10)",
            textAlign: "left",
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", color: "rgba(251,191,36,.5)", marginBottom: 8 }}>XP BREAKDOWN</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,.45)" }}>Completion</span>
                <span style={{ fontWeight: 800, color: "rgba(255,255,255,.70)" }}>+{xpResult.base.toLocaleString()}</span>
              </div>
              {xpResult.matchResult > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,.45)" }}>{isWin ? "Win Bonus" : "Participation"}</span>
                  <span style={{ fontWeight: 800, color: isWin ? "#22c55e" : "rgba(255,255,255,.70)" }}>+{xpResult.matchResult.toLocaleString()}</span>
                </div>
              )}
              {xpResult.voteMarginBonus > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,.45)" }}>Vote Margin</span>
                  <span style={{ fontWeight: 800, color: "#fbbf24" }}>+{xpResult.voteMarginBonus.toLocaleString()}</span>
                </div>
              )}
              {xpResult.aiQualityBonus > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,.45)" }}>Quality Bonus</span>
                  <span style={{ fontWeight: 800, color: "#a855f7" }}>+{xpResult.aiQualityBonus.toLocaleString()}</span>
                </div>
              )}
              {xpResult.diminishingMultiplier < 1 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,.30)" }}>Daily Cap</span>
                  <span style={{ fontWeight: 700, color: "rgba(255,255,255,.30)" }}>×{xpResult.diminishingMultiplier}</span>
                </div>
              )}
              {xpResult.streakMultiplier > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,.45)" }}>🔥 Streak Bonus</span>
                  <span style={{ fontWeight: 800, color: "#ff7a45" }}>×{xpResult.streakMultiplier}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Feedback */}
        {(aiFeedback || aiProcessing) && (
          <div style={{
            padding: "14px 18px", borderRadius: 14, marginBottom: 16,
            background: isWin ? "rgba(34,197,94,.04)" : "rgba(168,85,247,.04)",
            border: `1px solid ${isWin ? "rgba(34,197,94,.10)" : "rgba(168,85,247,.10)"}`,
            textAlign: "left",
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", color: isWin ? "rgba(34,197,94,.5)" : "rgba(168,85,247,.5)", marginBottom: 8 }}>
              🤖 AI JUDGE
            </div>
            {aiProcessing && !aiFeedback ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)", fontStyle: "italic" }}>Analyzing your debate...</div>
            ) : (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)", lineHeight: 1.6 }}>{aiFeedback}</div>
            )}
          </div>
        )}

        {/* XP Progress Bar */}
        {profile && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.30)", marginBottom: 6 }}>
              <span>{((profile as any).xp_total || 0).toLocaleString()} XP</span>
              <span>1,000,000 XP</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 999,
                background: "linear-gradient(90deg, #fbbf24, #ff7a45)",
                width: `${Math.min(100, (((profile as any).xp_total || 0) / 1000000) * 100)}%`,
                transition: "width 1s ease",
                boxShadow: "0 0 12px rgba(251,191,36,.3)",
              }} />
            </div>
          </div>
        )}

        <div className="results-score-row">
          <div className="result-score rs-user"><span className="result-score-label">{profile?.display_name || "You"}</span><span className="result-score-num">{userClout}</span><span className="result-score-sub">{userSideLabel}</span></div>
          <div className="results-divider">VS</div>
          <div className="result-score rs-opp"><span className="result-score-label">{opponent?.opponentDisplayName || "Opponent"}</span><span className="result-score-num">{opponentClout}</span><span className="result-score-sub">{oppSideLabel}</span></div>
        </div>
        <div className="results-stats-row">
          {debateFormat === "video" ? (
            <>
              <span className="results-stat"><strong>{userSpeakTime}s</strong> speaking</span>
              <span className="results-stat"><strong>{Object.values(emojiCounts).reduce((a, b) => a + b, 0)}</strong> reactions</span>
              <span className="results-stat"><strong>{videoComments.filter(c => c.sender === "user").length}</strong> comments</span>
            </>
          ) : (
            <>
              <span className="results-stat"><strong>{userMsgCount}</strong> arguments made</span>
              <span className="results-stat"><strong>{Math.ceil((180 - debateTimer) / 60)}</strong> min debated</span>
              <span className="results-stat">Round <strong>{textCurrentRound}</strong>/{totalRounds}</span>
            </>
          )}
        </div>
        <button className="btn btn-primary btn-play-again" onClick={handlePlayAgain}><Play size={15} fill="white" stroke="white" /> PLAY AGAIN</button>
      </div>
    </div>
  );
}
