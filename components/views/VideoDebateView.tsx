"use client";

import { useState, useRef } from "react";
import { User, Send, Video, VideoOff, Scale, Shield, Mic, Ear, Zap, Share2, ThumbsUp, ThumbsDown } from "lucide-react";
import type { MatchResult } from "@/lib/matchmaking";
import type { RefObject } from "react";
import type { RemoteTrack } from "livekit-client";

export type FactCheckVerdict = "FACTS" | "FAKE_NEWS" | "STRETCH" | "UNVERIFIABLE";
export interface PendingChallenge {
  claim: string;
  challengerIsA: boolean;
  round: string;
}
export interface ChallengeResult {
  type: "fact_check" | "denied" | "blocked";
  claim: string;
  challengerName: string;
  speakerName: string;
  verdict?: FactCheckVerdict;
  context?: string;
}

export interface VideoDebateViewProps {
  matchId: string | null;
  selfVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoRef: RefObject<HTMLVideoElement>;
  remoteAudioRef: RefObject<HTMLAudioElement>;
  iAmPlayerAVideo: boolean;
  videoPhase: string | null;
  phaseTimer: number;
  phaseMax: number;
  roundInfo: { num: number; title: string; desc: string };
  isIntroPhase: boolean;
  isMyCountdown: boolean;
  isOppCountdown: boolean;
  isCountdownPhase: boolean;
  isUserSpeaking: boolean;
  isOppSpeaking: boolean;
  isRapidFire: boolean;
  isChallengeReview: boolean;
  isActivePhase: boolean;
  showSelf: boolean;
  showOpp: boolean;
  stageClass: string;
  cameraVisible: boolean;
  setCameraVisible: (v: boolean) => void;
  remoteVideoTrack: RemoteTrack | null;
  connected: boolean;
  userClout: number;
  opponentClout: number;
  sentimentPct: number;
  userSideLabel: string;
  oppSideLabel: string;
  profile: any;
  opponent: MatchResult | null;
  floatingEmojis: { id: number; emoji: string; x: number }[];
  videoComments: { id: number; sender: "user" | "opponent"; text: string }[];
  commentInput: string;
  setCommentInput: (v: string) => void;
  emojiCounts: Record<string, number>;
  myTokens: number;
  oppTokens: number;
  canFactCheck: boolean;
  canDeny: boolean;
  pendingChallenge: PendingChallenge | null;
  challengeResult: ChallengeResult | null;
  challengeNotification: string | null;
  showChallengeModal: boolean;
  setShowChallengeModal: (v: boolean) => void;
  challengeInput: string;
  setChallengeInput: (v: string) => void;
  interludeStep: number;
  blockWindow: boolean;
  blockTimer: number;
  challengeXpDelta: number;
  phaseWaiting: boolean;
  isLiveMatch: boolean;
  pendingChallengeRef: RefObject<PendingChallenge | null>;
  handleYield: () => void;
  handleEmojiReact: (emoji: string) => void;
  handleSendVideoComment: () => void;
  handleSubmitChallenge: () => void;
  handleDenyChallenge: () => void;
  handleBlockChallenge: () => void;
  setShowExitConfirm: (v: boolean) => void;
  handleCloseChallengeModal: () => void;
}

function fmtTime(s: number) {
  const safe = Math.max(0, s);
  const m = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function CircleTimer({ seconds, max }: { seconds: number; max: number }) {
  const r = 26, c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, seconds / max)) : 0;
  const offset = c * (1 - pct);
  const low = seconds <= 10;
  return (
    <div className="ctimer-box">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff4d6d" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="4" />
        <circle cx="32" cy="32" r={r} fill="none"
          stroke={low ? "#ff4d3d" : "url(#timerGrad)"}
          strokeWidth="4" strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 32 32)"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span className={`ctimer-text ${low ? "ctimer-low" : ""}`}>{fmtTime(seconds)}</span>
    </div>
  );
}

