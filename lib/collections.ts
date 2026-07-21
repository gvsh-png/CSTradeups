import type { SchemaData } from "./tradeup/types";

/** Collections younger than this are considered unstable */
export const NEW_COLLECTION_MAX_AGE_DAYS = 90;

/**
 * Known collection release dates (ISO).
 * Only collections listed here can be excluded — everything else is treated as stable.
 * Add an entry when a new collection drops; it auto-expires after NEW_COLLECTION_MAX_AGE_DAYS.
 */
export const COLLECTION_RELEASE_DATES: Record<string, string> = {
  set_arabesque: "2026-07-14", // Arabesque Collection
  set_sparta: "2026-07-14", // Sparta Collection (key may vary once in schema)
};

export function getCollectionAgeDays(key: string, now = new Date()): number | null {
  const released = COLLECTION_RELEASE_DATES[key];
  if (!released) return null;

  const releaseDate = new Date(released);
  if (Number.isNaN(releaseDate.getTime())) return null;

  const diffMs = now.getTime() - releaseDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function isUnstableCollectionKey(
  key: string,
  now = new Date(),
  maxAgeDays = NEW_COLLECTION_MAX_AGE_DAYS
): boolean {
  const ageDays = getCollectionAgeDays(key, now);
  if (ageDays === null) return false;
  return ageDays >= 0 && ageDays < maxAgeDays;
}

export function getUnstableCollections(
  schema: SchemaData,
  now = new Date(),
  maxAgeDays = NEW_COLLECTION_MAX_AGE_DAYS
): { key: string; name: string; releaseDate: string; ageDays: number }[] {
  const colMap = new Map(
    (schema.collections || []).map((c) => [c.key, c.name])
  );

  const results: { key: string; name: string; releaseDate: string; ageDays: number }[] = [];

  for (const [key, releaseDate] of Object.entries(COLLECTION_RELEASE_DATES)) {
    const ageDays = getCollectionAgeDays(key, now);
    if (ageDays === null || ageDays < 0 || ageDays >= maxAgeDays) continue;

    results.push({
      key,
      name: colMap.get(key) || key,
      releaseDate,
      ageDays,
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function getUnstableCollectionKeySet(
  schema: SchemaData,
  now = new Date(),
  maxAgeDays = NEW_COLLECTION_MAX_AGE_DAYS
): Set<string> {
  const keys = new Set<string>();
  for (const c of schema.collections || []) {
    if (isUnstableCollectionKey(c.key, now, maxAgeDays)) keys.add(c.key);
  }
  // Also include keys not yet in schema but flagged with a recent release date
  for (const key of Object.keys(COLLECTION_RELEASE_DATES)) {
    if (isUnstableCollectionKey(key, now, maxAgeDays)) keys.add(key);
  }
  return keys;
}
