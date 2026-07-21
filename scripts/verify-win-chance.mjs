/**
 * Sanity checks for target-win band + diversity helpers.
 * Run: node scripts/verify-win-chance.mjs
 */

const WIN_CHANCE_BAND = 25;

function winChanceBandFromTarget(targetWin) {
  const target = Math.max(0, Math.min(100, targetWin));
  return {
    target,
    minWinChance: Math.max(0, target - WIN_CHANCE_BAND),
    maxWinChance: Math.min(100, target + WIN_CHANCE_BAND),
  };
}

function winChanceBucket(winPct) {
  return Math.round(Math.max(0, Math.min(100, winPct)) / 10) * 10;
}

function riskRankScore(winPct, expectedProfit, targetWinChance) {
  const dist = Math.abs(winPct - targetWinChance) / 100;
  return expectedProfit - dist * 12;
}

function passesBand(winPct, minWin, maxWin) {
  return winPct >= minWin && winPct <= maxWin;
}

let failed = 0;
function assert(name, got, expected) {
  const ok = got === expected;
  console.log(
    `${ok ? "OK" : "FAIL"} ${name}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`
  );
  if (!ok) failed++;
}

// 60% target → band [35, 85] — includes 60, not inverted to 40
const mid = winChanceBandFromTarget(60);
assert("target60", mid.target, 60);
assert("target60 min", mid.minWinChance, 35);
assert("target60 max", mid.maxWinChance, 85);
assert("60% in band", passesBand(60, mid.minWinChance, mid.maxWinChance) ? 1 : 0, 1);
assert("40% in band", passesBand(40, mid.minWinChance, mid.maxWinChance) ? 1 : 0, 1);
assert("80% in band", passesBand(80, mid.minWinChance, mid.maxWinChance) ? 1 : 0, 1);
assert("100% out of mid band", passesBand(100, mid.minWinChance, mid.maxWinChance) ? 1 : 0, 0);
assert("10% out of mid band", passesBand(10, mid.minWinChance, mid.maxWinChance) ? 1 : 0, 0);

// Soft rank: profit still dominates mild distance
assert(
  "profit beats slight miss",
  riskRankScore(50, 80, 60) > riskRankScore(60, 40, 60) ? 1 : 0,
  1
);

assert("bucket 42 → 40", winChanceBucket(42), 40);
assert("bucket 56 → 60", winChanceBucket(56), 60);
assert("bucket 100 → 100", winChanceBucket(100), 100);

// Diversity: max ~2–3 per bucket for limit 15
const maxPer = Math.max(2, Math.ceil(15 / 6));
assert("max per win bucket", maxPer, 3);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll target-win / diversity checks passed");