export default function VideoDebateView(props: VideoDebateViewProps) {
  const {
    matchId,
    selfVideoRef, remoteVideoRef, remoteAudioRef,
    iAmPlayerAVideo, videoPhase, phaseTimer, phaseMax, roundInfo,
    isIntroPhase, isCountdownPhase, isUserSpeaking, isOppSpeaking,
    isRapidFire, isChallengeReview, isActivePhase, showSelf, showOpp, stageClass,
    cameraVisible, setCameraVisible, remoteVideoTrack, connected,
    userSideLabel, oppSideLabel, profile, opponent,
    videoComments, commentInput, setCommentInput,
    emojiCounts, handleEmojiReact,
    myTokens, canFactCheck, canDeny,
    pendingChallenge, challengeResult, challengeNotification,
    showChallengeModal, setShowChallengeModal, challengeInput, setChallengeInput,
    interludeStep, blockWindow, blockTimer, challengeXpDelta, phaseWaiting,
    isLiveMatch, pendingChallengeRef,
    handleYield, handleSendVideoComment,
    handleSubmitChallenge, handleDenyChallenge, handleBlockChallenge,
    setShowExitConfirm, handleCloseChallengeModal,
  } = props;

  // Share-link feedback toast
  const [shareToast, setShareToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setShareToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShareToast(null), 2200);
  };
  const handleShare = async () => {
    if (typeof window === "undefined" || !matchId) return;
    const url = `${window.location.origin}/watch/${matchId}`;
    // Mobile: native share sheet. Desktop / no support: copy to clipboard.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "HashClout", text: "Watch my debate live on HashClout", url });
        return;
      } catch (err: any) {
        if (err && err.name === "AbortError") return; // user dismissed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied!");
    } catch {
      showToast("Couldn't copy link");
    }
  };

  const likes = emojiCounts["👍"] || 0;
  const dislikes = emojiCounts["👎"] || 0;

  return (
    <div className="video-debate">
      <div className={`video-stage ${stageClass}`}>

        {/* Self video feed */}
        <video
          ref={selfVideoRef}
          autoPlay muted playsInline
          className={`stage-feed stage-feed-self ${(showSelf && cameraVisible) ? "" : "sf-hidden"}`}
        />

        {/* Self placeholder (when camera hidden) */}
        {showSelf && !cameraVisible && (
          <div className="stage-feed stage-feed-opp">
            <div className="opp-placeholder-inner">
              <div className={`opp-audio-viz ${isUserSpeaking || isRapidFire ? "" : "viz-paused"}`}>
                {[...Array(7)].map((_, i) => <div key={i} className="opp-audio-bar" style={{ animationDelay: `${i * 0.12}s`, background: "linear-gradient(to top, var(--accentA), var(--accentB))" }} />)}
              </div>
              <div className="opp-avatar-big" style={{ background: "rgba(255,77,61,.12)", borderColor: "rgba(255,77,61,.20)" }}><User size={48} /></div>
              <div className="opp-side-label" style={{ color: "#ff7a45" }}>{userSideLabel}</div>
              {isUserSpeaking && <div className="opp-speaking-label">🎤 You&apos;re Speaking…</div>}
              {isRapidFire && <div className="opp-speaking-label">⚡ Rapid Fire</div>}
            </div>
          </div>
        )}

        {/* Opponent video feed (LiveKit remote) or placeholder fallback */}
        <div className={`stage-feed stage-feed-opp ${showOpp ? "" : "sf-hidden"}`}>
          {remoteVideoTrack ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div className="opp-side-label" style={{ position: "absolute", top: 92, left: "50%", transform: "translateX(-50%)" }}>{oppSideLabel}</div>
            </>
          ) : (
            <div className="opp-placeholder-inner">
              <div className={`opp-audio-viz ${isOppSpeaking || isRapidFire ? "" : "viz-paused"}`}>
                {[...Array(7)].map((_, i) => <div key={i} className="opp-audio-bar" style={{ animationDelay: `${i * 0.12}s` }} />)}
              </div>
              <div className="opp-avatar-big"><User size={48} /></div>
              <div className="opp-side-label">{oppSideLabel}</div>
              {isOppSpeaking && <div className="opp-speaking-label">🎤 Speaking…</div>}
              {isRapidFire && <div className="opp-speaking-label">⚡ Rapid Fire</div>}
              {isCountdownPhase && showOpp && <div className="opp-speaking-label">Getting ready…</div>}
              {connected && !remoteVideoTrack && <div className="opp-speaking-label">Waiting for opponent&apos;s camera…</div>}
            </div>
          )}
        </div>
        <audio ref={remoteAudioRef} autoPlay />

        {/* ROUND INTRO SPLASH */}
        {isIntroPhase && (
          <div className="round-splash">
            <div className="round-splash-num">ROUND {roundInfo.num}</div>
            <div className="round-splash-title">{roundInfo.title}</div>
            <div className="round-splash-bar" />
            <div className="round-splash-desc">{roundInfo.desc}</div>
          </div>
        )}

        {/* COUNTDOWN OVERLAY */}
        {isCountdownPhase && (
          <div className="video-countdown-overlay">
            <div className="video-countdown-num" key={phaseTimer}>{phaseTimer}</div>
            <div className="video-countdown-label">{showSelf ? "Your turn — get ready" : "Opponent up next"}</div>
          </div>
        )}

        {/* HUD TOP */}
        {isActivePhase && (
          <div className="video-hud-top" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 }}>
            <div className={`vturn-badge ${isUserSpeaking ? "vturn-you" : isRapidFire ? "vturn-rapid" : "vturn-opp"}`}>
              {isUserSpeaking
                ? <><Mic size={14} /> YOUR TURN</>
                : isRapidFire
                  ? <><Zap size={14} /> RAPID FIRE</>
                  : <><Ear size={14} /> LISTENING</>}
            </div>
            <div className="video-hud-timer">
              <CircleTimer seconds={phaseTimer} max={phaseMax} />
            </div>
          </div>
        )}

        {/* CAMERA TOGGLE (top-right) */}
        {isActivePhase && (
          <button onClick={(e) => { e.stopPropagation(); setCameraVisible(!cameraVisible); }} className="camera-toggle-btn" style={{
            position: "absolute", zIndex: 22,
            width: 44, height: 44, borderRadius: 14,
            background: "rgba(10,10,16,.55)", backdropFilter: "blur(10px)",
            border: `1px solid ${cameraVisible ? "rgba(34,197,94,.45)" : "rgba(255,255,255,.16)"}`,
            color: cameraVisible ? "#fff" : "rgba(255,255,255,.55)",
            cursor: "pointer", display: "grid", placeItems: "center",
            transition: "all .2s", boxShadow: "0 4px 16px rgba(0,0,0,.4)",
            top: 14, right: 16, bottom: "auto",
          }}>
            {cameraVisible ? <Video size={18} /> : <VideoOff size={18} />}
            {cameraVisible && <span style={{ position: "absolute", top: 7, right: 7, width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,.85)" }} />}
          </button>
        )}

        {/* WAITING FOR OPPONENT FACT CHECK */}
        {challengeNotification === "__WAITING__" && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 40,
            background: "rgba(7,7,12,.95)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 20,
          }}>
            <Scale size={40} style={{ color: "#fbbf24", opacity: 0.7 }} />
            <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,.80)", letterSpacing: ".06em" }}>
              FACT CHECK IN PROGRESS
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,.40)", fontWeight: 600 }}>
              Opponent is submitting a fact check...
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", animation: "analyzing-pulse 1.2s ease infinite" }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", animation: "analyzing-pulse 1.2s ease 0.3s infinite" }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", animation: "analyzing-pulse 1.2s ease 0.6s infinite" }} />
            </div>
          </div>
        )}

        {/* CHALLENGE NOTIFICATION BANNER */}
        {challengeNotification && challengeNotification !== "__WAITING__" && isActivePhase && (
          <div className="challenge-notification" style={{
            position: "absolute", top: 92, left: "50%", transform: "translateX(-50%)",
            zIndex: 25, padding: "8px 18px", borderRadius: 12,
            background: "rgba(251,191,36,.12)", border: "1px solid rgba(251,191,36,.30)",
            color: "#fbbf24", fontSize: 13, fontWeight: 800,
            animation: "challenge-notify-in 0.3s ease",
          }}>
            {challengeNotification}
          </div>
        )}

        {/* CHALLENGE QUEUED BADGE */}
        {pendingChallenge && pendingChallenge.challengerIsA === iAmPlayerAVideo && isActivePhase && (
          <div style={{
            position: "absolute", top: 68, right: 16, zIndex: 25,
            padding: "6px 12px", borderRadius: 10,
            background: "rgba(168,85,247,.12)", border: "1px solid rgba(168,85,247,.25)",
            color: "#a855f7", fontSize: 11, fontWeight: 800,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            ⚖️ Challenge Queued
          </div>
        )}

        {/* CHALLENGE TOKEN INDICATOR (yours) */}
        {isActivePhase && (
          <div style={{ position: "absolute", top: 60, left: 16, zIndex: 21 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 11px", borderRadius: 10,
              background: myTokens > 0 ? "rgba(16,12,4,.62)" : "rgba(10,10,16,.55)",
              border: `1px solid ${myTokens > 0 ? "rgba(245,158,11,.60)" : "rgba(255,255,255,.10)"}`,
              backdropFilter: "blur(10px)",
              fontSize: 12, fontWeight: 900,
              color: myTokens > 0 ? "#fcd34d" : "rgba(255,255,255,.40)",
              textShadow: "0 1px 3px rgba(0,0,0,.5)",
            }}>
              <Scale size={13} /> {myTokens}
            </div>
          </div>
        )}

        {/* ═══ CHALLENGE INTERLUDE OVERLAY ═══ */}
        {isChallengeReview && interludeStep > 0 && (
          <div className="challenge-interlude" style={{
            position: "absolute", inset: 0, zIndex: 30,
            background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 16, padding: 24,
            animation: "challenge-fade-in 0.5s ease",
          }}>
            {/* FACT CHECK REVEAL */}
            {(!challengeResult || challengeResult.type === "fact_check") && (
              <>
                {interludeStep >= 1 && (
                  <div style={{ animation: "challenge-drop 0.4s ease" }}>
                    <Scale size={48} style={{ color: "#fbbf24", filter: "drop-shadow(0 0 20px rgba(251,191,36,.4))" }} />
                  </div>
                )}
                {interludeStep >= 1 && (
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: ".12em", color: "#fbbf24", animation: "challenge-type 0.6s ease" }}>
                    FACT CHECK
                  </div>
                )}
                {interludeStep >= 2 && pendingChallengeRef.current && (
                  <div style={{
                    fontSize: 15, color: "rgba(255,255,255,.80)", textAlign: "center",
                    maxWidth: 400, lineHeight: 1.5, animation: "challenge-fade-in 0.4s ease",
                  }}>
                    &ldquo;{pendingChallengeRef.current.claim}&rdquo;
                  </div>
                )}

                {/* BLOCK WINDOW (edge case) */}
                {blockWindow && interludeStep >= 2 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, animation: "challenge-fade-in 0.3s ease" }}>
                    <button onClick={handleBlockChallenge} style={{
                      padding: "12px 24px", borderRadius: 14,
                      background: "rgba(168,85,247,.15)", border: "1px solid rgba(168,85,247,.35)",
                      color: "#a855f7", fontSize: 14, fontWeight: 800,
                      cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 8,
                      transition: "all .2s",
                    }}>
                      <Shield size={16} /> BLOCK ({blockTimer}s)
                    </button>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,.30)" }}>Costs your challenge token</span>
                  </div>
                )}

                {interludeStep >= 3 && !challengeResult && (
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,.50)",
                    letterSpacing: ".08em", animation: "analyzing-pulse 1.5s ease infinite",
                  }}>
                    ANALYZING...
                  </div>
                )}

                {interludeStep >= 4 && challengeResult?.type === "fact_check" && challengeResult.verdict && (
                  <div style={{ animation: "verdict-slam 0.3s ease", textAlign: "center" }}>
                    <div style={{
                      fontSize: 36, fontWeight: 900, letterSpacing: ".06em",
                      color: challengeResult.verdict === "FAKE_NEWS" ? "#ff4d3d"
                        : challengeResult.verdict === "FACTS" ? "#22c55e"
                        : challengeResult.verdict === "STRETCH" ? "#fbbf24"
                        : "rgba(255,255,255,.40)",
                      textShadow: challengeResult.verdict === "FAKE_NEWS" ? "0 0 40px rgba(255,77,61,.5)"
                        : challengeResult.verdict === "FACTS" ? "0 0 40px rgba(34,197,94,.5)"
                        : "none",
                    }}>
                      {challengeResult.verdict === "FAKE_NEWS" ? "🚨 FAKE NEWS"
                        : challengeResult.verdict === "FACTS" ? "✅ FACTS"
                        : challengeResult.verdict === "STRETCH" ? "⚠️ STRETCH"
                        : "🤷 CAN'T VERIFY"}
                    </div>
                    {challengeXpDelta !== 0 && (
                      <div style={{
                        marginTop: 8, fontSize: 16, fontWeight: 800,
                        color: challengeXpDelta > 0 ? "#22c55e" : "#ff4d3d",
                      }}>
                        {challengeXpDelta > 0 ? `+${challengeXpDelta}` : challengeXpDelta} XP
                      </div>
                    )}
                  </div>
                )}

                {interludeStep >= 5 && challengeResult?.context && (
                  <div style={{
                    fontSize: 13, color: "rgba(255,255,255,.55)", textAlign: "center",
                    maxWidth: 350, lineHeight: 1.5, animation: "challenge-fade-in 0.4s ease",
                  }}>
                    {challengeResult.context}
                  </div>
                )}
              </>
            )}

            {/* DENIED REVEAL */}
            {challengeResult?.type === "denied" && (
              <>
                {interludeStep >= 1 && (
                  <div style={{ animation: "challenge-drop 0.4s ease" }}>
                    <Shield size={48} style={{ color: "#a0a0a0", filter: "drop-shadow(0 0 20px rgba(160,160,160,.3))" }} />
                  </div>
                )}
                {interludeStep >= 1 && (
                  <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,.70)" }}>
                    {challengeResult.speakerName === "You" ? (profile?.display_name || profile?.username || "You") : (opponent?.opponentDisplayName || "Opponent")}
                  </div>
                )}
                {interludeStep >= 2 && (
                  <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,.40)", letterSpacing: ".06em" }}>
                    DENIES SAYING:
                  </div>
                )}
                {interludeStep >= 2 && (
                  <div style={{
                    fontSize: 15, color: "rgba(255,77,61,.60)", textDecoration: "line-through",
                    textAlign: "center", maxWidth: 380, lineHeight: 1.5,
                  }}>
                    &ldquo;{challengeResult.claim}&rdquo;
                  </div>
                )}
                {interludeStep >= 3 && (
                  <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,.35)" }}>
                    CHALLENGE VOIDED
                  </div>
                )}
                {interludeStep >= 3 && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.20)" }}>
                    The crowd knows the truth 👀
                  </div>
                )}
              </>
            )}

            {/* BLOCKED REVEAL */}
            {challengeResult?.type === "blocked" && (
              <>
                {interludeStep >= 1 && (
                  <div style={{ animation: "challenge-drop 0.4s ease" }}>
                    <Shield size={48} style={{ color: "#a0a0a0" }} />
                  </div>
                )}
                {interludeStep >= 2 && (
                  <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,.50)" }}>
                    🛡️ BLOCKED
                  </div>
                )}
                {interludeStep >= 3 && (
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,.30)" }}>
                    Challenge voided before verdict
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* BOTTOM ACTION BAR */}
        {isActivePhase && (
          <div className="video-bottom" onClick={e => e.stopPropagation()}>
            {isUserSpeaking ? (
              <>
                <button className="btn-yield" onClick={handleYield}>Done Speaking ⏩</button>
                {canDeny && (
                  <button onClick={handleDenyChallenge} className="vbar-deny">
                    <Shield size={13} /> I NEVER SAID THAT
                  </button>
                )}
              </>
            ) : (
              (canFactCheck || canDeny) && (
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={() => setShowChallengeModal(true)} className="btn-fc-primary">
                    <Scale size={16} /> FACT CHECK
                  </button>
                  {canDeny && (
                    <button onClick={handleDenyChallenge} className="vbar-deny">
                      <Shield size={13} /> I NEVER SAID THAT
                    </button>
                  )}
                </div>
              )
            )}

            {/* Reactions + share */}
            <div className="vbar-actions">
              <button type="button" className="vbar-react" onClick={() => handleEmojiReact("👍")} aria-label="Thumbs up">
                <ThumbsUp size={16} />{likes > 0 && <span>{likes}</span>}
              </button>
              <button type="button" className="vbar-react" onClick={() => handleEmojiReact("👎")} aria-label="Thumbs down">
                <ThumbsDown size={16} />{dislikes > 0 && <span>{dislikes}</span>}
              </button>
              <button type="button" className="vbar-action" onClick={handleShare}>
                <Share2 size={15} /> Share
              </button>
            </div>

            <form className="video-comment-wrap" onSubmit={e => { e.preventDefault(); handleSendVideoComment(); (document.activeElement as HTMLElement)?.blur(); }}>
              <input type="text" className="video-comment-input" value={commentInput} onChange={e => setCommentInput(e.target.value)} placeholder="Type a comment…" enterKeyHint="send" />
              <button type="submit" className="btn-send-comment"><Send size={14} /></button>
              <button type="button" aria-label="Leave debate" onClick={(e) => { e.stopPropagation(); setShowExitConfirm(true); }} className="vbar-exit">×</button>
            </form>
          </div>
        )}

        {/* SHARE TOAST */}
        {shareToast && <div className="vshare-toast">{shareToast}</div>}

        {/* FACT CHECK MODAL */}
        {showChallengeModal && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 35,
            background: "rgba(0,0,0,.80)",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            paddingTop: "15vh", paddingLeft: 16, paddingRight: 16,
            animation: "challenge-fade-in 0.2s ease",
          }} onClick={handleCloseChallengeModal}>
            <div onClick={e => e.stopPropagation()} style={{
              width: "100%", maxWidth: 420, padding: "24px 22px",
              borderRadius: 20, background: "rgba(20,20,28,.95)",
              border: "1px solid rgba(251,191,36,.20)",
              boxShadow: "0 20px 60px rgba(0,0,0,.6)",
            }}>
              {phaseWaiting && (
                <div style={{ padding: "8px 14px", marginBottom: 12, borderRadius: 10, background: "rgba(255,77,61,.08)", border: "1px solid rgba(255,77,61,.18)", color: "#ff7a45", fontSize: 11, fontWeight: 700, textAlign: "center" }}>
                  ⏱ Round timer ended — submit or cancel to continue
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <Scale size={20} style={{ color: "#fbbf24" }} />
                <span style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24" }}>Challenge a Claim</span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.40)", marginBottom: 12 }}>
                What did they say? Keep it short and specific.
              </div>
              <input
                type="text"
                value={challengeInput}
                onChange={e => setChallengeInput(e.target.value)}
                placeholder="Type the exact claim..."
                maxLength={120}
                autoFocus
                style={{
                  width: "100%", height: 48, borderRadius: 14,
                  background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
                  color: "var(--text)", fontFamily: "inherit", fontSize: 14,
                  padding: "0 16px", outline: "none", marginBottom: 8,
                  boxSizing: "border-box",
                }}
                onKeyDown={e => { if (e.key === "Enter" && challengeInput.trim().length >= 12) handleSubmitChallenge(); }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 10, color: challengeInput.length < 12 ? "rgba(255,77,61,.60)" : "rgba(255,255,255,.25)" }}>
                  {challengeInput.length}/120 {challengeInput.length < 12 && challengeInput.length > 0 ? "(min 12)" : ""}
                </span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,.25)" }}>
                  ⚖️ {myTokens} token{myTokens !== 1 ? "s" : ""} remaining
                </span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowChallengeModal(false)} style={{
                  flex: 1, height: 44, borderRadius: 12,
                  background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)",
                  color: "rgba(255,255,255,.50)", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                  cursor: "pointer",
                }}>
                  Cancel
                </button>
                <button onClick={handleSubmitChallenge} disabled={challengeInput.trim().length < 12} style={{
                  flex: 1, height: 44, borderRadius: 12,
                  background: challengeInput.trim().length >= 12 ? "rgba(251,191,36,.15)" : "rgba(255,255,255,.04)",
                  border: `1px solid ${challengeInput.trim().length >= 12 ? "rgba(251,191,36,.30)" : "rgba(255,255,255,.06)"}`,
                  color: challengeInput.trim().length >= 12 ? "#fbbf24" : "rgba(255,255,255,.20)",
                  fontFamily: "inherit", fontSize: 14, fontWeight: 800,
                  cursor: challengeInput.trim().length >= 12 ? "pointer" : "default",
                  letterSpacing: ".04em",
                }}>
                  ⚖️ Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
