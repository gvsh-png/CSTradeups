/**
 * Save-slot quota: document the old check-then-set race and the atomic INCR fix.
 * Run: node scripts/verify-save-quota.mjs
 */

let failed = 0;
function assert(name, got, expected) {
  const ok = got === expected;
  console.log(`${ok ? "OK" : "FAIL"} ${name}: got ${got}, expected ${expected}`);
  if (!ok) failed++;
}

/** Old claimSaveSlot: read savedCount, check limit, write savedCount+1 */
function claimBuggy(state, limit) {
  if (state.savedCount >= limit) return false;
  // Concurrent callers both observe the same savedCount before either writes
  state.savedCount = state.savedCount + 1;
  return true;
}

/**
 * Fixed claim: Redis INCR is the source of truth for the limit check.
 * Two concurrent INCRs cannot both land at the same value.
 */
function claimAtomic(counter, limit) {
  const next = counter.value + 1;
  if (next > limit) return false;
  counter.value = next;
  return true;
}

// Simulate free plan (max=1) with two concurrent claims from savedCount=0
{
  const a = { savedCount: 0 };
  const b = { savedCount: 0 };
  // Both read 0 and pass the check before either write
  const okA = a.savedCount < 1;
  const okB = b.savedCount < 1;
  if (okA) a.savedCount = a.savedCount + 1;
  if (okB) b.savedCount = b.savedCount + 1;
  // Last write wins at 1, but BOTH callers received success
  assert("buggy concurrent: both succeed", okA && okB ? 1 : 0, 1);
  assert("buggy concurrent: counter undercounts grants", a.savedCount, 1);
}

{
  const counter = { value: 0 };
  const okA = claimAtomic(counter, 1);
  const okB = claimAtomic(counter, 1);
  assert("atomic concurrent: first succeeds", okA ? 1 : 0, 1);
  assert("atomic concurrent: second rejected", okB ? 1 : 0, 0);
  assert("atomic concurrent: counter == 1", counter.value, 1);
}

// Starter at limit-1: two concurrent claims must grant exactly one
{
  const counter = { value: 14 };
  const okA = claimAtomic(counter, 15);
  const okB = claimAtomic(counter, 15);
  assert("starter edge: first ok", okA ? 1 : 0, 1);
  assert("starter edge: second blocked", okB ? 1 : 0, 0);
  assert("starter edge: counter == 15", counter.value, 15);
}

// Document old last-write-wins undercount of grants
{
  const shared = { savedCount: 14 };
  const snapA = shared.savedCount;
  const snapB = shared.savedCount;
  const okA = snapA < 15;
  const okB = snapB < 15;
  if (okA) shared.savedCount = snapA + 1;
  if (okB) shared.savedCount = snapB + 1;
  assert("buggy starter edge: both granted", okA && okB ? 1 : 0, 1);
  assert("buggy starter edge: undercount at 15 not 16", shared.savedCount, 15);
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll save-quota checks passed");
