/**
 * Map UI Risk (0 = safest, 100 = riskiest) to a win-chance target band.
 *
 * Risk only as a minimum floor let high-EV 100% contracts always dominate.
 * A band around the target (and a max) makes the slider actually change results.
 */

export function clampRisk(risk: number): number {
  if (!Number.isFinite(risk)) return 60;
  return Math.max(0, Math.min(100, risk));
}

/** ± points around target win chance */
export const RISK_WIN_BAND = 20;

export function winChanceBandFromRisk(risk: number): {
  /** Preferred win chance % (100 − risk) */
  target: number;
  minWinChance: number;
  maxWinChance: number;
} {
  const r = clampRisk(risk);
  const target = 100 - r;
  return {
    target,
    minWinChance: Math.max(0, target - RISK_WIN_BAND),
    maxWinChance: Math.min(100, target + RISK_WIN_BAND),
  };
}

/**
 * Rank score: prefer contracts near the risk target, then by expected profit.
 * Higher is better.
 */
export function riskRankScore(
  winPct: number,
  expectedProfit: number,
  targetWinChance: number
): number {
  const dist = Math.abs(winPct - targetWinChance) / 100; // 0–1+
  const fit = Math.max(0, 1 - dist);
  return expectedProfit * (0.35 + 0.65 * fit) - dist * 40;
}
