import type { SchemaData } from "./tradeup/types";

/**
 * Explicitly flagged collections with unstable or immature market pricing.
 * Update this list when new cases drop.
 */
export const UNSTABLE_COLLECTION_KEYS = new Set([
  "set_community_35", // Fever
  "set_community_36", // Genesis
  "set_community_37", // Dead Hand
  "set_community_34", // Gallery
  "set_community_33", // Kilowatt
  "set_community_32", // Revolution
  "set_timed_drops_achroma", // Achroma
  "set_timed_drops_cool", // Ascent
  "set_timed_drops_neutral", // Boreal
  "set_realism_camo", // Sport & Field
  "set_spy_tech", // Spy Tech
  "set_overpass_2024", // Overpass 2024
  "set_graphic_design", // Graphic Design
]);

const UNSTABLE_PATTERNS = [
  /^set_timed_drops_/,
  /^set_community_3[5-9]$/,
  /^set_community_4\d$/,
];

export function isUnstableCollectionKey(key: string): boolean {
  if (UNSTABLE_COLLECTION_KEYS.has(key)) return true;
  return UNSTABLE_PATTERNS.some((p) => p.test(key));
}

export function getUnstableCollections(schema: SchemaData): {
  key: string;
  name: string;
}[] {
  return (schema.collections || [])
    .filter((c) => isUnstableCollectionKey(c.key))
    .map((c) => ({ key: c.key, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getUnstableCollectionKeySet(schema: SchemaData): Set<string> {
  const keys = new Set<string>();
  for (const c of schema.collections || []) {
    if (isUnstableCollectionKey(c.key)) keys.add(c.key);
  }
  return keys;
}
