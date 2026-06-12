"use client";

import { Play } from "lucide-react";
import type { MatchResult } from "@/lib/matchmaking";
import { type CloutBreakdown, outcomeLabel } from "@/lib/clout";

export interface ResultsViewProps {
  isWin: boolean;
  isTie: boolean;
  profile: any;
  eloDelta: number;
  xpResult: CloutBreakdown | null;
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
    isWin, isTie, profile, xpResult,
    aiFeedback, aiProcessing,
    userSideLabel, oppSideLabel, opponent, debateFormat,
    userSpeakTime, emojiCounts, videoComments, userMsgCount,
    debateTimer, textCurrentRound, totalRounds, handlePlayAgain,
  } = props;

  const outcome = xpResult?.outcome;
  const exhibition = outcome === "exhibition";

  // Vote-based score (derived from the same tally that decided the match)
  const totalVotes = xpResult?.totalVotes || 0;
  const myVotes = totalVotes > 0 ? Math.round(((xpResult?.votePct || 0) / 100) * totalVotes) : 0;
  const oppVotes = totalVotes - myVotes;

  const verdictText = exhibition ? "EXHIBITION" : isTie ? "IT'S A TIE" : isWin ? "🏆 YOU WIN!" : "OPPONENT WINS";
  const verdictClass = exhibition || isTie ? "verdict-tie" : isWin ? "verdict-win" : "verdict-lose";

  return (
    <div className="results-view">
      <div className="results-card">
        <div className="results-overline">DEBATE OVER</div>
        <div className={`results-verdict ${verdictClass}`}>{verdictText}</div>

        {/* Clout earned */}
        {xpResult && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12, marginTop: -8 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: xpResult.total > 0 ? "#fbbf24" : "rgba(255,255,255,.40)" }}>
              +{xpResult.total} Clout
            </div>
          </div>
        )}

        {/* Clout breakdown */}
        {xpResult && (
          <div style={{
            padding: "14px 18px", borderRadius: 14, marginBottom: 16,
            background: "rgba(251,191,36,.04)", border: "1px solid rgba(251,191,36,.10)",
            textAlign: "left",
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", color: "rgba(251,191,36,.5)", marginBottom: 8 }}>CLOUT EARNED</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,.45)" }}>{outcomeLabel(xpResult.outcome)}</span>
                <span style={{ fontWeight: 800, color: isWin ? "#22c55e" : "rgba(255,255,255,.70)" }}>+{xpResult.base}</span>
              </div>
              {xpResult.decisiveBonus > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,.45)" }}>Decisive win ({xpResult.votePct}%)</span>
                  <span style={{ fontWeight: 800, color: "#fbbf24" }}>+{xpResult.decisiveBonus}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,.06)", marginTop: 4, paddingTop: 6 }}>
                <span style={{ color: "rgba(255,255,255,.65)", fontWeight: 800 }}>Total</span>
                <span style={{ fontWeight: 900, color: "#fbbf24" }}>+{xpResult.total}</span>
              </div>
              {exhibition && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginTop: 4, lineHeight: 1.5 }}>
                  No audience voted — this was a friendly exhibition. No win or loss recorded.
                </div>
              )}
              {!exhibition && xpResult.totalVotes === 0 && (
                <div style={{ fontSize: 11, color: "rgba(168,85,247,.6)", marginTop: 4, lineHeight: 1.5 }}>
                  ⚖️ Decided by AI judge — no audience votes.
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
              🤖 AI COACH
            </div>
            {aiProcessing && !aiFeedback ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)", fontStyle: "italic" }}>Analyzing your debate...</div>
            ) : (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)", lineHeight: 1.6 }}>{aiFeedback}</div>
            )}
          </div>
        )}

        {/* Total Clout */}
        {profile && (
          <div style={{ marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "rgba(255,255,255,.30)", marginBottom: 2 }}>TOTAL CLOUT</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fbbf24" }}>{((profile as any).xp_total || 0).toLocaleString()}</div>
          </div>
        )}

        {/* Vote score row */}
        <div className="results-score-row">
          <div className="result-score rs-user"><span className="result-score-label">{profile?.display_name || "You"}</span><span className="result-score-num">{totalVotes > 0 ? myVotes : "—"}</span><span className="result-score-sub">{userSideLabel}</span></div>
          <div className="results-divider">{totalVotes > 0 ? "VOTES" : "VS"}</div>
          <div className="result-score rs-opp"><span className="result-score-label">{opponent?.opponentDisplayName || "Opponent"}</span><span className="result-score-num">{totalVotes > 0 ? oppVotes : "—"}</span><span className="result-score-sub">{oppSideLabel}</span></div>
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
