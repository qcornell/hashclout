/**
 * HashClout ELO Rating System
 *
 * Standard ELO with adjustments:
 * - K-factor: 40 for new players (<20 battles), 28 for established
 * - Clout differential bonus: dominating wins earn more, close losses lose less
 * - Floor: 100 (can't drop below)
 */

const K_NEW = 32;      // Higher K for new/ranked — faster calibration
const K_ESTABLISHED = 24;
const BATTLE_THRESHOLD = 20; // "new" until this many battles
const ELO_FLOOR = 100;

/** Calculate expected score (probability of winning) */
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Get K-factor based on total battles */
function getK(totalBattles: number): number {
  return totalBattles < BATTLE_THRESHOLD ? K_NEW : K_ESTABLISHED;
}

/**
 * Clout modifier: scales ELO change based on how dominant the win/loss was.
 * - Blowout win (e.g. 50 vs 10 clout): modifier ~1.3 (earn more)
 * - Close win (e.g. 30 vs 28 clout): modifier ~1.0 (standard)
 * - Close loss: modifier ~0.8 (lose less)
 * - Blowout loss: modifier ~1.0 (standard loss)
 */
function cloutModifier(winnerClout: number, loserClout: number): { winnerMod: number; loserMod: number } {
  const total = winnerClout + loserClout;
  if (total === 0) return { winnerMod: 1, loserMod: 1 };

  const dominance = (winnerClout - loserClout) / total; // -1 to 1

  // Winner: bonus for domination (1.0 to 1.35)
  const winnerMod = 1 + Math.max(0, dominance) * 0.35;

  // Loser: reduced penalty for close losses (0.7 to 1.0)
  const loserMod = 1 - Math.max(0, -dominance + 0.5) * 0.3;

  return {
    winnerMod: Math.round(winnerMod * 100) / 100,
    loserMod: Math.max(0.7, Math.round(loserMod * 100) / 100),
  };
}

export interface EloResult {
  winnerNewElo: number;
  loserNewElo: number;
  winnerDelta: number;
  loserDelta: number;
}

export interface TieResult {
  playerANewElo: number;
  playerBNewElo: number;
  playerADelta: number;
  playerBDelta: number;
}

/**
 * Calculate ELO changes after a win/loss.
 */
export function calculateElo(
  winnerElo: number,
  loserElo: number,
  winnerBattles: number,
  loserBattles: number,
  winnerClout: number,
  loserClout: number,
): EloResult {
  const kWinner = getK(winnerBattles);
  const kLoser = getK(loserBattles);

  const expectedWin = expectedScore(winnerElo, loserElo);
  const expectedLose = expectedScore(loserElo, winnerElo);

  const { winnerMod, loserMod } = cloutModifier(winnerClout, loserClout);

  // actual score: 1 for win, 0 for loss
  const winnerDelta = Math.round(kWinner * (1 - expectedWin) * winnerMod);
  const loserDelta = Math.round(kLoser * (0 - expectedLose) * loserMod);

  return {
    winnerNewElo: Math.max(ELO_FLOOR, winnerElo + winnerDelta),
    loserNewElo: Math.max(ELO_FLOOR, loserElo + loserDelta),
    winnerDelta,
    loserDelta,
  };
}

/**
 * Calculate ELO changes for a tie.
 * Higher-rated player loses a tiny bit, lower-rated gains a tiny bit.
 */
export function calculateTieElo(
  playerAElo: number,
  playerBElo: number,
  playerABattles: number,
  playerBBattles: number,
): TieResult {
  const kA = getK(playerABattles);
  const kB = getK(playerBBattles);

  const expectedA = expectedScore(playerAElo, playerBElo);
  const expectedB = expectedScore(playerBElo, playerAElo);

  // Tie = 0.5 actual score
  const deltaA = Math.round(kA * (0.5 - expectedA));
  const deltaB = Math.round(kB * (0.5 - expectedB));

  return {
    playerANewElo: Math.max(ELO_FLOOR, playerAElo + deltaA),
    playerBNewElo: Math.max(ELO_FLOOR, playerBElo + deltaB),
    playerADelta: deltaA,
    playerBDelta: deltaB,
  };
}
