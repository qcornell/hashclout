/**
 * HashClout XP System
 *
 * Debate format: ~6 minutes total
 *   2 × 1min opening
 *   1 × 2min rapid fire
 *   2 × 1min closing
 *
 * XP Base Rules:
 *   +4,000 for completing a debate
 *   -3,000 penalty for leaving early (forfeit)
 *
 * Match Result:
 *   Winner: +12,000
 *   Loser:  +6,000
 *
 * Vote Margin Bonus (winner only):
 *   50–60%: +1,000
 *   60–70%: +3,000
 *   70%+:   +6,000
 *
 * AI Quality Bonus: 0–3,000 (based on quality scores)
 *
 * Daily Diminishing Returns (per user per day):
 *   Debates 1–5:  100% XP
 *   Debates 6–10: 60% XP
 *   Debates 11+:  30% XP
 *
 * Streak Bonus (consecutive days with ≥1 debate):
 *   Day 1–3: +2%
 *   Day 4–7: +5%
 *   Day 7+:  +8%
 *
 * Economy Target: ~50k–70k XP/week, 1M in 12–16 weeks
 */

export interface XPBreakdown {
  base: number;            // +4,000 completion or -3,000 forfeit
  matchResult: number;     // +12,000 win / +6,000 loss / 0 tie
  voteMarginBonus: number; // 0–6,000 (winner only)
  aiQualityBonus: number;  // 0–3,000
  rawTotal: number;        // sum before multipliers
  diminishingMultiplier: number; // 1.0 / 0.6 / 0.3
  streakMultiplier: number;     // 1.02 / 1.05 / 1.08
  finalXP: number;         // final after all multipliers
}

export interface XPInput {
  isWinner: boolean;
  isLoser: boolean;
  isTie: boolean;
  isForfeit: boolean;
  votePercentage: number;     // winner's vote %, 0-100
  aiQualityBonus: number;     // 0-3000 from AI pipeline
  dailyDebateCount: number;   // how many debates today (before this one)
  streakDays: number;         // consecutive days with ≥1 debate
}

/**
 * Get diminishing returns multiplier based on daily debate count.
 * Count is the number of debates BEFORE this one (0-indexed).
 */
function getDiminishingMultiplier(dailyDebateCount: number): number {
  if (dailyDebateCount < 5) return 1.0;
  if (dailyDebateCount < 10) return 0.6;
  return 0.3;
}

/**
 * Get streak bonus multiplier.
 */
function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 7) return 1.08;
  if (streakDays >= 4) return 1.05;
  if (streakDays >= 1) return 1.02;
  return 1.0;
}

/**
 * Get vote margin bonus for winner.
 */
function getVoteMarginBonus(votePercentage: number): number {
  if (votePercentage >= 70) return 6000;
  if (votePercentage >= 60) return 3000;
  if (votePercentage >= 50) return 1000;
  return 0;
}

/**
 * Calculate XP earned from a debate.
 */
export function calculateXP(input: XPInput): XPBreakdown {
  // Base completion XP
  const base = input.isForfeit ? -3000 : 4000;

  // Match result XP
  let matchResult = 0;
  if (!input.isForfeit) {
    if (input.isWinner) matchResult = 12000;
    else if (input.isLoser) matchResult = 6000;
    // Tie = 0 match result bonus
  }

  // Vote margin bonus (winner only, not on forfeit)
  const voteMarginBonus = (input.isWinner && !input.isForfeit)
    ? getVoteMarginBonus(input.votePercentage)
    : 0;

  // AI quality bonus (0 if forfeit or toxic)
  const aiQualityBonus = input.isForfeit ? 0 : Math.min(3000, Math.max(0, input.aiQualityBonus));

  // Raw total before multipliers
  const rawTotal = base + matchResult + voteMarginBonus + aiQualityBonus;

  // If forfeit, no multipliers (just the negative)
  if (input.isForfeit) {
    return {
      base,
      matchResult: 0,
      voteMarginBonus: 0,
      aiQualityBonus: 0,
      rawTotal: base,
      diminishingMultiplier: 1.0,
      streakMultiplier: 1.0,
      finalXP: base, // -3000
    };
  }

  // Apply diminishing returns FIRST
  const diminishingMultiplier = getDiminishingMultiplier(input.dailyDebateCount);

  // Apply streak bonus AFTER diminishing
  const streakMultiplier = getStreakMultiplier(input.streakDays);

  // Final calculation
  const finalXP = Math.round(rawTotal * diminishingMultiplier * streakMultiplier);

  return {
    base,
    matchResult,
    voteMarginBonus,
    aiQualityBonus,
    rawTotal,
    diminishingMultiplier,
    streakMultiplier,
    finalXP,
  };
}

/**
 * Check if the daily debate count should reset (new UTC day).
 * Returns { shouldReset, newCount }
 */
export function checkDailyReset(lastDebateDate: string | null): boolean {
  if (!lastDebateDate) return true;
  const last = new Date(lastDebateDate);
  const now = new Date();
  return last.getUTCFullYear() !== now.getUTCFullYear()
    || last.getUTCMonth() !== now.getUTCMonth()
    || last.getUTCDate() !== now.getUTCDate();
}

/**
 * Check and update streak.
 * Returns the new streak count.
 */
export function calculateStreak(lastDebateDate: string | null, currentStreak: number): number {
  if (!lastDebateDate) return 1; // First debate ever

  const last = new Date(lastDebateDate);
  const now = new Date();

  // Same UTC day = streak unchanged
  const lastDay = Math.floor(last.getTime() / 86400000);
  const today = Math.floor(now.getTime() / 86400000);

  if (today === lastDay) return currentStreak; // Same day, no change
  if (today === lastDay + 1) return currentStreak + 1; // Consecutive day
  return 1; // Streak broken
}
