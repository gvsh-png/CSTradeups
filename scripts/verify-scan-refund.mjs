/**
 * Sanity checks for scan quota refund math (mirrors lib/usage/store.ts).
 * Run: node scripts/verify-scan-refund.mjs
 */

let failed = 0;
function assert(name, got, expected) {
  const ok = got === expected;
  console.log(`${ok ? "OK" : "FAIL"} ${name}: got ${got}, expected ${expected}`);
  if (!ok) failed++;
}

/** Pure model of consume then refund on failure */
function simulateQuota({ limit, starting, consume, thenRefund }) {
  let counter = starting;
  let userScans = starting;
  if (consume) {
    counter += 1;
    if (counter > limit) {
      counter -= 1;
      return { ok: false, weeklyScans: userScans, remaining: limit - userScans };
    }
    userScans = counter;
  }
  if (thenRefund) {
    counter -= 1;
    if (counter < 0) counter = 0;
    userScans = Math.max(0, Math.min(counter, limit));
  }
  return {
    ok: true,
    weeklyScans: userScans,
    remaining: Math.max(0, limit - userScans),
  };
}

const FREE = 5;

{
  const r = simulateQuota({
    limit: FREE,
    starting: 4,
    consume: true,
    thenRefund: true,
  });
  assert("failed scan after debit restores credit", r.weeklyScans, 4);
  assert("remaining after refund", r.remaining, 1);
}

{
  const r = simulateQuota({
    limit: FREE,
    starting: 4,
    consume: true,
    thenRefund: false,
  });
  assert("successful scan keeps debit", r.weeklyScans, 5);
  assert("no remaining after last credit", r.remaining, 0);
}

{
  const r = simulateQuota({
    limit: FREE,
    starting: 5,
    consume: true,
    thenRefund: false,
  });
  assert("at-limit consume rejected", r.ok, false);
  assert("at-limit scans unchanged", r.weeklyScans, 5);
}

{
  // Prices-unavailable path: user near limit, feed fails → still has a scan
  const afterFail = simulateQuota({
    limit: FREE,
    starting: 4,
    consume: true,
    thenRefund: true,
  });
  const retry = simulateQuota({
    limit: FREE,
    starting: afterFail.weeklyScans,
    consume: true,
    thenRefund: false,
  });
  assert("retry after feed failure can succeed", retry.ok, true);
  assert("retry consumes the restored credit", retry.weeklyScans, 5);
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll scan-refund checks passed");
