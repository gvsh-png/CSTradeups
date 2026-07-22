/**
 * New-collection exclusion — only Arabesque + Spy Tech.
 * Run: node scripts/verify-collections.mjs
 */

const NEW_COLLECTION_MAX_AGE_DAYS = 30;
const NEW_COLLECTION_KEYS = new Set(["set_arabesque", "set_spy_tech"]);
const COLLECTION_RELEASE_DATES = {
  set_spy_tech: "2026-07-08",
  set_arabesque: "2026-07-08",
};

function daysBetween(fromIso, now) {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return Infinity;
  return Math.floor((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function isUnstableCollectionKey(key, now = new Date()) {
  if (!NEW_COLLECTION_KEYS.has(key)) return false;
  const date = COLLECTION_RELEASE_DATES[key];
  if (!date) return true;
  const age = daysBetween(date, now);
  return age >= 0 && age < NEW_COLLECTION_MAX_AGE_DAYS;
}

function getUnstableCollections(schema, now = new Date()) {
  const colMap = new Map(
    (schema.collections || []).map((c) => [c.key, c.name])
  );
  const results = [];
  for (const key of NEW_COLLECTION_KEYS) {
    const date = COLLECTION_RELEASE_DATES[key];
    if (!date) continue;
    const ageDays = daysBetween(date, now);
    if (ageDays < 0 || ageDays >= NEW_COLLECTION_MAX_AGE_DAYS) continue;
    results.push({
      key,
      name: colMap.get(key) || key,
      releaseDate: date,
      ageDays,
    });
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

function getUnstableCollectionKeySet(schema, now = new Date()) {
  const keys = new Set();
  for (const key of NEW_COLLECTION_KEYS) {
    if (isUnstableCollectionKey(key, now)) keys.add(key);
  }
  return keys;
}

let failed = 0;
function assert(name, cond, detail = "") {
  console.log(`${cond ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failed++;
}

const now = new Date("2026-07-22");

assert(
  "only arabesque + spy tech in NEW_COLLECTION_KEYS",
  NEW_COLLECTION_KEYS.size === 2 &&
    NEW_COLLECTION_KEYS.has("set_arabesque") &&
    NEW_COLLECTION_KEYS.has("set_spy_tech")
);

assert("ascent is stable", !isUnstableCollectionKey("set_ascent", now));
assert("train 2021 stable", !isUnstableCollectionKey("set_train_2021", now));
assert("arabesque unstable mid-july", isUnstableCollectionKey("set_arabesque", now));
assert("spy tech unstable mid-july", isUnstableCollectionKey("set_spy_tech", now));

const schema = {
  collections: [
    { key: "set_arabesque", name: "Arabesque Collection" },
    { key: "set_spy_tech", name: "Spy Tech Collection" },
    { key: "set_ascent", name: "The Ascent Collection" },
  ],
};

const unstable = getUnstableCollections(schema, now);
assert("unstable list count", unstable.length === 2, `got ${unstable.length}`);
assert(
  "unstable keys",
  unstable.every((c) => NEW_COLLECTION_KEYS.has(c.key))
);

const excluded = getUnstableCollectionKeySet(schema, now);
assert("excluded set size", excluded.size === 2);
assert("ascent not excluded", !excluded.has("set_ascent"));

const later = new Date("2026-08-15");
assert(
  "arabesque graduates after 30d",
  !isUnstableCollectionKey("set_arabesque", later)
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll collection checks passed");
