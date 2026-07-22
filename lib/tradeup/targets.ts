import { RARITY_ORDER } from "../constants";
import type { SkinData } from "./types";

/** Outcomes that can appear from a standard 10-skin trade-up (not Consumer). */
export function isTargetableOutcomeRarity(rarity: string): boolean {
  const i = RARITY_ORDER.indexOf(rarity as (typeof RARITY_ORDER)[number]);
  return i > 0; // Industrial … Covert
}

export function prevRarity(rarity: string): string | null {
  const i = RARITY_ORDER.indexOf(rarity as (typeof RARITY_ORDER)[number]);
  if (i <= 0) return null;
  return RARITY_ORDER[i - 1];
}

export type TargetableSkin = {
  name: string;
  rarity: string;
  image?: string;
  /** Best single-collection hit chance if you put all 10 inputs there */
  maxHitPct: number;
  collections: { id: string; name: string; poolSize: number }[];
};

/**
 * Skins that can be forced as trade-up outcomes in Standard mode.
 * Needs at least one collection with a non-empty previous-tier input pool.
 */
export function listTargetableOutcomes(
  skinDB: SkinData[],
  byCR: Record<string, SkinData[]>
): TargetableSkin[] {
  const out: TargetableSkin[] = [];

  for (const skin of skinDB) {
    if (skin.isSouvenir || skin.isSpecial) continue;
    if (!isTargetableOutcomeRarity(skin.rarity)) continue;
    const prev = prevRarity(skin.rarity);
    if (!prev) continue;

    const cols: TargetableSkin["collections"] = [];
    for (const col of skin.collections) {
      const pool = (byCR[`${col.id}|${skin.rarity}`] || []).filter(
        (s) => !s.isSouvenir && !s.isSpecial
      );
      if (!pool.some((s) => s.name === skin.name)) continue;
      const inputs = (byCR[`${col.id}|${prev}`] || []).filter(
        (s) => !s.isSouvenir && !s.isSpecial
      );
      if (!inputs.length) continue;
      cols.push({
        id: col.id,
        name: col.name,
        poolSize: pool.length,
      });
    }
    if (!cols.length) continue;

    const bestPool = Math.min(...cols.map((c) => c.poolSize));
    out.push({
      name: skin.name,
      rarity: skin.rarity,
      image: skin.image,
      maxHitPct: Math.round((100 / bestPool) * 100) / 100,
      collections: cols.sort((a, b) => a.poolSize - b.poolSize),
    });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function searchTargetableOutcomes(
  skins: TargetableSkin[],
  query: string,
  limit = 25
): TargetableSkin[] {
  const q = query.trim().toLowerCase();
  if (!q) return skins.slice(0, limit);

  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: { skin: TargetableSkin; score: number }[] = [];

  for (const skin of skins) {
    const name = skin.name.toLowerCase();
    if (!tokens.every((t) => name.includes(t))) continue;
    let score = 0;
    if (name.startsWith(q)) score += 40;
    if (name.includes(`| ${q}`)) score += 30;
    score += Math.max(0, 20 - Math.min(20, name.indexOf(tokens[0])));
    score += skin.maxHitPct; // prefer higher max hit chance on ties
    scored.push({ skin, score });
  }

  scored.sort(
    (a, b) => b.score - a.score || a.skin.name.localeCompare(b.skin.name)
  );
  return scored.slice(0, limit).map((s) => s.skin);
}

/** Probability % that a trade-up lands the named outcome (display probs). */
export function targetHitPct(
  outcomes: { name: string; prob: number }[],
  targetName: string
): number {
  let sum = 0;
  for (const o of outcomes) {
    if (o.name === targetName) sum += o.prob;
  }
  return Math.round(sum * 100) / 100;
}
