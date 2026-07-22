import { unstable_cache } from "next/cache";
import type { SchemaData } from "./tradeup/types";

/** Collections younger than this are excluded by default */
export const NEW_COLLECTION_MAX_AGE_DAYS = 30;

/**
 * The only collections treated as "new" for the exclude-unstable toggle.
 * Everything else (including Ascent) is stable regardless of baseline gaps.
 */
export const NEW_COLLECTION_KEYS = new Set([
  "set_arabesque",
  "set_spy_tech",
]);

/**
 * Known release dates (ISO) for collections in NEW_COLLECTION_KEYS.
 */
export const COLLECTION_RELEASE_DATES: Record<string, string> = {
  set_spy_tech: "2026-07-08", // Spy Tech Collection
  set_arabesque: "2026-07-08", // Arabesque Collection
};

/**
 * Snapshot of every collection key known as of this deploy.
 * Used for schema drift detection only — not for unstable exclusion
 * (see NEW_COLLECTION_KEYS).
 */
export const KNOWN_COLLECTION_BASELINE = new Set([
  "set_anubis",
  "set_arabesque",
  "set_ascent",
  "set_assault",
  "set_aztec",
  "set_baggage",
  "set_bank",
  "set_blacksite",
  "set_bravo_i",
  "set_bravo_ii",
  "set_cache",
  "set_canals",
  "set_chopshop",
  "set_cobblestone",
  "set_community_1",
  "set_community_10",
  "set_community_11",
  "set_community_12",
  "set_community_13",
  "set_community_15",
  "set_community_16",
  "set_community_17",
  "set_community_18",
  "set_community_19",
  "set_community_2",
  "set_community_20",
  "set_community_21",
  "set_community_22",
  "set_community_23",
  "set_community_24",
  "set_community_25",
  "set_community_26",
  "set_community_27",
  "set_community_28",
  "set_community_29",
  "set_community_3",
  "set_community_30",
  "set_community_31",
  "set_community_32",
  "set_community_33",
  "set_community_34",
  "set_community_35",
  "set_community_36",
  "set_community_37",
  "set_community_4",
  "set_community_5",
  "set_community_6",
  "set_community_7",
  "set_community_8",
  "set_community_9",
  "set_dust",
  "set_dust_2",
  "set_dust_2_2021",
  "set_esports",
  "set_esports_ii",
  "set_esports_iii",
  "set_gamma_2",
  "set_gods_and_monsters",
  "set_graphic_design",
  "set_inferno",
  "set_inferno_2",
  "set_italy",
  "set_kimono",
  "set_lake",
  "set_militia",
  "set_mirage",
  "set_mirage_2021",
  "set_norse",
  "set_nuke",
  "set_nuke_2",
  "set_office",
  "set_op10_ancient",
  "set_op10_ct",
  "set_op10_t",
  "set_overpass",
  "set_overpass_2024",
  "set_realism_camo",
  "set_safehouse",
  "set_spy_tech",
  "set_stmarc",
  "set_timed_drops_achroma",
  "set_timed_drops_cool",
  "set_timed_drops_exuberant",
  "set_timed_drops_neutral",
  "set_timed_drops_warm",
  "set_train",
  "set_train_2021",
  "set_train_2025",
  "set_vertigo",
  "set_vertigo_2021",
  "set_weapons_i",
  "set_weapons_ii",
  "set_weapons_iii",
  "set_xpshop_wpn_01",
  "set_xraymachine",
]);

export interface UnstableCollection {
  key: string;
  name: string;
  releaseDate: string;
  ageDays: number;
  source: "known" | "discovered";
}

type DiscoveryMap = Record<string, string>; // key -> firstSeen ISO date

/** In-memory discovery map (survives warm instances; refreshed via cache) */
let discoveryMemory: DiscoveryMap = {};

