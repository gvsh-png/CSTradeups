import {
  EXCLUDED_KEYWORDS,
  isNeverTradeUpCollection,
  KNIFE_GLOVE_TYPES,
  RARITY_MAP,
  RARITY_ORDER,
  type Complexity,
} from "./constants";
import type { SchemaData, SkinData } from "./tradeup/types";

/** Soft name-keyword bans (Anubis, timed drops, etc.) */
function isExcludedColName(name: string): boolean {
  const nm = name.toLowerCase();
  return (
    EXCLUDED_KEYWORDS.some((k) => nm.includes(k)) || nm.includes("exclusive")
  );
}

/** Permanent + soft bans — collection key or display name */
export function isTradeUpBannedCollection(
  key: string,
  name?: string
): boolean {
  if (isNeverTradeUpCollection(key, name)) return true;
  if (name && isExcludedColName(name)) return true;
  if (isExcludedColName(key)) return true;
  return false;
}

export type SkinDbOptions = {
  /** Include Souvenir Weapon | Paint rows (souvenir mode) */
  includeSouvenir?: boolean;
};

function filterCollections(
  cols: string[],
  colMap: Record<string, string>,
  excludedCollectionKeys?: Set<string>
): string[] {
  let valid = cols.filter((c) => {
    const colName = colMap[c] || c;
    return !isTradeUpBannedCollection(c, colName);
  });
  if (excludedCollectionKeys?.size) {
    valid = valid.filter((c) => !excludedCollectionKeys.has(c));
  }
  return valid;
}

/**
 * Weapon skins for standard / souvenir trade-ups (excludes knives & gloves).
 */
export function buildSkinDatabase(
  schema: SchemaData,
  excludedCollectionKeys?: Set<string>,
  options: SkinDbOptions = {}
): SkinData[] {
  const colMap: Record<string, string> = {};
  for (const c of schema.collections || []) {
    colMap[c.key] = c.name;
  }

  const skinDB: SkinData[] = [];
  const includeSouvenir = Boolean(options.includeSouvenir);

  for (const weapon of Object.values(schema.weapons || {})) {
    const wType = weapon.type || "Unknown";
    if (KNIFE_GLOVE_TYPES.includes(wType)) continue;

    for (const paint of Object.values(weapon.paints || {})) {
      if (!paint.name || !paint.collections?.length) continue;

      const rarity = RARITY_MAP[paint.rarity];
      if (!rarity || !RARITY_ORDER.includes(rarity as (typeof RARITY_ORDER)[number]))
        continue;

      const fullName = `${weapon.name} | ${paint.name}`;
      if (fullName.includes("★")) continue;

      const validCols = filterCollections(
        paint.collections,
        colMap,
        excludedCollectionKeys
      );
      if (!validCols.length) continue;

      const cols = validCols.map((c) => ({
        id: c,
        name: colMap[c] || c,
      }));

      skinDB.push({
        name: fullName,
        minF: paint.min ?? 0,
        maxF: paint.max ?? 1,
        rarity,
        collections: cols,
        image: paint.image,
        isSouvenir: false,
      });

      if (includeSouvenir && paint.souvenir) {
        skinDB.push({
          name: `Souvenir ${fullName}`,
          minF: paint.min ?? 0,
          maxF: paint.max ?? 1,
          rarity,
          collections: cols,
          image: paint.image,
          isSouvenir: true,
        });
      }
    }
  }

  const seen = new Set<string>();
  return skinDB.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });
}

/** Market display name for a knife/glove paint */
export function specialItemMarketName(
  weaponName: string,
  paintName: string,
  type: string
): string {
  const isKnife = type === "Knives";
  const vanilla =
    !paintName ||
    paintName.toLowerCase() === "vanilla" ||
    paintName.toLowerCase() === "—";
  if (isKnife) {
    if (vanilla) return `★ ${weaponName}`;
    return `★ ${weaponName} | ${paintName}`;
  }
  // Gloves
  if (vanilla) return weaponName;
  return `${weaponName} | ${paintName}`;
}

