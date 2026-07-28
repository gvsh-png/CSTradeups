/**
 * Saved favorites trim must use the plan's own cap — never freeMaxSaved for paid.
 * Mirrors lib/billing/plans.ts trimSavedToPlanLimit / maxSavedLimit.
 * Run: node scripts/verify-saved-trim.mjs
 */

const FREE_MAX_SAVED = 1;
const STARTER_MAX_SAVED = 15;
const PRO_MAX_SAVED = null;

function maxSavedLimit(plan) {
  if (plan === "pro") return PRO_MAX_SAVED;
  if (plan === "starter") return STARTER_MAX_SAVED;
  return FREE_MAX_SAVED;
}

function trimSavedToPlanLimit(saved, plan) {
  const max = maxSavedLimit(plan);
  if (max == null || saved.length <= max) return saved;
  return saved.slice(0, max);
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const ids = (n) => Array.from({ length: n }, (_, i) => ({ id: `t${i}` }));

assert(FREE_MAX_SAVED === 1, "free max is 1");
assert(STARTER_MAX_SAVED === 15, "starter max is 15");
assert(maxSavedLimit("pro") == null, "pro is unlimited");

const sixteen = ids(16);

// Bug regression: Starter over-limit must keep 15, NOT collapse to free's 1
const starterTrim = trimSavedToPlanLimit(sixteen, "starter");
assert(starterTrim.length === 15, `starter trim length ${starterTrim.length} !== 15`);
assert(starterTrim[0].id === "t0", "starter keeps newest-first head");
assert(starterTrim[14].id === "t14", "starter keeps through slot 15");

// Free over-limit still trims to 1
const freeTrim = trimSavedToPlanLimit(ids(5), "free");
assert(freeTrim.length === 1, `free trim length ${freeTrim.length} !== 1`);
assert(freeTrim[0].id === "t0", "free keeps first saved");

// Under limit: no-op
assert(trimSavedToPlanLimit(ids(10), "starter").length === 10, "starter under cap unchanged");
assert(trimSavedToPlanLimit(ids(1), "free").length === 1, "free at cap unchanged");

// Pro never trims — even large local lists from prior unlimited use
assert(trimSavedToPlanLimit(ids(50), "pro").length === 50, "pro never trims");

// Exact-cap edge
assert(
  trimSavedToPlanLimit(ids(STARTER_MAX_SAVED), "starter").length === STARTER_MAX_SAVED,
  "starter at exact cap unchanged"
);

// Old buggy path: always freeMaxSaved would wipe Starter 16 → 1
const buggy = sixteen.slice(0, FREE_MAX_SAVED);
assert(buggy.length === 1, "documents old wipe behavior");
assert(starterTrim.length !== buggy.length, "fix must diverge from free wipe");

console.log("OK: saved trim uses plan limits (starter≠free wipe)");
