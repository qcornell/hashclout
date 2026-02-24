"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Eye, EyeOff, User, Flame, Trophy, Send, Clock, Video, VideoOff } from "lucide-react";
import Image from "next/image";
import MatchmakingQueue from "@/components/MatchmakingQueue";
import { useAuth } from "@/lib/auth-context";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabase";
import { Topic, getFeaturedTopic, getRandomTopic, incrementTopicDebates } from "@/lib/topics";
import { calculateElo, calculateTieElo, type EloResult, type TieResult } from "@/lib/elo";
import { joinQueue, findMatch, subscribeToQueue, leaveQueue, pollForMatch, type MatchResult } from "@/lib/matchmaking";
import { sendDebateMessage, subscribeToMessages, subscribeToMatch, finishMatch, createTypingChannel, type LiveMessage } from "@/lib/live-debate";
import { useLiveKitRoom, type DataMessage } from "@/lib/livekit-room";
import { moderateMessage } from "@/lib/moderation";
import { calculateXP, checkDailyReset, calculateStreak, type XPBreakdown } from "@/lib/xp";
import { getAllRoundVotes } from "@/lib/round-voting";
import {
  initAudio, soundMatchFound, soundCountdownTick, soundGo, soundRoundTransition,
  soundYourTurn, soundOppTurn, soundTimerWarning, soundTimerCritical,
  soundMessageSent, soundMessageReceived, soundEmojiReact,
  soundVictory, soundDefeat, soundTie, soundXPEarned, soundDebateStart,
  soundClick, soundLockIn,
} from "@/lib/sounds";
import ForfeitGuard from "@/components/ForfeitGuard";

/* ═══ TYPES ═══ */
type GameState = "idle" | "prompted" | "chosen" | "format-select" | "matchmaking" | "searching" | "found" | "debating" | "ended";
type Choice = "yes" | "no" | null;
type DebateFormat = "text" | "video" | null;
type VideoPhase = string | null; // phase keys from PHASE_ORDER

interface Message { id: number; sender: "user" | "opponent" | "system"; text: string; clout?: number; }
interface FloatEmoji { id: number; emoji: string; x: number; }
interface VComment { id: number; sender: "user" | "opponent"; text: string; }

/* ═══ CONSTANTS ═══ */
const REACTION_EMOJIS = ["👍", "👎", "🔥", "💯", "😂", "🤯"];

const OPP_COMMENTS_POOL = [
  "That's a stretch…", "Facts!", "Source?", "Interesting…",
  "Disagree", "Fair point", "Not buying it", "Say more…",
  "Weak argument", "Based", "Cope", "Real talk",
];

/* Generic opponent responses for simulated debates (used until real multiplayer) */
const YES_SIDE_RESPONSES = [
  "That's a strong point, but the evidence actually suggests the opposite when you look at the data.",
  "I understand your position, but you're overlooking the systemic issues at play here.",
  "History has shown us repeatedly that this approach doesn't work. We need real change.",
  "The status quo isn't working for the majority of people affected by this issue.",
  "Multiple studies and expert analyses support the case for reform here.",
  "You're making an emotional argument. Let's look at what the facts actually show.",
  "Other countries have already solved this problem. We just need the political will.",
  "The cost of inaction far outweighs the cost of the changes being proposed.",
];

const NO_SIDE_RESPONSES = [
  "That sounds good in theory, but the practical implications would be devastating.",
  "You're oversimplifying a complex issue. The current system exists for important reasons.",
  "Every major reform attempt along these lines has created more problems than it solved.",
  "The data you're citing is cherry-picked. The full picture tells a different story.",
  "Individual freedom and personal responsibility should be the foundation of this debate.",
  "There's a reason most experts in this field advocate for gradual reform, not radical change.",
  "The unintended consequences of what you're proposing would hurt the people you're trying to help.",
  "Stability and proven systems matter. We shouldn't tear things down without a better plan.",
];

/**
 * Video phase system:
 * - "a" phases = Player A's turn, "b" phases = Player B's turn
 * - Each client maps these to "you" or "opp" based on whether they are player A or B
 * - This ensures both clients agree on the phase order even in live 1v1
 *
 * Canonical order (shared between both players):
 *   R1: intro → a-countdown → a-speaking → b-countdown → b-speaking
 *   R2: intro → active (both)
 *   R3: intro → b-countdown → b-speaking → a-countdown → a-speaking (opponent first, you last)
 */
const PHASE_DURATIONS: Record<string, number> = {
  "r1-intro": 3, "r1-a-countdown": 5, "r1-a-speaking": 60,
  "r1-b-countdown": 3, "r1-b-speaking": 60,
  "r2-intro": 3, "r2-active": 120,
  "r3-intro": 3, "r3-b-countdown": 5, "r3-b-speaking": 60,
  "r3-a-countdown": 3, "r3-a-speaking": 60,
};

const PHASE_ORDER: string[] = [
  "r1-intro", "r1-a-countdown", "r1-a-speaking",
  "r1-b-countdown", "r1-b-speaking",
  "r2-intro", "r2-active",
  "r3-intro", "r3-b-countdown", "r3-b-speaking",
  "r3-a-countdown", "r3-a-speaking",
];

function getNextPhase(phase: string): string {
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return "END";
  return PHASE_ORDER[idx + 1];
}

