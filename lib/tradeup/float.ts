import { WEAR_RANGES } from "../constants";

export function f32(n: number): number {
  return Math.fround(n);
}

export function norm(f: number, min: number, max: number): number {
  return max <= min ? 0 : f32((f32(f) - f32(min)) / (f32(max) - f32(min)));
}

export function outF(n: number, min: number, max: number): number {
  return f32(f32(min) + f32(n) * f32(f32(max) - f32(min)));
}

export function getWear(float: number): string {
  for (const w of WEAR_RANGES) {
    if (float >= w.min && float < w.max) return w.name;
  }
  return "Battle-Scarred";
}

/**
 * Wear for a float that already sits inside a skin's [minF, maxF].
 * At exact maxF (== a wear boundary like 0.07/0.15/0.38/0.45), plain
 * getWear() returns the *next* tier which has zero intersection with the
 * skin — that used to drop outcomes and (before the EV fix) inflate odds.
 */
export function getWearForSkin(
  float: number,
  minF: number,
  maxF: number
): string {
  const clamped = clampFloat(float, minF, maxF);
  const wear = getWear(clamped);
  if (isWearPossible(minF, maxF, wear, 0.001)) return wear;

  // Prefer the highest possible wear that still intersects the skin caps
  for (let i = WEAR_RANGES.length - 1; i >= 0; i--) {
    const name = WEAR_RANGES[i].name;
    if (isWearPossible(minF, maxF, name, 0.001)) return name;
  }
  return wear;
}

export function getWearFloat(wear: string): number {
  const map: Record<string, number> = {
    "Factory New": 0.035,
    "Minimal Wear": 0.11,
    "Field-Tested": 0.27,
    "Well-Worn": 0.42,
    "Battle-Scarred": 0.7,
  };
  return map[wear] ?? 0.27;
}

export function clampFloat(float: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, float));
}

/**
 * Intersection of an exterior wear band with a skin's [minF, maxF] float cap.
 * Returns null when that wear cannot exist for the skin.
 */
export function wearIntersection(
  minF: number,
  maxF: number,
  wear: string
): { lo: number; hi: number } | null {
  const band = WEAR_RANGES.find((w) => w.name === wear);
  if (!band) return null;
  const lo = Math.max(minF, band.min);
  const hi = Math.min(maxF, band.max);
  if (!(hi > lo)) return null;
  return { lo, hi };
}

/**
 * Wears that actually exist for this skin's float caps.
 * Default `minSpan` (0.01) is for outcomes / pricing lookups.
 * Use INPUT_WEAR_MIN_SPAN for buyable input wears — drops razor-thin
 * edge bands like Well-Worn on Minotaur's Labyrinth (0–0.39).
 */
export const INPUT_WEAR_MIN_SPAN = 0.025;

export function possibleWears(
  minF: number,
  maxF: number,
  minSpan = 0.01
): string[] {
  return WEAR_RANGES.map((w) => w.name).filter((name) => {
    const hit = wearIntersection(minF, maxF, name);
    // Epsilon: 0.08-0.07 is 0.009999… in IEEE float
    return Boolean(hit && hit.hi - hit.lo >= minSpan - 1e-9);
  });
}

/** Midpoint float inside the skin∩wear band, or null if the wear is impossible */
export function floatForWear(
  minF: number,
  maxF: number,
  wear: string
): number | null {
  const hit = wearIntersection(minF, maxF, wear);
  if (!hit) return null;
  return r4((hit.lo + hit.hi) / 2);
}

export function isWearPossible(
  minF: number,
  maxF: number,
  wear: string,
  minSpan = 0.01
): boolean {
  const hit = wearIntersection(minF, maxF, wear);
  return Boolean(hit && hit.hi - hit.lo >= minSpan - 1e-9);
}

export function marketHashName(skinName: string, wear: string): string {
  return `${skinName} (${wear})`;
}

export function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[^0-9.,]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function r4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Clamp a win-chance percent into [0, 100] at 2 decimal places. */
export function clampWinPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, r2(n)));
}

/**
 * Convert probability fractions (sum ≈ 1) into display percents that sum to
 * exactly 100.00. Avoids 6.67×3 + 26.67×3 = 100.02 from independent r2().
 */
export function fractionsToPercents(fractions: number[]): number[] {
  if (!fractions.length) return [];
  const total = fractions.reduce((s, p) => s + (p > 0 ? p : 0), 0);
  if (!(total > 0)) return fractions.map(() => 0);

  // Hundredths of a percent (100.00% → 10000 units)
  const exact = fractions.map((p) => ((p > 0 ? p : 0) / total) * 10000);
  const floors = exact.map((x) => Math.floor(x + 1e-9));
  let left = 10000 - floors.reduce((s, n) => s + n, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = [...floors];
  for (let k = 0; k < left; k++) {
    out[order[k % order.length].i]++;
  }
  return out.map((n) => n / 100);
}

export function getMaxInputFloat(
  inSkin: { minF: number; maxF: number },
  outSkins: { minF: number; maxF: number; weight?: number }[],
  totalCost: number,
  fee: number,
  priceFn: (wear: string, outMin: number, outMax: number) => number
): number {
  let lo = 0;
  let hi = 1;
  let best = 0;
  const weightSum =
    outSkins.reduce((s, sk) => s + (sk.weight ?? 1), 0) || outSkins.length;

  for (let s = 0; s < 20; s++) {
    const mid = (lo + hi) / 2;
    let ev = 0;
    for (const sk of outSkins) {
      const outFloat = outF(f32(mid), sk.minF, sk.maxF);
      const wear = getWearForSkin(outFloat, sk.minF, sk.maxF);
      const w = (sk.weight ?? 1) / weightSum;
      ev += w * priceFn(wear, sk.minF, sk.maxF) * (1 - fee);
    }
    if (ev >= totalCost) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return r4(
    f32(f32(inSkin.minF) + f32(best) * f32(f32(inSkin.maxF) - f32(inSkin.minF)))
  );
}