function daysBetween(fromIso: string, now: Date): number {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return Infinity;
  return Math.floor((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function getEffectiveReleaseDate(
  key: string,
  discoveries: DiscoveryMap = discoveryMemory
): { date: string; source: "known" | "discovered" } | null {
  if (COLLECTION_RELEASE_DATES[key]) {
    return { date: COLLECTION_RELEASE_DATES[key], source: "known" };
  }
  if (discoveries[key]) {
    return { date: discoveries[key], source: "discovered" };
  }
  return null;
}

export function isUnstableCollectionKey(
  key: string,
  now = new Date(),
  maxAgeDays = NEW_COLLECTION_MAX_AGE_DAYS,
  _discoveries: DiscoveryMap = discoveryMemory
): boolean {
  if (!NEW_COLLECTION_KEYS.has(key)) return false;
  const info = getEffectiveReleaseDate(key);
  if (!info) return true;
  const age = daysBetween(info.date, now);
  return age >= 0 && age < maxAgeDays;
}

/**
 * Detect collections that appear in schema but were not in our baseline.
 * Stamps them with today's date so they auto-exclude for 30 days.
 */
export function discoverNewCollections(
  schema: SchemaData,
  now = new Date()
): DiscoveryMap {
  const today = now.toISOString().split("T")[0];
  const updated = { ...discoveryMemory };

  for (const c of schema.collections || []) {
    if (KNOWN_COLLECTION_BASELINE.has(c.key)) continue;
    if (COLLECTION_RELEASE_DATES[c.key]) continue;
    if (!updated[c.key]) {
      updated[c.key] = today;
    }
  }

  discoveryMemory = updated;
  return updated;
}

export function getUnstableCollections(
  schema: SchemaData,
  now = new Date(),
  maxAgeDays = NEW_COLLECTION_MAX_AGE_DAYS,
  _discoveries: DiscoveryMap = discoveryMemory
): UnstableCollection[] {
  const colMap = new Map(
    (schema.collections || []).map((c) => [c.key, c.name])
  );

  const results: UnstableCollection[] = [];

  for (const key of NEW_COLLECTION_KEYS) {
    const info = getEffectiveReleaseDate(key);
    if (!info) continue;
    const ageDays = daysBetween(info.date, now);
    if (ageDays < 0 || ageDays >= maxAgeDays) continue;

    results.push({
      key,
      name: colMap.get(key) || key,
      releaseDate: info.date,
      ageDays,
      source: info.source,
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function getUnstableCollectionKeySet(
  schema: SchemaData,
  now = new Date(),
  maxAgeDays = NEW_COLLECTION_MAX_AGE_DAYS,
  _discoveries: DiscoveryMap = discoveryMemory,
  extraExcluded: string[] = []
): Set<string> {
  const keys = new Set<string>();

  for (const key of NEW_COLLECTION_KEYS) {
    if (isUnstableCollectionKey(key, now, maxAgeDays)) {
      keys.add(key);
    }
  }

  for (const key of extraExcluded) {
    if (key) keys.add(key);
  }

  return keys;
}

/**
 * Optionally ask OpenRouter when a brand-new collection appears,
 * to refine the release date. Falls back to first-seen date.
 */
export async function resolveReleaseDateWithAI(
  collectionName: string,
  collectionKey: string
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const model =
      process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://tradeup-gen.vercel.app",
        "X-Title": "tradeupcsgo.net",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: `What is the Counter-Strike 2 release date for the collection "${collectionName}" (schema key: ${collectionKey})? Reply with ONLY an ISO date YYYY-MM-DD, or UNKNOWN if you are not sure.`,
          },
        ],
        max_tokens: 20,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content || "").trim();
    const match = text.match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

const getCachedDiscoveries = unstable_cache(
  async (): Promise<DiscoveryMap> => discoveryMemory,
  ["collection-discoveries"],
  { revalidate: 86400, tags: ["collections"] }
);

export async function loadDiscoveries(): Promise<DiscoveryMap> {
  try {
    const cached = await getCachedDiscoveries();
    discoveryMemory = { ...discoveryMemory, ...cached };
  } catch {
    /* ignore */
  }
  return discoveryMemory;
}
