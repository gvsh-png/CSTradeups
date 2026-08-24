/**
 * Plan downgrade must reset weekly scan usage so Redis INCR / weeklyScans
 * from a higher tier cannot permanently SCAN_LIMIT Free/Starter.
 * Run: node scripts/verify-scan-quota-downgrade.mjs
 */

const FREE_WEEKLY_SCANS = 5;
const STARTER_WEEKLY_SCANS = 40;
const PRO_WEEKLY_SCANS = null;

function weeklyScanLimit(plan) {
  if (plan === "pro") return PRO_WEEKLY_SCANS;
  if (plan === "starter") return STARTER_WEEKLY_SCANS;
  return FREE_WEEKLY_SCANS;
}

function shouldResetWeeklyScansOnPlanChange(prev, next) {
  if (prev === next) return false;
  const prevLimit = weeklyScanLimit(prev);
  const nextLimit = weeklyScanLimit(next);
  return nextLimit != null && (prevLimit == null || nextLimit < prevLimit);
}

/** Simulate post-setPlan counter used by consumeScan for finite plans. */
function counterAfterSetPlan(prevPlan, usedOnPrev, nextPlan) {
  if (shouldResetWeeklyScansOnPlanChange(prevPlan, nextPlan)) return 0;
  return usedOnPrev;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Starter used 10 → Free: without reset, INCR would be 11 > 5 (lockout)
assert(
  shouldResetWeeklyScansOnPlanChange("starter", "free") === true,
  "starter→free should reset"
);
assert(
  counterAfterSetPlan("starter", 10, "free") === 0,
  "starter 10→free clears counter"
);

// Free exhausted → Pro → Free: Pro path never touches Redis, counter stays 5
assert(
  shouldResetWeeklyScansOnPlanChange("pro", "free") === true,
  "pro→free should reset"
);
assert(counterAfterSetPlan("pro", 5, "free") === 0, "pro→free clears stale free counter");

// Pro → Starter: newly finite cap must not inherit huge Pro weeklyScans mirror
assert(
  shouldResetWeeklyScansOnPlanChange("pro", "starter") === true,
  "pro→starter should reset"
);

// Free → Starter / Starter → Pro: keep progress (no reset)
assert(
  shouldResetWeeklyScansOnPlanChange("free", "starter") === false,
  "free→starter keeps counter"
);
assert(
  shouldResetWeeklyScansOnPlanChange("starter", "pro") === false,
  "starter→pro keeps counter"
);
assert(
  shouldResetWeeklyScansOnPlanChange("free", "free") === false,
  "same plan no reset"
);

// After reset, Free can consume a full allotment again
const after = counterAfterSetPlan("starter", 40, "free");
assert(after === 0, "reset to 0");
assert(after < FREE_WEEKLY_SCANS, "free allotment available after cancel");

console.log("verify-scan-quota-downgrade: ok");
