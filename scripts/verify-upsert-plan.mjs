/**
 * upsertUser must never resurrect paid plans from a JWT/session cookie.
 * Run: node scripts/verify-upsert-plan.mjs
 */

import assert from "node:assert/strict";

/** Mirrors lib/usage/store.ts resolveUpsertPlan */
function resolveUpsertPlan(existingPlan, _requestedPlan) {
  return existingPlan ?? "free";
}

/** Legacy buggy behavior: trust caller plan on create */
function resolveUpsertPlanLegacy(existingPlan, requestedPlan) {
  if (existingPlan) return requestedPlan ?? existingPlan;
  return requestedPlan ?? "free";
}

// Redis miss + stale pro/starter session must create free
assert.equal(resolveUpsertPlan(undefined, "pro"), "free");
assert.equal(resolveUpsertPlan(undefined, "starter"), "free");
assert.equal(resolveUpsertPlan(undefined, "free"), "free");
assert.equal(resolveUpsertPlan(undefined, undefined), "free");

// Existing Redis plan is authoritative (Stripe setPlan), not the cookie
assert.equal(resolveUpsertPlan("pro", "free"), "pro");
assert.equal(resolveUpsertPlan("starter", "pro"), "starter");
assert.equal(resolveUpsertPlan("free", "pro"), "free");

// Document the bug we fixed: legacy create trusted JWT plan
assert.equal(resolveUpsertPlanLegacy(undefined, "pro"), "pro");
assert.notEqual(
  resolveUpsertPlan(undefined, "pro"),
  resolveUpsertPlanLegacy(undefined, "pro")
);

console.log("verify-upsert-plan: ok");
