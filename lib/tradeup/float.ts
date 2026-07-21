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

export function getMaxInputFloat(
  inSkin: { minF: number; maxF: number },
  outSkins: { minF: number; maxF: number }[],
  totalCost: number,
  fee: number,
  priceFn: (wear: string, outMin: number, outMax: number) => number
): number {
  let lo = 0;
  let hi = 1;
  let best = 0;

  for (let s = 0; s < 20; s++) {
    const mid = (lo + hi) / 2;
    let ev = 0;
    for (const sk of outSkins) {
      const outFloat = outF(f32(mid), sk.minF, sk.maxF);
      const wear = getWear(outFloat);
      ev += (1 / outSkins.length) * priceFn(wear, sk.minF, sk.maxF) * (1 - fee);
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
