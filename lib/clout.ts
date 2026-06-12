/**
 * HashClout — Clout scoring (single, simple, vote-based)
 *
 * ONE visible score: "Clout". A debate's result is decided ONLY by spectator
 * round-votes, which both players read from the same source, so the result is
 * always identical for both sides — no client-side randomness, no double-writes.
 *
 * Flat awards (intentionally small + legible):
 *   Win .............. +25   (decisive win, >=66% of votes: +5 more)
 *   Loss ............. +10
 *   Tie .............. +15
 *   Exhibition ....... +12   (no audience voted — counts as a friendly; no W/L)
 *   Forfeit / leave .. +0
 *
 * Only audience-judged matches (>=1 spectator vote) affect your win/loss record.
 * "Exhibition" covers empty rooms and practice/AI matches: you still earn a
 * little Clout, but nobody is crowned, so the leaderboard stays meaningful.
 */

export const CLOUT_AWARDS = {
  win: 25,
  decisiveWin: 5, // extra, on top of `win`
  loss: 10,
  tie: 15,
  exhibition: 12,
  forfeit: 0,
} as const;

/** Vote share (winner) at/above which a win is "decisive". */
export const DECISIVE_THRESHOLD = 66;

export type CloutOutcome = "win" | "loss" | "tie" | "exhibition" | "forfeit";

export interface VoteResolution {
  outcome: "win" | "loss" | "tie" | "exhibition";
  votePct: number;    // this player's share of votes (0 when no audience)
  totalVotes: number; // total spectator votes cast across all rounds
}

export interface CloutBreakdown {
  outcome: CloutOutcome;
  base: number;          // result award
  decisiveBonus: number; // +5 on a decisive win, else 0
  total: number;         // clout earned this match
  votePct: number;       // winner/own vote share for display
  totalVotes: number;
  countsForRecord: boolean; // did this affect W/L?
}

/**
 * Decide the outcome purely from the shared spectator vote tally.
 * Deterministic: both clients pass the same myVotes/oppVotes and get the same
 * result (from each player's own perspective).
 */
export function resolveFromVotes(myVotes: number, oppVotes: number): VoteResolution {
  const totalVotes = myVotes + oppVotes;
  if (totalVotes === 0) {
    return { outcome: "exhibition", votePct: 0, totalVotes: 0 };
  }
  const votePct = Math.round((myVotes / totalVotes) * 100);
  if (myVotes > oppVotes) return { outcome: "win", votePct, totalVotes };
  if (myVotes < oppVotes) return { outcome: "loss", votePct, totalVotes };
  return { outcome: "tie", votePct, totalVotes };
}

/**
 * Flat Clout award for a resolved outcome.
 */
export function calculateClout(opts: {
  outcome: "win" | "loss" | "tie" | "exhibition";
  votePct: number;
  totalVotes: number;
  forfeit?: boolean;
}): CloutBreakdown {
  if (opts.forfeit) {
    return {
      outcome: "forfeit",
      base: CLOUT_AWARDS.forfeit,
      decisiveBonus: 0,
      total: CLOUT_AWARDS.forfeit,
      votePct: 0,
      totalVotes: opts.totalVotes,
      countsForRecord: true,
    };
  }

  let base = 0;
  let countsForRecord = true;
  switch (opts.outcome) {
    case "win": base = CLOUT_AWARDS.win; break;
    case "loss": base = CLOUT_AWARDS.loss; break;
    case "tie": base = CLOUT_AWARDS.tie; break;
    case "exhibition": base = CLOUT_AWARDS.exhibition; countsForRecord = false; break;
  }

  const decisiveBonus =
    opts.outcome === "win" && opts.votePct >= DECISIVE_THRESHOLD ? CLOUT_AWARDS.decisiveWin : 0;

  return {
    outcome: opts.outcome,
    base,
    decisiveBonus,
    total: base + decisiveBonus,
    votePct: opts.votePct,
    totalVotes: opts.totalVotes,
    countsForRecord,
  };
}

/** Human-friendly label for a result. */
export function outcomeLabel(outcome: CloutOutcome): string {
  switch (outcome) {
    case "win": return "Win";
    case "loss": return "Loss";
    case "tie": return "Draw";
    case "exhibition": return "Exhibition";
    case "forfeit": return "Forfeit";
  }
}
