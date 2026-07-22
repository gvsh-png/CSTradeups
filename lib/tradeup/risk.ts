/**
 * Target win chance → filter band + soft ranking.
 *
 * The UI slider is the win % the user wants (e.g. 60 → ~60% win contracts).
 * A wide band + soft score keeps variation instead of pinning every result
 * to a single win %.
 */

export function clampTargetWin(target: number): number {
  if (!Number.isFinite(target)) return 60;
  return Math.max(0, Math.min(100, target));
}

/** ± points around target — wide enough for real variety in the list */
export const WIN_CHANCE_BAND = 25;

export function winChanceBandFromTarget(targetWin: number): {
  target: number;
  minWinChance: number;
  maxWinChance: number;
} {
  const target = clampTargetWin(targetWin);
  return {
    target,
    minWinChance: Math.max(0, target - WIN_CHANCE_BAND),
    maxWinChance: Math.min(100, target + WIN_CHANCE_BAND),
  };
}

/** @deprecated Use winChanceBandFromTarget — old Risk slider was inverted (60 risk → 40% win). */
export function winChanceBandFromRisk(risk: number) {
  return winChanceBandFromTarget(100 - clampTargetWin(risk));
}

export function clampRisk(risk: number): number {
  return clampTargetWin(risk);
}

/**
 * Soft rank: profit first, mild preference for being near the target.
 * (Hard fit weights used to collapse every result onto one win %.)
 */
export function riskRankScore(
  winPct: number,
  expectedProfit: number,
  targetWinChance: number
): number {
  const dist = Math.abs(winPct - targetWinChance) / 100;
  return expectedProfit - dist * 12;
}

/** Bucket win % into 10pt bins for list diversity */
export function winChanceBucket(winPct: number): number {
  return Math.round(Math.max(0, Math.min(100, winPct)) / 10) * 10;
}