/* ═══ HELPERS ═══ */
function formatTime(s: number) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`; }
/**
 * Clout scoring: rewards substance over rambling.
 * - Very short (<15 chars): low effort → 2
 * - Short punchy (15-60): could be impactful → 8
 * - Medium (60-150): solid argument range → 12-15
 * - Long (150-300): thorough → 12 (slight diminishing)
 * - Rambling (300+): penalized for bloat → 8
 * Also gives bonus for question marks (engaging) and penalizes repetitive filler.
 */
function calcClout(text: string) {
  const t = text.trim();
  const l = t.length;

  // Base clout by length (inverted U-curve)
  let clout = l < 15 ? 2 : l < 60 ? 8 : l < 150 ? 15 : l < 300 ? 12 : 8;

  // Bonus: asking questions shows engagement (+2)
  if (t.includes("?")) clout += 2;

  // Bonus: uses data/evidence language (+1)
  if (/\b(study|percent|data|evidence|research|according|statistic)/i.test(t)) clout += 1;

  return Math.min(18, clout);
}

function CircleTimer({ seconds, max }: { seconds: number; max: number }) {
  const r = 22, c = 2 * Math.PI * r;
  const pct = max > 0 ? seconds / max : 0;
  const offset = c * (1 - pct);
  const low = seconds <= 10;
  return (
    <div className="ctimer">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3" />
        <circle cx="28" cy="28" r={r} fill="none"
          stroke={low ? "var(--accentA)" : "var(--accentB)"}
          strokeWidth="3" strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 28 28)"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span className={`ctimer-text ${low ? "ctimer-low" : ""}`}>{seconds}</span>
    </div>
  );
}

/* ═══ SVG ICONS ═══ */
function TextBattleIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="32" height="28" rx="4" stroke="url(#textGrad)" strokeWidth="2.2" fill="none"/>
      <line x1="10" y1="14" x2="30" y2="14" stroke="url(#textGrad)" strokeWidth="2" strokeLinecap="round"/>
      <line x1="10" y1="20" x2="26" y2="20" stroke="url(#textGrad)" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <line x1="10" y1="26" x2="20" y2="26" stroke="url(#textGrad)" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
      <rect x="28" y="22" width="6" height="8" rx="1.5" fill="url(#textGrad)" opacity="0.5"/>
      <defs>
        <linearGradient id="textGrad" x1="4" y1="6" x2="36" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff4d3d"/>
          <stop offset="1" stopColor="#ff7a45"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function VideoBattleIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="8" width="24" height="24" rx="4" stroke="url(#vidGrad)" strokeWidth="2.2" fill="none"/>
      <path d="M30 14l7-4v20l-7-4V14z" fill="url(#vidGrad)" opacity="0.6"/>
      <circle cx="15" cy="20" r="4" stroke="url(#vidGrad)" strokeWidth="2" fill="none" opacity="0.5"/>
      <circle cx="15" cy="20" r="1.5" fill="url(#vidGrad)" opacity="0.7"/>
      <defs>
        <linearGradient id="vidGrad" x1="3" y1="8" x2="37" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#352161"/>
          <stop offset="1" stopColor="#a855f7"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function Home() {
  /* ─── auth ─── */
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);

  /* ─── topic ─── */
  const [topic, setTopic] = useState<Topic | null>(null);
  const [topicLoading, setTopicLoading] = useState(true);

  /* ─── elo + xp result ─── */
  const [eloDelta, setEloDelta] = useState<number>(0);
  const [xpResult, setXpResult] = useState<XPBreakdown | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [matchOutcome, setMatchOutcome] = useState<"win" | "lose" | "tie" | null>(null);

  /* ─── topic suggestion ─── */
  const [suggestionInput, setSuggestionInput] = useState("");
  const [suggestionSent, setSuggestionSent] = useState(false);
  const [noMoreTopics, setNoMoreTopics] = useState(false);
  const [suggestGlow, setSuggestGlow] = useState(false);

  /* ─── video privacy ─── */
  const [cameraVisible, setCameraVisible] = useState(false); // off by default for privacy
  const [iAmPlayerAVideo, setIAmPlayerAVideo] = useState(true); // for video phase mapping
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  /* ─── custom debate settings (unlocked at 1M clout or 10K followers) ─── */
  const [showCustomize, setShowCustomize] = useState(false);
  const [customRapidRounds, setCustomRapidRounds] = useState(1); // default 1 rapid fire round
  const [customRoundTime, setCustomRoundTime] = useState(60); // seconds, default 60, max 300
  const UNLOCK_ELO = 1000000;
  const UNLOCK_FOLLOWERS = 10000;
  const isUnlocked = (profile?.elo_rating || 0) >= UNLOCK_ELO || (profile as any)?.followers_count >= UNLOCK_FOLLOWERS;

  /* ─── matchmaking ─── */
  const [queueId, setQueueId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<MatchResult | null>(null);
  const queueUnsubRef = useRef<(() => void) | null>(null);
  const queuePollRef = useRef<(() => void) | null>(null);

  /* ─── live debate ─── */
  const [isLiveMatch, setIsLiveMatch] = useState(false);
  const [oppTyping, setOppTyping] = useState(false);
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const msgUnsubRef = useRef<(() => void) | null>(null);
  const matchUnsubRef = useRef<(() => void) | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof createTypingChannel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /* ─── ambient state ─── */
  const [onlineCount, setOnlineCount] = useState(2846);
  const [liveCount, setLiveCount] = useState(142);
  const [yesPct, setYesPct] = useState(62);
  const [totalVotes, setTotalVotes] = useState(14283);
  const [activeTab, setActiveTab] = useState("live");

  /* ─── core game state ─── */
  const [gameState, setGameState] = useState<GameState>("idle");
  const [choice, setChoice] = useState<Choice>(null);
  const [debateFormat, setDebateFormat] = useState<DebateFormat>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [hintFading, setHintFading] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [permissionState, setPermissionState] = useState<string | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  /* ─── text debate state ─── */
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [userClout, setUserClout] = useState(0);
  const [opponentClout, setOpponentClout] = useState(0);
  const [debateTimer, setDebateTimer] = useState(180);
  const [responseIdx, setResponseIdx] = useState(0);

  /* ─── video debate state ─── */
  const [videoPhase, setVideoPhase] = useState<VideoPhase>(null);
  const [phaseTimer, setPhaseTimer] = useState(0);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatEmoji[]>([]);
  const [videoComments, setVideoComments] = useState<VComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [viewerCount, setViewerCount] = useState(35);
  const [emojiCounts, setEmojiCounts] = useState<Record<string, number>>({ "👍": 0, "👎": 0, "🔥": 0, "💯": 0, "😂": 0, "🤯": 0 });
  const [userSpeakTime, setUserSpeakTime] = useState(0);
  const [sentimentPct, setSentimentPct] = useState(52);

  /* ─── LiveKit ─── */
  const livekit = useLiveKitRoom();
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  /* ─── refs ─── */
  const arenaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selfVideoRef = useRef<HTMLVideoElement>(null);
  const debateInitRef = useRef(false);
  const opponentTypingRef = useRef(false);

  /* ═══ DERIVED ═══ */
  const yesRounded = Math.round(yesPct);
  const noRounded = 100 - yesRounded;
  const isLanding = ["idle", "prompted", "chosen", "format-select", "searching", "found"].includes(gameState);
  const isMatchmaking = gameState === "matchmaking";
  const isChoiceMade = ["chosen", "format-select", "searching", "found"].includes(gameState);
  const isSearchPhase = ["searching", "found"].includes(gameState);
  const userSideLabel = choice === "yes" ? (topic?.yes_label || "YES") : (topic?.no_label || "NO");
  const oppSideLabel = choice === "yes" ? (topic?.no_label || "NO") : (topic?.yes_label || "YES");
  const topicTitle = topic?.title || "";
  const topicDesc = topic?.description || "";
  const topicReady = !topicLoading && !!topic;

  // Video phase helpers — map canonical A/B phases to user/opp based on which player we are
  const myLetter = iAmPlayerAVideo ? "a" : "b";
  const oppLetter = iAmPlayerAVideo ? "b" : "a";
  const vp = videoPhase || "";
  const isIntroPhase = vp.endsWith("-intro");
  const isMyCountdown = vp.endsWith(`-${myLetter}-countdown`);
  const isOppCountdown = vp.endsWith(`-${oppLetter}-countdown`);
  const isCountdownPhase = isMyCountdown || isOppCountdown;
  const isUserSpeaking = vp.endsWith(`-${myLetter}-speaking`);
  const isOppSpeaking = vp.endsWith(`-${oppLetter}-speaking`);
  const isRapidFire = vp === "r2-active";
  const isActivePhase = isUserSpeaking || isOppSpeaking || isRapidFire;
  const showSelf = isMyCountdown || isUserSpeaking;
  const showOpp = isOppCountdown || isOppSpeaking || isRapidFire;

  const getRoundInfo = () => {
    if (!videoPhase) return { num: 1, title: "OPENING STATEMENTS", desc: "1 minute each — opponent is muted" };
    if (vp.startsWith("r1")) return { num: 1, title: "OPENING STATEMENTS", desc: "1 minute each — opponent is muted" };
    if (vp.startsWith("r2")) return { num: 2, title: "RAPID FIRE", desc: "Both mics active — 2 minutes" };
    return { num: 3, title: "CLOSING STATEMENTS", desc: "1 minute each — make your final case" };
  };
  const roundInfo = getRoundInfo();
  const phaseMax = PHASE_DURATIONS[videoPhase || ""] || 60;

  // Stage glow classes
  let stageClass = "";
  if (showSelf && !isCountdownPhase) stageClass = "stage-glow-you";
  else if (showSelf && isCountdownPhase) stageClass = "stage-pulse";
  else if (showOpp && isCountdownPhase) stageClass = "stage-pulse-opp";
  else if (showOpp && !isRapidFire) stageClass = "stage-glow-opp";
  else if (isRapidFire) stageClass = "stage-glow-rapid";

  const userMsgCount = messages.filter(m => m.sender === "user").length;
  // matchOutcome is set by the save-results effect (async, vote-aware for live matches)
  // Falls back to clout comparison for display before the effect runs
  const isWin = matchOutcome === "win" || (matchOutcome === null && userClout > opponentClout);
  const isTie = matchOutcome === "tie" || (matchOutcome === null && userClout === opponentClout);
  const totalRounds = 2 + customRapidRounds;
  const roundDuration = customRoundTime;
  const textCurrentRound = Math.max(1, totalRounds - Math.floor(debateTimer / roundDuration));

  const appClass = [
    "app",
    ["prompted", "chosen", "format-select", "searching", "found"].includes(gameState) ? "app-prompted" : "",
    gameState === "debating" ? "app-debating" : "",
    gameState === "debating" && debateFormat === "video" ? "app-video" : "",
    gameState === "ended" ? "app-ended" : "",
  ].filter(Boolean).join(" ");

  /* ═══ LOAD TOPIC ═══ */
  useEffect(() => {
    getFeaturedTopic().then(t => {
      if (t) setTopic(t);
      setTopicLoading(false);
    }).catch(() => {
      setTopicLoading(false);
    });
  }, []);

  /* ═══ MOBILE VIEWPORT FIX ═══ */
  useEffect(() => {
    if (gameState !== "debating") return;

    // Lock body scroll during debate
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.top = "0";

    // Handle mobile keyboard resize via visualViewport
    const vv = window.visualViewport;
    if (vv) {
      const handler = () => {
        document.documentElement.style.setProperty("--vvh", `${vv.height}px`);
      };
      vv.addEventListener("resize", handler);
      vv.addEventListener("scroll", handler);
      handler();

      return () => {
        vv.removeEventListener("resize", handler);
        vv.removeEventListener("scroll", handler);
        document.documentElement.style.removeProperty("--vvh");
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.top = "";
      };
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
    };
  }, [gameState]);

  /* ═══ AMBIENT EFFECTS ═══ */
  useEffect(() => {
    const a = setInterval(() => setOnlineCount(p => p + Math.floor(Math.random() * 20) - 10), 3200);
    const b = setInterval(() => setLiveCount(p => p + Math.floor(Math.random() * 6) - 3), 4100);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  useEffect(() => {
    const i = setInterval(() => {
      setYesPct(p => Math.max(45, Math.min(75, p + (Math.random() - 0.48) * 1.2)));
      setTotalVotes(p => p + Math.floor(Math.random() * 8) + 1);
    }, 2400);
    return () => clearInterval(i);
  }, []);

  // Snapshot state into refs so the save-results effect always reads fresh values
  const userCloutRef = useRef(userClout);
  const opponentCloutRef = useRef(opponentClout);
  const isLiveMatchRef = useRef(isLiveMatch);
  const profileRef = useRef(profile);
  useEffect(() => { userCloutRef.current = userClout; }, [userClout]);
  useEffect(() => { opponentCloutRef.current = opponentClout; }, [opponentClout]);
  useEffect(() => { isLiveMatchRef.current = isLiveMatch; }, [isLiveMatch]);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  /* ═══ SAVE MATCH RESULTS + XP + ELO ═══ */
  useEffect(() => {
    if (gameState !== "ended" || !user) return;

    // Read latest values from refs to avoid stale closures
    const curUserClout = userCloutRef.current;
    const curOppClout = opponentCloutRef.current;
    const curIsLive = isLiveMatchRef.current;
    const curProfile = profileRef.current;
    const curOpponent = opponentRef.current;
    const curMatchId = matchIdRef.current;

    // If no matchId, create one for tracking
    if (!curMatchId) {
      (async () => {
        if (topic) {
          const { data: m } = await supabase.from("matches").insert({
            mode: "debate", topic: topic.title, player_a: user.id, player_b: null, status: "finished",
            finished_at: new Date().toISOString(), winner: curUserClout > curOppClout ? user.id : null,
          }).select().single();
          if (m) setMatchId(m.id);
        }
      })();
      return; // will re-trigger when matchId is set
    }

    // For live matches with spectators, use vote-based winner.
    // For AI matches, fall back to clout.
    (async () => {
    // Check if match is already finalized (other client wrote first)
    const { data: existingMatch } = await supabase.from("matches").select("status, winner, player_a").eq("id", curMatchId).single();
    const alreadyFinished = existingMatch?.status === "finished" || existingMatch?.status === "final";
    const iAmPlayerA = existingMatch?.player_a === user.id;

    let won = curUserClout > curOppClout;
    let tied = curUserClout === curOppClout;
    let realVotePct = won ? 65 : 35; // default for AI matches

    if (curIsLive && curOpponent) {
      if (alreadyFinished && existingMatch?.winner) {
        // Other client already wrote the result — use their winner
        won = existingMatch.winner === user.id;
        tied = false;
      } else {
        // We're first to finish — fetch actual votes
        try {
          const allVotes = await getAllRoundVotes(curMatchId);
          let userVotes = 0;
          let oppVotes = 0;
          for (const roundVotes of Object.values(allVotes)) {
            userVotes += roundVotes[user.id] || 0;
            oppVotes += roundVotes[curOpponent.opponentId] || 0;
          }
          const totalVotesCount = userVotes + oppVotes;
          if (totalVotesCount > 0) {
            realVotePct = Math.round((userVotes / totalVotesCount) * 100);
            won = userVotes > oppVotes;
            tied = userVotes === oppVotes;
          }
        } catch {}
      }
    }

    // Set outcome for UI
    setMatchOutcome(won ? "win" : tied ? "tie" : "lose");

    // Play result sounds
    if (won) soundVictory();
    else if (tied) soundTie();
    else soundDefeat();
    setTimeout(() => soundXPEarned(), 1200);

    // Only write match status if not already finished (prevent double-write)
    if (!alreadyFinished) {
      supabase.from("matches").update({
        status: "finished",
        finished_at: new Date().toISOString(),
        winner: won ? user.id : (curIsLive && curOpponent && !tied) ? curOpponent.opponentId : null,
      }).eq("id", curMatchId).then(() => {});
    }

    // Calculate ELO — use real opponent data if available, else simulated
    const oppElo = curOpponent?.opponentElo || 1000;
    const oppBattles = 50; // Assume established for sim opponents

    if (curProfile) {
      let delta = 0;

      // --- ELO ---
      const updates: Record<string, any> = {
        total_battles: curProfile.total_battles + 1,
      };

      if (tied) {
        const tie = calculateTieElo(curProfile.elo_rating, oppElo, curProfile.total_battles, oppBattles);
        delta = tie.playerADelta;
        updates.elo_rating = tie.playerANewElo;
        updates.win_streak = 0;
      } else if (won) {
        const result = calculateElo(curProfile.elo_rating, oppElo, curProfile.total_battles, oppBattles, curUserClout, curOppClout);
        delta = result.winnerDelta;
        updates.elo_rating = result.winnerNewElo;
        updates.wins = curProfile.wins + 1;
        updates.win_streak = curProfile.win_streak + 1;
      } else {
        const result = calculateElo(oppElo, curProfile.elo_rating, oppBattles, curProfile.total_battles, curOppClout, curUserClout);
        delta = result.loserDelta;
        updates.elo_rating = result.loserNewElo;
        updates.losses = curProfile.losses + 1;
        updates.win_streak = 0;
      }

      setEloDelta(delta);

      // --- XP ---
      const shouldReset = checkDailyReset(curProfile.last_debate_date);
      const dailyCount = shouldReset ? 0 : (curProfile.daily_debate_count || 0);
      const streak = calculateStreak(curProfile.last_debate_date, curProfile.streak_count || 0);

      const xp = calculateXP({
        isWinner: won,
        isLoser: !won && !tied,
        isTie: tied,
        isForfeit: false,
        votePercentage: won ? realVotePct : 0,
        aiQualityBonus: 0,
        dailyDebateCount: dailyCount,
        streakDays: streak,
      });

      setXpResult(xp);

      const xpCol = iAmPlayerA ? "xp_player_a" : "xp_player_b";
      const xpBreakdownCol = iAmPlayerA ? "xp_breakdown_a" : "xp_breakdown_b";
      const feedbackCol = iAmPlayerA ? "ai_feedback_a" : "ai_feedback_b";

      // Update XP + daily tracking
      updates.xp_total = (curProfile.xp_total || 0) + xp.finalXP;
      updates.daily_debate_count = dailyCount + 1;
      updates.last_debate_date = new Date().toISOString();
      updates.streak_count = streak;

      // Store XP breakdown on match
      supabase.from("matches").update({
        [xpCol]: xp.finalXP,
        [xpBreakdownCol]: xp,
      }).eq("id", curMatchId).then(() => {});

      supabase.from("profiles").update(updates).eq("id", user.id).then(() => {
        refreshProfile();
      });

      // --- AI Pipeline (async, non-blocking) ---
      // Skip for AI-only matches (player_b is null) to save API calls
      const isAIMatch = !curIsLive || !curOpponent;
      if (!isAIMatch) {
        setAiProcessing(true);
        fetch("/api/ai-pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId: curMatchId }),
        })
          .then(r => r.json())
          .then(async (data) => {
            setAiProcessing(false);
            if (data.scores && data.ai_quality_bonus > 0) {
              const xpWithAI = calculateXP({
                isWinner: won,
                isLoser: !won && !tied,
                isTie: tied,
                isForfeit: false,
                votePercentage: won ? realVotePct : 0,
                aiQualityBonus: data.ai_quality_bonus,
                dailyDebateCount: dailyCount,
                streakDays: streak,
              });
              const xpDiff = xpWithAI.finalXP - xp.finalXP;
              if (xpDiff > 0) {
                setXpResult(xpWithAI);
                const currentXp = (curProfile.xp_total || 0) + xp.finalXP;
                await supabase.from("profiles").update({
                  xp_total: currentXp + xpDiff,
                }).eq("id", user.id);
                await supabase.from("matches").update({
                  [xpCol]: xpWithAI.finalXP,
                  [xpBreakdownCol]: xpWithAI,
                }).eq("id", curMatchId);
                refreshProfile();
              }
            }
            // Fetch AI feedback
            const { data: updatedMatch } = await supabase
              .from("matches")
              .select(feedbackCol)
              .eq("id", curMatchId)
              .single();
            if (updatedMatch) {
              setAiFeedback((updatedMatch as any)[feedbackCol] || null);
            }
          })
          .catch(() => {
            setAiProcessing(false);
          });
      }
    }
    })(); // end async IIFE
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  /* ═══ LIVE DEBATE SETUP ═══ */
  useEffect(() => {
    if (gameState !== "debating" || !isLiveMatch || !matchId || !user) return;
    console.log("[LIVE] LIVE DEBATE SETUP firing — gameState:", gameState, "isLiveMatch:", isLiveMatch, "matchId:", matchId, "userId:", user.id);

    // Subscribe to real-time messages (with moderation on incoming)
    const unsubMsg = subscribeToMessages(matchId, async (msg: LiveMessage) => {
      if (msg.sender_id === user.id) return; // skip own messages (already added locally)
      // Moderate opponent messages client-side
      const mod = await moderateMessage(msg.content);
      const displayText = mod.flagged ? "[Message removed by content filter]" : msg.content;
      const clout = mod.flagged ? 0 : calcClout(msg.content);
      soundMessageReceived();
      setMessages(prev => [...prev, { id: Date.now() + Math.random(), sender: "opponent", text: displayText, clout }]);
      if (!mod.flagged) setOpponentClout(p => p + clout);
      setOppTyping(false);
    });
    msgUnsubRef.current = unsubMsg;

    // Subscribe to match status (opponent finish, etc)
    const unsubMatch = subscribeToMatch(matchId, (match: any) => {
      if (match.status === "finished") {
        setGameState("ended");
      }
    });
    matchUnsubRef.current = unsubMatch;

    // Set up typing indicator channel
    const typingCh = createTypingChannel(matchId);
    typingCh.onTyping((userId, isTyping) => {
      if (userId !== user.id) {
        setOppTyping(isTyping);
      }
    });
    typingCh.subscribe();
    typingChannelRef.current = typingCh;

    // Determine which player we are (A or B) by checking match record
    // We need to know this for heartbeat + disconnect detection
    let iAmPlayerA = true; // default, will be corrected
    supabase.from("matches").select("player_a").eq("id", matchId).single().then(({ data }) => {
      if (data) iAmPlayerA = data.player_a === user.id;
    });

    // Heartbeat: ping every 10s so opponent knows we're still here
    const heartbeat = setInterval(() => {
      const col = iAmPlayerA ? "player_a_last_active" : "player_b_last_active";
      supabase.from("matches").update({
        [col]: new Date().toISOString(),
      }).eq("id", matchId).then(() => {});
    }, 10000);

    // Disconnect detection: check opponent's last activity every 15s
    let disconnectTimer: NodeJS.Timeout | null = null;
    const checkOpponent = setInterval(async () => {
      const { data: m } = await supabase.from("matches").select("player_a_last_active, player_b_last_active, status").eq("id", matchId).single();
      if (!m || m.status === "finished") return;

      // Read the OPPONENT's activity column (opposite of ours)
      const oppActive = iAmPlayerA ? m.player_b_last_active : m.player_a_last_active;
      if (oppActive) {
        const lastSeen = new Date(oppActive).getTime();
        const stale = Date.now() - lastSeen > 45000; // 45s timeout
        if (stale && !disconnectTimer) {
          // Show warning, give 15s grace
          setMessages(prev => [...prev, { id: Date.now(), sender: "system", text: "⚠️ Opponent may have disconnected. Auto-win in 15s..." }]);
          disconnectTimer = setTimeout(async () => {
            // Auto-win
            await finishMatch(matchId, user.id);
            setGameState("ended");
          }, 15000);
        }
      }
    }, 15000);

    return () => {
      unsubMsg();
      unsubMatch();
      typingCh.unsubscribe();
      clearInterval(heartbeat);
      clearInterval(checkOpponent);
      if (disconnectTimer) clearTimeout(disconnectTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, isLiveMatch, matchId]);

  /* ═══ TEXT DEBATE EFFECTS ═══ */
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, opponentTyping, oppTyping]);

  // Timer — runs for both live and simulated + warning sounds
  useEffect(() => {
    if (gameState !== "debating" || debateFormat !== "text") return;
    const t = setInterval(() => {
      setDebateTimer(prev => {
        if (prev === 31) soundTimerWarning();
        if (prev >= 2 && prev <= 4) soundTimerCritical();
        if (prev <= 1) {
          clearInterval(t);
          // Just transition to ended — the save-results effect handles
          // winner determination (vote-based for live, clout for AI)
          // and writing to the DB. Don't call finishMatch here.
          setGameState("ended");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, debateFormat]);

  // AI opponent init — ONLY for non-live matches
  useEffect(() => {
    if (gameState !== "debating" || debateFormat !== "text" || isLiveMatch) { debateInitRef.current = false; return; }
    if (debateInitRef.current) return;
    debateInitRef.current = true;
    // Set debate timer based on custom settings: (2 + customRapidRounds) rounds * customRoundTime
    const totalTime = (2 + customRapidRounds) * customRoundTime;
    setDebateTimer(totalTime);
    setMessages([{ id: Date.now(), sender: "system", text: `⌨️ Debate started — ${2 + customRapidRounds} rounds, ${Math.floor(customRoundTime / 60)}:${(customRoundTime % 60).toString().padStart(2, "0")} each. Make your opening argument.` }]);

    // AI opens with a topic-aware first message
    const t1 = setTimeout(() => {
      setOpponentTyping(true); opponentTypingRef.current = true;
      fetch("/api/debate-respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicTitle,
          userSide: userSideLabel,
          opponentSide: oppSideLabel,
          messages: [],
        }),
      })
        .then(r => r.json())
        .then(data => {
          const resp = data.reply || (choice === "yes" ? NO_SIDE_RESPONSES : YES_SIDE_RESPONSES)[0];
          const oc = calcClout(resp);
          soundMessageReceived();
          setMessages(prev => [...prev, { id: Date.now(), sender: "opponent", text: resp, clout: oc }]);
          setOpponentClout(p => p + oc); setResponseIdx(1);
          setOpponentTyping(false); opponentTypingRef.current = false;
        })
        .catch(() => {
          soundMessageReceived();
          const pool = choice === "yes" ? NO_SIDE_RESPONSES : YES_SIDE_RESPONSES;
          setMessages(prev => [...prev, { id: Date.now(), sender: "opponent", text: pool[0], clout: 8 }]);
          setOpponentClout(p => p + 8); setResponseIdx(1);
          setOpponentTyping(false); opponentTypingRef.current = false;
        });
    }, 1200);
    return () => clearTimeout(t1);
  }, [gameState, choice, debateFormat, isLiveMatch]);

  // Live match init message
  useEffect(() => {
    if (gameState !== "debating" || debateFormat !== "text" || !isLiveMatch) return;
    if (debateInitRef.current) return;
    debateInitRef.current = true;
    setMessages([{
      id: Date.now(),
      sender: "system",
      text: `⚔️ Live debate started! You're debating ${opponent?.opponentDisplayName || "an opponent"}. Make your case.`,
    }]);
  }, [gameState, debateFormat, isLiveMatch, opponent]);

  /* ═══ VIDEO DEBATE EFFECTS ═══ */

  // Initialize video phase
  useEffect(() => {
    if (gameState === "debating" && debateFormat === "video" && !videoPhase) {
      setVideoPhase("r1-intro");
    }
  }, [gameState, debateFormat, videoPhase]);

  // Connect to LiveKit room when entering video debate
  useEffect(() => {
    if (gameState !== "debating" || debateFormat !== "video" || !matchId || !user || !videoStream) return;
    if (livekit.connected) return;
    console.log("[LIVEKIT] Connecting to room for matchId:", matchId, "userId:", user.id);

    const participantName = profile?.display_name || profile?.username || "Player";
    livekit.connect({
      matchId,
      participantId: user.id,
      participantName,
      videoStream,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, debateFormat, matchId, user, videoStream]);

  // Disconnect LiveKit when debate ends
  useEffect(() => {
    if (gameState === "ended" || gameState === "idle") {
      livekit.disconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // Attach remote video track to the video element
  useEffect(() => {
    if (remoteVideoRef.current && livekit.remoteVideoTrack) {
      const el = remoteVideoRef.current;
      livekit.remoteVideoTrack.attach(el);
      return () => {
        livekit.remoteVideoTrack?.detach(el);
      };
    }
  }, [livekit.remoteVideoTrack]);

  // Attach remote audio track
  useEffect(() => {
    if (livekit.remoteAudioTrack) {
      if (remoteAudioRef.current) {
        const el = remoteAudioRef.current;
        livekit.remoteAudioTrack.attach(el);
        return () => {
          livekit.remoteAudioTrack?.detach(el);
        };
      } else {
        // No ref — attach creates a detached element automatically
        const el = livekit.remoteAudioTrack.attach();
        return () => {
          el.remove();
        };
      }
    }
  }, [livekit.remoteAudioTrack]);

  // Sync camera toggle with LiveKit track muting
  useEffect(() => {
    livekit.setCameraEnabled(cameraVisible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraVisible]);

  // LiveKit: handle incoming data messages (emojis + comments from opponent)
  useEffect(() => {
    livekit.onData((msg: DataMessage, _senderId: string) => {
      if (msg.type === "emoji") {
        addFloatingEmoji(msg.emoji);
        setEmojiCounts(p => ({ ...p, [msg.emoji]: (p[msg.emoji] || 0) + 1 }));
      } else if (msg.type === "comment") {
        setVideoComments(prev => [...prev.slice(-5), { id: Date.now() + Math.random(), sender: "opponent", text: msg.text }]);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine player A/B for video when entering debate
  useEffect(() => {
    if (gameState !== "debating" || debateFormat !== "video" || !matchId || !user) return;
    supabase.from("matches").select("player_a").eq("id", matchId).single().then(({ data }) => {
      if (data) setIAmPlayerAVideo(data.player_a === user.id);
    });
  }, [gameState, debateFormat, matchId, user]);

  // Phase timer & auto-advance + sound effects
  useEffect(() => {
    if (gameState !== "debating" || debateFormat !== "video" || !videoPhase) return;
    const dur = PHASE_DURATIONS[videoPhase] || 0;
    setPhaseTimer(dur);

    // Play sounds on phase entry (use derived booleans)
    if (videoPhase.endsWith("-intro")) {
      soundRoundTransition();
    } else if (videoPhase.endsWith(`-${myLetter}-countdown`)) {
      soundYourTurn();
    } else if (videoPhase.endsWith(`-${oppLetter}-countdown`)) {
      soundOppTurn();
    }

    if (dur === 0) return;

    const interval = setInterval(() => {
      setPhaseTimer(prev => {
        // Timer warning sounds
        if (prev === 11) soundTimerWarning();
        if (prev >= 2 && prev <= 4) soundTimerCritical();

        if (prev <= 1) {
          clearInterval(interval);
          const next = getNextPhase(videoPhase);
          if (next === "END") {
            setTimeout(() => { setGameState("ended"); setVideoPhase(null); }, 0);
          } else {
            setTimeout(() => setVideoPhase(next), 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [videoPhase, gameState, debateFormat, myLetter, oppLetter]);

  // No opponent auto-yield — full timer runs for all phases.

  // Auto clout during speaking
  useEffect(() => {
    if (!isUserSpeaking && !isRapidFire) return;
    const i = setInterval(() => setUserClout(p => p + 1), 5000);
    return () => clearInterval(i);
  }, [isUserSpeaking, isRapidFire]);

  useEffect(() => {
    if (!isOppSpeaking && !isRapidFire) return;
    const i = setInterval(() => setOpponentClout(p => p + 1), 4500);
    return () => clearInterval(i);
  }, [isOppSpeaking, isRapidFire]);

  // Track user speaking time
  useEffect(() => {
    if (!isUserSpeaking && !isRapidFire) return;
    const i = setInterval(() => setUserSpeakTime(p => p + 1), 1000);
    return () => clearInterval(i);
  }, [isUserSpeaking, isRapidFire]);

  // Simulated opponent emojis during user speaking (ONLY for non-live/AI matches)
  useEffect(() => {
    if (!isUserSpeaking || isLiveMatch) return;
    const fire = () => {
      const emoji = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
      addFloatingEmoji(emoji);
    };
    const i = setInterval(fire, 2800 + Math.random() * 3200);
    const t = setTimeout(fire, 1500 + Math.random() * 2000);
    return () => { clearInterval(i); clearTimeout(t); };
  }, [isUserSpeaking, isLiveMatch]);

  // Simulated opponent comments during user speaking (ONLY for non-live/AI matches)
  useEffect(() => {
    if (!isUserSpeaking || isLiveMatch) return;
    const sendComment = () => {
      const text = OPP_COMMENTS_POOL[Math.floor(Math.random() * OPP_COMMENTS_POOL.length)];
      setVideoComments(prev => [...prev.slice(-5), { id: Date.now(), sender: "opponent", text }]);
    };
    const t1 = setTimeout(sendComment, 6000 + Math.random() * 8000);
    const t2 = setTimeout(sendComment, 18000 + Math.random() * 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isUserSpeaking, isLiveMatch]);

  // Simulated audience during rapid fire (ONLY for non-live/AI matches)
  useEffect(() => {
    if (!isRapidFire || isLiveMatch) return;
    const i = setInterval(() => {
      const emoji = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
      addFloatingEmoji(emoji);
    }, 2000 + Math.random() * 2000);
    return () => clearInterval(i);
  }, [isRapidFire, isLiveMatch]);

  // Viewer count simulation
  useEffect(() => {
    if (!videoPhase) return;
    const i = setInterval(() => setViewerCount(p => Math.max(10, p + Math.floor(Math.random() * 8) - 3)), 3000);
    return () => clearInterval(i);
  }, [videoPhase]);

  // Sentiment drift
  useEffect(() => {
    if (!isActivePhase) return;
    const i = setInterval(() => setSentimentPct(p => Math.max(30, Math.min(70, p + (Math.random() - 0.48) * 3))), 2500);
    return () => clearInterval(i);
  }, [isActivePhase]);

  // Attach video stream
  useEffect(() => {
    if (selfVideoRef.current && videoStream) {
      selfVideoRef.current.srcObject = videoStream;
    }
  }, [videoStream, videoPhase, gameState]);

  // Cleanup everything on unmount
  useEffect(() => {
    return () => {
      videoStream?.getTracks().forEach(t => t.stop());
      queueUnsubRef.current?.();
      queuePollRef.current?.();
      msgUnsubRef.current?.();
      matchUnsubRef.current?.();
      typingChannelRef.current?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ═══ HANDLERS ═══ */

  const addFloatingEmoji = useCallback((emoji: string) => {
    const id = Date.now() + Math.random();
    const x = 5 + Math.random() * 25;
    setFloatingEmojis(prev => [...prev.slice(-12), { id, emoji, x }]);
    setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 3200);
  }, []);

  const handleStart = () => {
    if (gameState !== "idle") return;
    initAudio(); // Unlock audio on first interaction
    // Require auth to play (but not while still loading)
    if (!authLoading && !user) {
      setShowAuthModal(true);
      return;
    }
    soundClick();
    setGameState("prompted");
    if (typeof window !== "undefined" && window.innerWidth <= 768)
      setTimeout(() => arenaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    setHintVisible(true); setHintFading(false);
    setTimeout(() => setHintFading(true), 2500);
    setTimeout(() => setHintVisible(false), 3000);
  };

  const handleChoice = (side: "yes" | "no") => {
    if (gameState !== "idle" && gameState !== "prompted") return;
    initAudio();
    // Require auth — if they skipped START and clicked YES/NO directly
    if (!authLoading && !user) { setShowAuthModal(true); return; }
    soundLockIn();
    setChoice(side); setGameState("chosen"); setHintVisible(false);
    setTimeout(() => setGameState("format-select"), 1000);
  };

  const beginSearch = (formatOverride?: "text" | "video") => {
    const fmt = formatOverride || debateFormat;
    if (!user || !profile || !topic || !choice || !fmt) {
      console.warn("beginSearch blocked:", { user: !!user, profile: !!profile, topic: !!topic, choice, fmt });
      // If auth is the only issue, show modal. Otherwise just go to matchmaking with simulated mode.
      if (!user) { setShowAuthModal(true); return; }
      // If topic hasn't loaded yet, still proceed with matchmaking animation
      setGameState("matchmaking");
      return;
    }

    setGameState("matchmaking");

    // Join the matchmaking queue
    joinQueue(user.id, topic, fmt, choice, profile.elo_rating).then(async ({ queueId: qId, error }) => {
      if (error || !qId) { console.error("Queue error:", error); return; }
      setQueueId(qId);

      // Try to find an immediate match
      const match = await findMatch(qId, user.id, topic.id, fmt, choice, profile.elo_rating);
      if (match) {
        setOpponent(match);
        setMatchId(match.matchId);
        if (topic.id) incrementTopicDebates(topic.id);
        return; // MatchmakingQueue component will call onReady after animation
      }

      // No immediate match — subscribe for real-time updates + poll as backup
      const unsub = subscribeToQueue(qId, async (entry) => {
        if (entry.match_id && entry.matched_with) {
          // Someone matched with us! Stop polling.
          queuePollRef.current?.();
          queuePollRef.current = null;
          setMatchId(entry.match_id);
          const { data: oppProfile } = await supabase
            .from("profiles")
            .select("username, display_name, elo_rating")
            .eq("id", entry.matched_with)
            .single();
          setOpponent({
            matchId: entry.match_id,
            opponentId: entry.matched_with,
            opponentSide: choice === "yes" ? "no" : "yes",
            opponentElo: oppProfile?.elo_rating || 1000,
            opponentUsername: oppProfile?.username || "Opponent",
            opponentDisplayName: oppProfile?.display_name || "Opponent",
          });
          if (topic.id) incrementTopicDebates(topic.id);
        }
      });
      queueUnsubRef.current = unsub;

      // Poll every 3s as backup — Realtime can miss events
      const stopPoll = pollForMatch(
        qId, user.id, topic.id, fmt, choice, profile.elo_rating,
        (match) => {
          // Matched via polling — stop Realtime sub
          queueUnsubRef.current?.();
          queueUnsubRef.current = null;
          setOpponent(match);
          setMatchId(match.matchId);
          if (topic.id) incrementTopicDebates(topic.id);
        },
        3000,
      );
      queuePollRef.current = stopPoll;
    });
  };

  // Use refs to always read latest opponent/matchId in the callback
  const opponentRef = useRef(opponent);
  const matchIdRef = useRef(matchId);
  useEffect(() => { opponentRef.current = opponent; }, [opponent]);
  useEffect(() => { matchIdRef.current = matchId; }, [matchId]);

  const handleMatchmakingReady = useCallback(() => {
    // Cleanup queue subscription + polling
    queueUnsubRef.current?.();
    queueUnsubRef.current = null;
    queuePollRef.current?.();
    queuePollRef.current = null;

    // ALWAYS set isLiveMatch true here — both players matched with a real human.
    // Set it BEFORE gameState so effects see isLiveMatch=true on the same render.
    setIsLiveMatch(true);

    soundDebateStart();
    setGameState("debating");
    // Reset scroll to top on debate start
    window.scrollTo(0, 0);
  }, []);

  const queueIdRef = useRef(queueId);
  useEffect(() => { queueIdRef.current = queueId; }, [queueId]);

  const handleMatchmakingCancel = useCallback(() => {
    // Leave queue + cleanup (read from ref for latest value)
    if (queueIdRef.current) leaveQueue(queueIdRef.current);
    queueUnsubRef.current?.();
    queueUnsubRef.current = null;
    queuePollRef.current?.();
    queuePollRef.current = null;
    setQueueId(null);
    setOpponent(null);
    setGameState("format-select");
  }, []);

  const handleFormatSelect = async (format: "text" | "video") => {
    setDebateFormat(format);
    if (format === "video") {
      setPermissionState("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setVideoStream(stream); setPermissionState("granted");
        setTimeout(() => { setPermissionState(null); beginSearch(format); }, 800);
      } catch { setPermissionState("denied"); }
    } else {
      // Text — debateFormat state may not be set yet, pass explicitly
      beginSearch(format);
    }
  };

  const handleFallbackToText = () => { setPermissionState(null); setDebateFormat("text"); beginSearch("text"); };

  // Video: yield remaining time
  const handleYield = () => {
    if (!videoPhase) return;
    const next = getNextPhase(videoPhase);
    if (next === "END") { setGameState("ended"); setVideoPhase(null); }
    else setVideoPhase(next);
  };

  // Video: send emoji reaction
  const handleEmojiReact = (emoji: string) => {
    soundEmojiReact();
    addFloatingEmoji(emoji);
    setEmojiCounts(p => ({ ...p, [emoji]: (p[emoji] || 0) + 1 }));
    setUserClout(p => p + 1);
    // Send to opponent via LiveKit data channel
    if (isLiveMatch) livekit.sendData({ type: "emoji", emoji });
  };

  // Video: send comment
  const handleSendVideoComment = () => {
    if (!commentInput.trim()) return;
    const text = commentInput.trim();
    setVideoComments(prev => [...prev.slice(-5), { id: Date.now(), sender: "user", text }]);
    setUserClout(p => p + 1);
    setCommentInput("");
    // Send to opponent via LiveKit data channel
    if (isLiveMatch) livekit.sendData({ type: "comment", text });
  };

  // Text: handle typing indicator for live matches
  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (isLiveMatch && typingChannelRef.current && user) {
      typingChannelRef.current.sendTyping(user.id, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        typingChannelRef.current?.sendTyping(user.id, false);
      }, 1500);
    }
  };

  // Text: send message
  const handleSendMessage = async () => {
    if (gameState !== "debating" || !inputValue.trim()) return;
    const text = inputValue.trim();
    setModerationWarning(null);

    // Moderate before sending
    const modResult = await moderateMessage(text);
    if (modResult.flagged) {
      setModerationWarning(modResult.message || "Message blocked by content filter.");
      return; // Don't send
    }

    const clout = calcClout(text);

    // Add message locally
    soundMessageSent();
    setMessages(prev => [...prev, { id: Date.now(), sender: "user", text, clout }]);
    setUserClout(p => p + clout);
    setInputValue("");

    // Stop typing indicator
    if (isLiveMatch && typingChannelRef.current && user) {
      typingChannelRef.current.sendTyping(user.id, false);
    }

    if (isLiveMatch && matchId && user) {
      // LIVE: send to Supabase, opponent gets it via subscription
      const round = debateTimer > roundDuration * (totalRounds - 1) ? "opening" : debateTimer > roundDuration ? "rapid_fire" : "closing";
      sendDebateMessage(matchId, user.id, text, round);
    } else {
      // AI OPPONENT: GPT-powered responses
      if (opponentTypingRef.current) return;
      setOpponentTyping(true); opponentTypingRef.current = true;

      // Collect recent messages for context — read from DOM-latest state
      let currentMessages: Message[] = [];
      setMessages(prev => { currentMessages = prev; return prev; });
      const recentMsgs = [...currentMessages, { id: 0, sender: "user" as const, text, clout: 0 }]
        .filter(m => m.sender === "user" || m.sender === "opponent")
        .slice(-6)
        .map(m => ({ sender: m.sender, text: m.text }));

      fetch("/api/debate-respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicTitle,
          userSide: userSideLabel,
          opponentSide: oppSideLabel,
          messages: recentMsgs,
        }),
      })
        .then(r => r.json())
        .then(data => {
          const resp = data.reply || NO_SIDE_RESPONSES[responseIdx % NO_SIDE_RESPONSES.length];
          const oc = calcClout(resp);
          soundMessageReceived();
          setMessages(prev => [...prev, { id: Date.now(), sender: "opponent", text: resp, clout: oc }]);
          setOpponentClout(p => p + oc); setResponseIdx(p => p + 1);
          setOpponentTyping(false); opponentTypingRef.current = false;
        })
        .catch(() => {
          // Fallback to canned response if API fails
          soundMessageReceived();
          const pool = choice === "yes" ? NO_SIDE_RESPONSES : YES_SIDE_RESPONSES;
          const resp = pool[responseIdx % pool.length];
          const oc = 7 + Math.floor(Math.random() * 5);
          setMessages(prev => [...prev, { id: Date.now(), sender: "opponent", text: resp, clout: oc }]);
          setOpponentClout(p => p + oc); setResponseIdx(p => p + 1);
          setOpponentTyping(false); opponentTypingRef.current = false;
        });
    }
  };

  const handleSuggestTopic = async () => {
    if (!suggestionInput.trim() || suggestionSent) return;
    if (!user) { setShowAuthModal(true); return; }
    await supabase.from("topic_suggestions").insert({
      user_id: user.id,
      username: profile?.username || "anonymous",
      title: suggestionInput.trim(),
    });
    setSuggestionSent(true);
    setSuggestionInput("");
    setTimeout(() => setSuggestionSent(false), 3000);
  };

  const handlePlayAgain = () => {
    setGameState("idle"); setChoice(null); setMessages([]); setUserClout(0); setOpponentClout(0);
    setDebateTimer(180); setCountdown(3); setInputValue(""); setOpponentTyping(false);
    opponentTypingRef.current = false; setHintVisible(false); setResponseIdx(0);
    debateInitRef.current = false; setDebateFormat(null); setPermissionState(null);
    setVideoPhase(null); setPhaseTimer(0); setFloatingEmojis([]); setVideoComments([]);
    setCommentInput(""); setViewerCount(35); setUserSpeakTime(0); setSentimentPct(52);
    setEmojiCounts({ "👍": 0, "👎": 0, "🔥": 0, "💯": 0, "😂": 0, "🤯": 0 });
    setMatchId(null); setEloDelta(0); setXpResult(null); setAiFeedback(null); setAiProcessing(false); setMatchOutcome(null); setQueueId(null); setOpponent(null);
    setIsLiveMatch(false); setOppTyping(false); setModerationWarning(null); setCameraVisible(false); setShowExitConfirm(false);
    setShowCustomize(false); setCustomRapidRounds(1); setCustomRoundTime(60);
    queueUnsubRef.current?.(); queueUnsubRef.current = null;
    queuePollRef.current?.(); queuePollRef.current = null;
    msgUnsubRef.current?.(); msgUnsubRef.current = null;
    matchUnsubRef.current?.(); matchUnsubRef.current = null;
    typingChannelRef.current?.unsubscribe(); typingChannelRef.current = null;
    livekit.disconnect();
    if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); setVideoStream(null); }
    // Load a fresh random topic for next round
    getRandomTopic().then(t => { if (t) setTopic(t); });
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <>
      {/* Background */}
      <div className="bg-layer"><div className="bg-dots" /><div className="bg-glow bg-glow-1" /><div className="bg-glow bg-glow-2" /><div className="bg-glow bg-glow-3" /></div>
      <div className="vignette" />

      {hintVisible && <div className={`floating-hint ${hintFading ? "fading" : ""}`}>⚔️ Choose your side to enter the debate</div>}

      {/* FORMAT PICKER */}
      {gameState === "format-select" && (
        <div className="format-overlay">
          <div className="format-picker"><div className="format-picker-inner">
            <div className="format-picker-title">Choose Your Arena</div>
            <div className="format-picker-subtitle">How do you want to battle?</div>
            <div className="format-cards">
              <button className="format-card format-text-card" onClick={() => handleFormatSelect("text")} disabled={permissionState === "requesting"}>
                <div className="format-card-icon-wrap format-icon-text">
                  <TextBattleIcon />
                </div>
                <div className="format-card-title">Text Battle</div>
                <div className="format-card-desc">Type your arguments in real-time. Pure rhetoric.</div>
                <span className="format-card-cta">ENTER TEXT ARENA</span>
              </button>
              <button className="format-card format-video-card" onClick={() => handleFormatSelect("video")} disabled={permissionState === "requesting"}>
                <div className="format-card-icon-wrap format-icon-video">
                  <VideoBattleIcon />
                </div>
                <span className="format-card-badge">LIVE</span>
                <div className="format-card-title">Video Battle</div>
                <div className="format-card-desc">Face-to-face live debate. Camera &amp; mic required.</div>
                <span className="format-card-cta">ENTER LIVE ARENA</span>
              </button>
            </div>
            {permissionState === "requesting" && <div className="perm-status perm-requesting"><div className="perm-spinner" />Requesting camera &amp; mic access…</div>}
            {permissionState === "granted" && <div className="perm-status perm-granted">✅ Permissions granted — entering queue…</div>}
            {permissionState === "denied" && <div className="perm-status perm-denied">❌ Permission denied.<button className="perm-fallback-btn" onClick={handleFallbackToText}>Use Text Instead →</button></div>}

            {/* Customize Debate — teaser or unlocked */}
            <div style={{ marginTop: 20, position: "relative" }}>
              <button onClick={() => setShowCustomize(!showCustomize)} style={{
                width: "100%", padding: "12px 18px", borderRadius: 12,
                background: isUnlocked ? "rgba(255,122,69,.08)" : "rgba(255,255,255,.03)",
                border: `1px solid ${isUnlocked ? "rgba(255,122,69,.18)" : "rgba(255,255,255,.06)"}`,
                color: isUnlocked ? "#ff7a45" : "rgba(255,255,255,.30)",
                fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all .2s",
              }}>
                {isUnlocked ? "⚙️ Customize Rounds & Time" : "🔒 Custom Rounds & Time"}
                <span style={{ fontSize: 10, opacity: 0.6 }}>{showCustomize ? "▲" : "▼"}</span>
              </button>

              {showCustomize && (
                <div style={{
                  marginTop: 10, padding: "20px 22px", borderRadius: 14,
                  background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
                }}>
                  {!isUnlocked ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>🏆</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,.80)", marginBottom: 6 }}>Elite Feature</div>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,.35)", lineHeight: 1.6, marginBottom: 14 }}>
                        Customize rapid fire rounds and round duration. Unlock by reaching:
                      </p>
                      <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                        <div style={{
                          padding: "10px 18px", borderRadius: 10,
                          background: "rgba(255,122,69,.06)", border: "1px solid rgba(255,122,69,.12)",
                          textAlign: "center",
                        }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#ff7a45" }}>1M</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.30)", letterSpacing: ".08em" }}>ELO POINTS</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.20)" }}>OR</div>
                        <div style={{
                          padding: "10px 18px", borderRadius: 10,
                          background: "rgba(168,85,247,.06)", border: "1px solid rgba(168,85,247,.12)",
                          textAlign: "center",
                        }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#a855f7" }}>10K</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.30)", letterSpacing: ".08em" }}>FOLLOWERS</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.20)", marginTop: 12, fontStyle: "italic" }}>
                        Your ELO: {profile?.elo_rating?.toLocaleString() || 0} · Followers: {(profile as any)?.followers_count || 0}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* Rapid Fire Rounds */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.45)", letterSpacing: ".06em", marginBottom: 8 }}>
                          RAPID FIRE ROUNDS
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {[1, 2, 3].map(n => (
                            <button key={n} onClick={() => setCustomRapidRounds(n)} style={{
                              flex: 1, padding: "10px 0", borderRadius: 10,
                              background: customRapidRounds === n ? "rgba(255,122,69,.12)" : "rgba(255,255,255,.03)",
                              border: `1px solid ${customRapidRounds === n ? "rgba(255,122,69,.25)" : "rgba(255,255,255,.06)"}`,
                              color: customRapidRounds === n ? "#ff7a45" : "rgba(255,255,255,.35)",
                              fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer",
                              transition: "all .15s",
                            }}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Round Duration */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.45)", letterSpacing: ".06em" }}>
                            ROUND DURATION
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 900, color: "#ff7a45" }}>
                            {Math.floor(customRoundTime / 60)}:{(customRoundTime % 60).toString().padStart(2, "0")}
                          </span>
                        </div>
                        <input type="range" min={30} max={300} step={15} value={customRoundTime} onChange={e => setCustomRoundTime(Number(e.target.value))} style={{
                          width: "100%", height: 4, appearance: "none", WebkitAppearance: "none",
                          background: `linear-gradient(90deg, #ff7a45 ${((customRoundTime - 30) / 270) * 100}%, rgba(255,255,255,.08) ${((customRoundTime - 30) / 270) * 100}%)`,
                          borderRadius: 2, outline: "none", cursor: "pointer",
                        }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,.20)", marginTop: 4 }}>
                          <span>0:30</span><span>5:00</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div></div>
        </div>
      )}

      {/* MATCHMAKING QUEUE */}
      {isMatchmaking && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(7,7,12,.92)' }}>
          <MatchmakingQueue
            side={choice || 'yes'}
            format={debateFormat || 'text'}
            topic={topicTitle}
            matched={!!opponent}
            onReady={handleMatchmakingReady}
            onCancel={handleMatchmakingCancel}
            onAIFallback={async () => {
              // Cancel queue, create a match record for AI, proceed to debate
              if (queueId) leaveQueue(queueId);
              queueUnsubRef.current?.();
              queueUnsubRef.current = null;
              queuePollRef.current?.();
              queuePollRef.current = null;
              setQueueId(null);
              setOpponent(null);
              setIsLiveMatch(false);

              // Create a match record so XP/ELO/AI pipeline all work
              if (user && topic) {
                const { data: aiMatch } = await supabase
                  .from("matches")
                  .insert({
                    mode: "debate",
                    topic: topic.title,
                    player_a: user.id,
                    player_b: null,
                    status: "live",
                    round: "opening",
                  })
                  .select()
                  .single();
                if (aiMatch) setMatchId(aiMatch.id);
              }

              soundDebateStart();
              setGameState("debating");
              window.scrollTo(0, 0);
            }}
          />
        </div>
      )}

      <div className={appClass}>
        {/* ═══ SIDEBAR ═══ */}
        <aside className="sidebar">
          <div className="brand-section">
            <div className="brand-logo">
              <Image src="/logo.png" alt="HashClout" width={220} height={56} className="brand-logo-img" priority />
            </div>
            <div className="brand-tagline">Hash it out. Earn clout.</div>
            <div className="online-badge"><span className="online-dot" /><span className="online-num">{onlineCount.toLocaleString()}</span><span>online now</span></div>
          </div>
          <button className="btn btn-primary btn-start" onClick={handleStart} disabled={gameState !== "idle"} style={{ opacity: gameState !== "idle" ? 0.4 : 1, cursor: gameState !== "idle" ? "default" : "pointer" }}>
            <Play size={15} fill="white" stroke="white" />START
          </button>
          <button className="btn btn-watch" onClick={() => window.location.href = "/watch"}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Eye size={16} /> Watch Live</span>
            <span className="btn-watch-sub">Browse live debates</span>
          </button>
          <div className="poll-widget">
            <div className="poll-header"><span className="poll-title">Live Sentiment</span><span className="poll-total"><span>{totalVotes.toLocaleString()}</span> votes</span></div>
            <div className="poll-bar-row">
              <div className="poll-option"><div className="poll-option-top"><span className="poll-label"><span className="dot yes-dot" /> {topic?.yes_label || "YES"}</span><span className="poll-pct yes-pct">{yesRounded}%</span></div><div className="poll-track"><div className="poll-fill yes-fill" style={{ width: `${yesRounded}%` }} /></div></div>
              <div className="poll-option"><div className="poll-option-top"><span className="poll-label"><span className="dot no-dot" /> {topic?.no_label || "NO"}</span><span className="poll-pct no-pct">{noRounded}%</span></div><div className="poll-track"><div className="poll-fill no-fill" style={{ width: `${noRounded}%` }} /></div></div>
            </div>
            <div className="poll-votes-label">updating live…</div>
          </div>
          <div className="stats-bar">
            <div className="stat">🔥 <span className="stat-v">{liveCount}</span> live</div>
            <div className="stat">👁 <span className="stat-v">3.2k</span> watching</div>
            <div className="stat">🏆 <span className="stat-v">89k</span> today</div>
          </div>
        </aside>

        {/* ═══ MAIN ═══ */}
        <main className="main">

          {/* ─── LANDING ─── */}
          {isLanding && (
            <>
              <div className="question-card-wrapper" style={{ opacity: topicReady ? 1 : 0, transform: topicReady ? "translateY(0)" : "translateY(12px)", transition: "opacity 0.5s ease, transform 0.5s ease" }}><div className="question-card">
                <div className="q-glow" /><span className="q-sparkle" /><span className="q-sparkle" /><span className="q-sparkle" />
                <div className="q-header">
                  <div className="q-warning"><svg width="44" height="40" viewBox="0 0 40 36" fill="none"><path d="M17.4 2.6c1.1-2 4-2 5.2 0L38.2 30.4c1.1 2-.3 4.6-2.6 4.6H4.4c-2.3 0-3.7-2.5-2.6-4.6L17.4 2.6z" fill="#f59e0b" /><text x="20" y="27" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="20" fontWeight="900" fill="#1a1005">!</text></svg></div>
                  <h1 className="q-title">{topicTitle}</h1>
                </div>
                <div className="q-badge">{topic?.is_featured ? "Featured Debate" : (topic?.category || "Debate")}</div>
                <p className="q-desc">{topicDesc}</p>
              </div></div>

              <div className="arena" ref={arenaRef} style={{ position: "relative" }}>
                {/* Cancel button — only in prompted state */}
                {gameState === "prompted" && (
                  <button onClick={() => setGameState("idle")} style={{
                    position: "absolute", top: -8, right: 0, zIndex: 10,
                    width: 32, height: 32, borderRadius: 999,
                    background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)",
                    color: "rgba(255,255,255,.40)", fontSize: 16, cursor: "pointer",
                    display: "grid", placeItems: "center", transition: "background .15s",
                  }}>×</button>
                )}
                <div className="fighter left">
                  <div className={`avatar-orb ${isSearchPhase ? "orb-searching" : ""}`}>
                    <div className={`ring outer ${isSearchPhase ? "ring-searching" : ""}`} /><div className={`ring mid ${isSearchPhase ? "ring-searching" : ""}`} /><div className={`ring inner ${isSearchPhase ? "ring-searching" : ""}`} />
                    <div className="avatar-core"><User /></div>
                  </div>
                  <button className={`choice-btn choice-yes ${gameState === "prompted" ? "glow-pulse-yes" : ""} ${choice !== null && choice !== "yes" ? "faded" : ""} ${choice === "yes" && isChoiceMade ? "selected-btn" : ""}`} onClick={() => handleChoice("yes")} disabled={gameState !== "idle" && gameState !== "prompted"}>
                    {choice === "yes" && isChoiceMade && <span className="check-icon">✓</span>}YES
                  </button>
                  {isChoiceMade && choice === "yes" ? <div className="locked-in-badge locked-yes">🔒 LOCKED IN</div> : <div className="user-label"><span className="user-dot" /> {profile?.username || "Your Side"}</div>}
                </div>

                <div className="divider"><div className="divider-line" />
                  <div className={`vs-badge ${gameState === "searching" ? "vs-matching" : ""}`}>
                    {gameState === "found" ? <span className="vs-countdown" key={countdown}>{countdown}</span> : gameState === "searching" ? <span className="vs-matching-dot">●</span> : "VS"}
                  </div>
                </div>

                <div className="fighter right">
                  <div className={`avatar-orb ${isSearchPhase ? "orb-searching" : ""}`}>
                    <div className={`ring outer ${isSearchPhase ? "ring-searching" : ""}`} /><div className={`ring mid ${isSearchPhase ? "ring-searching" : ""}`} /><div className={`ring inner ${isSearchPhase ? "ring-searching" : ""}`} />
                    <div className="avatar-core"><User /></div>
                  </div>
                  <button className={`choice-btn choice-no ${gameState === "prompted" ? "glow-pulse-no" : ""} ${choice !== null && choice !== "no" ? "faded" : ""} ${choice === "no" && isChoiceMade ? "selected-btn" : ""}`} onClick={() => handleChoice("no")} disabled={gameState !== "idle" && gameState !== "prompted"}>
                    {choice === "no" && isChoiceMade && <span className="check-icon">✓</span>}NO
                  </button>
                  {isChoiceMade && choice === "no" ? <div className="locked-in-badge locked-no">🔒 LOCKED IN</div> : <div className="user-label"><span className="user-dot" /> Opponent</div>}
                </div>
              </div>

              {gameState === "searching" && <div className="match-status">{debateFormat === "video" ? "Matching you for a video battle…" : "Matching you for a text battle…"}</div>}
              {gameState === "found" && <div className="match-status match-found">⚡ Opponent found!</div>}

              <div className="bottom-bar">
                <button className="btn-next" onClick={() => {
                  getRandomTopic(topic?.id).then(t => {
                    if (t) { setTopic(t); setNoMoreTopics(false); setSuggestGlow(false); }
                    else { setNoMoreTopics(true); setSuggestGlow(true); setTimeout(() => setSuggestGlow(false), 3000); }
                  });
                }}>NEXT TOPIC</button>
                <div className={`chat-wrap ${suggestGlow ? "suggest-glow" : ""}`}>
                  <input type="text" className="chat-input" placeholder={suggestionSent ? "✓ Suggestion sent!" : noMoreTopics ? "No more topics — suggest one!" : "Suggest a topic..."} value={suggestionInput} onChange={e => { setSuggestionInput(e.target.value); setSuggestionSent(false); }} onKeyDown={e => e.key === "Enter" && handleSuggestTopic()} disabled={suggestionSent} />
                  <button className="btn-send" onClick={handleSuggestTopic} disabled={!suggestionInput.trim() || suggestionSent}><Play size={14} fill="white" stroke="white" /></button>
                </div>
              </div>
            </>
          )}

          {/* ─── TEXT DEBATE ─── */}
          {gameState === "debating" && debateFormat === "text" && (
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
          )}

          {/* ─── VIDEO DEBATE — IMMERSIVE ─── */}
          {gameState === "debating" && debateFormat === "video" && (
            <div className="video-debate">
              <div className={`video-stage ${stageClass}`}>

                {/* Self video feed — hidden by default for privacy */}
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
                      {isUserSpeaking && <div className="opp-speaking-label">🎤 You're Speaking…</div>}
                      {isRapidFire && <div className="opp-speaking-label">⚡ Rapid Fire</div>}
                    </div>
                  </div>
                )}

                {/* Opponent video feed (LiveKit remote) or placeholder fallback */}
                <div className={`stage-feed stage-feed-opp ${showOpp ? "" : "sf-hidden"}`}>
                  {livekit.remoteVideoTrack ? (
                    <>
                      <video
                        ref={remoteVideoRef}
                        autoPlay playsInline
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <div className="opp-side-label" style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)" }}>{oppSideLabel}</div>
                      {isOppSpeaking && <div className="opp-speaking-label" style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)" }}>🎤 Speaking…</div>}
                      {isRapidFire && <div className="opp-speaking-label" style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)" }}>⚡ Rapid Fire</div>}
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
                      {livekit.connected && !livekit.remoteVideoTrack && <div className="opp-speaking-label">Waiting for opponent&apos;s camera…</div>}
                    </div>
                  )}
                </div>
                {/* Hidden audio element for opponent's audio */}
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

                {/* HUD TOP — timer centered */}
                {isActivePhase && (
                  <div className="video-hud-top">
                    <div className={`vturn-badge ${isUserSpeaking ? "vturn-you" : isRapidFire ? "vturn-rapid" : "vturn-opp"}`}>
                      {isUserSpeaking ? "🎤 YOUR TURN" : isRapidFire ? "⚡ RAPID FIRE" : "👁 LISTENING"}
                    </div>

                    <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 10 }}>
                      <CircleTimer seconds={phaseTimer} max={phaseMax} />
                    </div>

                    <div className="video-round-pill">R{roundInfo.num}: {roundInfo.title}</div>
                  </div>
                )}

                {/* SENTIMENT, VIEWERS, MIC STATUS — hidden (kept in bottom bar poll instead) */}

                {/* FLOATING EMOJIS */}
                {floatingEmojis.map(fe => (
                  <div key={fe.id} className="emoji-float" style={{ right: `${fe.x}%`, bottom: "110px" }}>{fe.emoji}</div>
                ))}

                {/* COMMENTS OVERLAY */}
                {(isActivePhase || isCountdownPhase) && videoComments.length > 0 && (
                  <div className="video-comments-area">
                    {videoComments.slice(-4).map(vc => (
                      <div key={vc.id} className={`video-comment ${vc.sender === "user" ? "vc-user" : "vc-opp"}`}>
                        <span className="vc-name">{vc.sender === "user" ? "You" : "Opp"}</span>
                        <span className="vc-text">{vc.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* CAMERA TOGGLE — icon only, desktop: bottom-right above exit, mobile: top-right */}
                {isActivePhase && (
                  <button onClick={(e) => { e.stopPropagation(); setCameraVisible(!cameraVisible); }} className="camera-toggle-btn" style={{
                    position: "absolute", zIndex: 22,
                    width: 36, height: 36, borderRadius: 999,
                    background: cameraVisible ? "rgba(34,197,94,.15)" : "rgba(255,255,255,.10)",
                    border: `1px solid ${cameraVisible ? "rgba(34,197,94,.25)" : "rgba(255,255,255,.12)"}`,
                    color: cameraVisible ? "#22c55e" : "rgba(255,255,255,.45)",
                    cursor: "pointer",
                    display: "grid", placeItems: "center",
                    transition: "all .2s",
                    /* Default: desktop position — bottom right above exit */
                    bottom: 56, right: 16, top: "auto",
                  }}>
                    {cameraVisible ? <Video size={16} /> : <VideoOff size={16} />}
                  </button>
                )}

                {/* BOTTOM ACTION BAR */}
                {isActivePhase && (
                  <div className="video-bottom" onClick={e => e.stopPropagation()}>
                    {/* Sentiment poll — compact inline */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "var(--green)" }}>{Math.round(sentimentPct)}%</span>
                      <div style={{ width: 80, height: 3, borderRadius: 2, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 2, background: "var(--green)", width: `${sentimentPct}%`, transition: "width .5s" }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "var(--accentA)" }}>{Math.round(100 - sentimentPct)}%</span>
                    </div>

                    {isUserSpeaking ? (
                      <>
                        <button className="btn-yield" onClick={handleYield}>Done Speaking ⏩</button>
                      </>
                    ) : (
                      <>
                        <div className="emoji-reaction-bar">
                          {REACTION_EMOJIS.map(e => (
                            <button key={e} className="emoji-btn" onClick={() => handleEmojiReact(e)}>
                              {e}
                              {(emojiCounts[e] || 0) > 0 && <span className="emoji-btn-count">{emojiCounts[e]}</span>}
                            </button>
                          ))}
                        </div>
                        <form className="video-comment-wrap" onSubmit={e => { e.preventDefault(); handleSendVideoComment(); (document.activeElement as HTMLElement)?.blur(); }}>
                          <input type="text" className="video-comment-input" value={commentInput} onChange={e => setCommentInput(e.target.value)} placeholder="Type a comment…" enterKeyHint="send" />
                          <button type="submit" className="btn-send-comment"><Send size={14} /></button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setShowExitConfirm(true); }} style={{
                            width: 34, height: 34, flexShrink: 0, borderRadius: 10,
                            background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
                            color: "rgba(255,255,255,.30)", fontSize: 16, cursor: "pointer",
                            display: "grid", placeItems: "center",
                          }}>×</button>
                        </form>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── RESULTS ─── */}
          {gameState === "ended" && (
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
          )}
        </main>
      </div>

      <nav className="tab-bar">
        <button className={`tab-item ${activeTab === "live" ? "active" : ""}`} onClick={() => setActiveTab("live")}><span className="tab-icon"><Flame size={20} /></span><span>LIVE</span></button>
        <button className={`tab-item ${activeTab === "clout" ? "active" : ""}`} onClick={() => setActiveTab("clout")}><span className="tab-icon"><Trophy size={20} /></span><span>CLOUT</span></button>
        <button className={`tab-item ${activeTab === "you" ? "active" : ""}`} onClick={() => setActiveTab("you")}><span className="tab-icon"><User size={20} /></span><span>YOU</span></button>
      </nav>

      {/* Auth modal (triggered when unauthenticated user hits START) */}
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} initialTab="signup" />

      {/* Forfeit guard — blocks navigation during active debates */}
      <ForfeitGuard
        active={gameState === "debating"}
        onForfeit={() => {
          if (matchId && user) {
            finishMatch(matchId, null);
          }
          handlePlayAgain();
        }}
      />

      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(7,7,12,.85)", backdropFilter: "blur(12px)",
        }} onClick={() => setShowExitConfirm(false)}>
          <div style={{
            width: "90%", maxWidth: 340, padding: "32px 24px", borderRadius: 20,
            background: "linear-gradient(180deg, rgba(18,14,22,.98), rgba(10,8,14,.99))",
            border: "1px solid rgba(255,255,255,.08)",
            boxShadow: "0 40px 100px rgba(0,0,0,.6)",
            textAlign: "center",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 6, color: "rgba(255,255,255,.92)" }}>Exit Debate?</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.40)", marginBottom: 20, lineHeight: 1.5 }}>
              Leaving a live match counts as a <strong style={{ color: "#ff4d3d" }}>forfeit</strong>. You'll lose ELO and your opponent wins.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setShowExitConfirm(false)} style={{
                padding: "11px 22px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #ff4d3d, #ff7a45)", color: "#fff",
                fontFamily: "inherit", fontSize: 13, fontWeight: 800, cursor: "pointer",
              }}>Stay</button>
              <button onClick={() => {
                setShowExitConfirm(false);
                if (matchId && user) finishMatch(matchId, null);
                handlePlayAgain();
              }} style={{
                padding: "11px 22px", borderRadius: 12,
                border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)",
                color: "rgba(255,255,255,.45)", fontFamily: "inherit", fontSize: 13,
                fontWeight: 700, cursor: "pointer",
              }}>Leave & Forfeit</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}