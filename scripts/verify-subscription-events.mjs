/**
 * Stale Stripe subscription event guard.
 * Run: node scripts/verify-subscription-events.mjs
 */

function isStaleSubscriptionEvent(currentSubscriptionId, eventSubscriptionId) {
  if (!eventSubscriptionId) return true;
  if (!currentSubscriptionId) return false;
  return currentSubscriptionId !== eventSubscriptionId;
}

let failed = 0;
function assert(name, got, expected) {
  const ok = got === expected;
  console.log(`${ok ? "OK" : "FAIL"} ${name}: got ${got}, expected ${expected}`);
  if (!ok) failed++;
}

assert(
  "no current sub → apply",
  isStaleSubscriptionEvent(undefined, "sub_B") ? 1 : 0,
  0
);
assert(
  "same sub → apply",
  isStaleSubscriptionEvent("sub_A", "sub_A") ? 1 : 0,
  0
);
assert(
  "old deleted after replace → stale",
  isStaleSubscriptionEvent("sub_B", "sub_A") ? 1 : 0,
  1
);
assert(
  "empty event id → stale",
  isStaleSubscriptionEvent("sub_B", "") ? 1 : 0,
  1
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll subscription-event checks passed");