/**
 * Knives & gloves grouped by collection — Covert→Extraordinary outcomes.
 */
export function buildSpecialOutcomesByCollection(
  schema: SchemaData,
  excludedCollectionKeys?: Set<string>
): Record<string, SkinData[]> {
  const colMap: Record<string, string> = {};
  for (const c of schema.collections || []) {
    colMap[c.key] = c.name;
  }

  const byCol: Record<string, SkinData[]> = {};

  for (const weapon of Object.values(schema.weapons || {})) {
    const wType = weapon.type || "";
    if (!KNIFE_GLOVE_TYPES.includes(wType)) continue;

    for (const paint of Object.values(weapon.paints || {})) {
      if (!paint.collections?.length) continue;
      const validCols = filterCollections(
        paint.collections,
        colMap,
        excludedCollectionKeys
      );
      if (!validCols.length) continue;

      const name = specialItemMarketName(
        weapon.name,
        paint.name || "Vanilla",
        wType
      );

      const skin: SkinData = {
        name,
        minF: paint.min ?? 0.06,
        maxF: paint.max ?? 0.8,
        rarity: "Extraordinary",
        collections: validCols.map((c) => ({
          id: c,
          name: colMap[c] || c,
        })),
        image: paint.image,
        isSpecial: true,
      };

      for (const c of validCols) {
        const key = `${c}|Extraordinary`;
        if (!byCol[key]) byCol[key] = [];
        if (!byCol[key].some((x) => x.name === skin.name)) {
          byCol[key].push(skin);
        }
      }
    }
  }

  return byCol;
}

export function groupByCollectionRarity(
  skinDB: SkinData[]
): Record<string, SkinData[]> {
  const byCR: Record<string, SkinData[]> = {};
  for (const skin of skinDB) {
    for (const col of skin.collections) {
      const key = `${col.id}|${skin.rarity}`;
      if (!byCR[key]) byCR[key] = [];
      if (!byCR[key].find((x) => x.name === skin.name)) {
        byCR[key].push(skin);
      }
    }
  }
  return byCR;
}

/** Build input DB for the selected contract mode */
export function buildSkinDatabaseForMode(
  schema: SchemaData,
  mode: Complexity,
  excludedCollectionKeys?: Set<string>
): SkinData[] {
  return buildSkinDatabase(schema, excludedCollectionKeys, {
    includeSouvenir: mode === "souvenir",
  });
}

let schemaCache: { data: SchemaData; fetchedAt: number } | null = null;
const SCHEMA_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function fetchSchema(): Promise<SchemaData> {
  if (schemaCache && Date.now() - schemaCache.fetchedAt < SCHEMA_TTL) {
    return schemaCache.data;
  }

  const res = await fetch("https://csfloat.com/api/v1/schema", {
    next: { revalidate: 86400 },
  });

  if (!res.ok) throw new Error(`Schema fetch failed: ${res.status}`);
  const data = (await res.json()) as SchemaData;
  schemaCache = { data, fetchedAt: Date.now() };
  return data;
}

export function getSkinImage(
  schema: SchemaData,
  skinName: string
): string | undefined {
  let name = skinName;
  if (name.startsWith("Souvenir ")) name = name.slice("Souvenir ".length);
  if (name.startsWith("★ ")) name = name.slice(2);

  const pipe = name.indexOf(" | ");
  const weaponName = pipe >= 0 ? name.slice(0, pipe) : name;
  const paintName = pipe >= 0 ? name.slice(pipe + 3) : "Vanilla";

  for (const weapon of Object.values(schema.weapons || {})) {
    if (weapon.name !== weaponName) continue;
    for (const paint of Object.values(weapon.paints || {})) {
      const pn = paint.name || "Vanilla";
      if (
        pn === paintName ||
        (paintName === "Vanilla" &&
          (!paint.name || paint.name.toLowerCase() === "vanilla"))
      ) {
        return paint.image;
      }
    }
  }
  return undefined;
}
