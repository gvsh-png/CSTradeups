import {
  EXCLUDED_KEYWORDS,
  KNIFE_GLOVE_TYPES,
  RARITY_MAP,
  RARITY_ORDER,
} from "./constants";
import type { SchemaData, SkinData } from "./tradeup/types";

const KNIFE_NAMES = [
  "★",
  "Karambit",
  "Bayonet",
  "Flip Knife",
  "Gut Knife",
  "Huntsman Knife",
  "Butterfly Knife",
  "Falchion Knife",
  "Shadow Daggers",
  "Bowie Knife",
  "Navaja Knife",
  "Stiletto Knife",
  "Talon Knife",
  "Ursus Knife",
  "Classic Knife",
  "Paracord Knife",
  "Survival Knife",
  "Nomad Knife",
  "Skeleton Knife",
  "Kukri Knife",
  "Sport Gloves",
  "Specialist Gloves",
  "Driver Gloves",
  "Hand Wraps",
  "Moto Gloves",
  "Hydra Gloves",
  "Broken Fang Gloves",
];

function isExcludedCol(name: string): boolean {
  const nm = name.toLowerCase();
  return (
    EXCLUDED_KEYWORDS.some((k) => nm.includes(k)) || nm.includes("exclusive")
  );
}

export function buildSkinDatabase(schema: SchemaData): SkinData[] {
  const colMap: Record<string, string> = {};
  for (const c of schema.collections || []) {
    colMap[c.key] = c.name;
  }

  const skinDB: SkinData[] = [];

  for (const weapon of Object.values(schema.weapons || {})) {
    const wType = weapon.type || "Unknown";
    if (KNIFE_GLOVE_TYPES.includes(wType)) continue;

    for (const paint of Object.values(weapon.paints || {})) {
      if (!paint.name || !paint.collections?.length) continue;

      const rarity = RARITY_MAP[paint.rarity];
      if (!rarity || !RARITY_ORDER.includes(rarity as (typeof RARITY_ORDER)[number]))
        continue;

      const fullName = `${weapon.name} | ${paint.name}`;
      if (
        fullName.includes("★") ||
        fullName.includes("Souvenir") ||
        KNIFE_NAMES.some((k) => fullName.startsWith(k))
      )
        continue;

      const validCols = paint.collections.filter(
        (c) => !isExcludedCol(colMap[c] || c)
      );
      if (!validCols.length) continue;

      skinDB.push({
        name: fullName,
        minF: paint.min ?? 0,
        maxF: paint.max ?? 1,
        rarity,
        collections: validCols.map((c) => ({
          id: c,
          name: colMap[c] || c,
        })),
        image: paint.image,
      });
    }
  }

  const seen = new Set<string>();
  return skinDB.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });
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
  const [weaponName, paintName] = skinName.split(" | ");
  if (!weaponName || !paintName) return undefined;

  for (const weapon of Object.values(schema.weapons || {})) {
    if (weapon.name !== weaponName) continue;
    for (const paint of Object.values(weapon.paints || {})) {
      if (paint.name === paintName) return paint.image;
    }
  }
  return undefined;
}
