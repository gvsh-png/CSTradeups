/**
 * Sanity checks for risk → win-chance band.
 * Run: node scripts/verify-win-chance.mjs
 */

function r2(n) {
  return Math.round(n * 100) / 100;
}

const RISK_WIN_BAND = 20;

function winChanceBandFromRisk(risk) {
  const r = Math.max(0, Math.min(100, risk));
  const target = 100 - r;
  return {
    target,
    minWinChance: Math.max(0, target - RISK_WIN_BAND),
    maxWinChance: Math.min(100, target + RISK_WIN_BAND),
  };
}

function passesBand(winPct, minWin, maxWin) {
  return winPct >= minWin && winPct <= maxWin;
}

function riskRankScore(winPct, expectedProfit, targetWinChance) {
  const dist = Math.abs(winPct - targetWinChance) / 100;
  const fit = Math.max(0, 1 - dist);
  return expectedProfit * (0.35 + 0.65 * fit) - dist * 40;
}

let failed = 0;
function assert(name, got, expected) {
  const ok = got === expected;
  console.log(`${ok ? "OK" : "FAIL"} ${name}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  if (!ok) failed++;
}

// Default risk 60 → target 40%, band [20, 60] — excludes 100% sure things
const mid = winChanceBandFromRisk(60);
assert("risk60 target", mid.target, 40);
assert("risk60 min", mid.minWinChance, 20);
assert("risk60 max", mid.maxWinChance, 60);
assert("100% blocked at risk60", passesBand(100, mid.minWinChance, mid.maxWinChance) ? 1 : 0, 0);
assert("50% ok at risk60", passesBand(50, mid.minWinChance, mid.maxWinChance) ? 1 : 0, 1);
assert("40% ok at risk60", passesBand(40, mid.minWinChance, mid.maxWinChance) ? 1 : 0, 1);

// Safer risk 10 → target 90%, [70, 100]
const safe = winChanceBandFromRisk(10);
assert("risk10 target", safe.target, 90);
assert("risk10 min", safe.minWinChance, 70);
assert("risk10 max", safe.maxWinChance, 100);
assert("100% ok when safe", passesBand(100, safe.minWinChance, safe.maxWinChance) ? 1 : 0, 1);
assert("40% blocked when safe", passesBand(40, safe.minWinChance, safe.maxWinChance) ? 1 : 0, 0);

// High risk 90 → target 10%, [0, 30]
const high = winChanceBandFromRisk(90);
assert("risk90 target", high.target, 10);
assert("risk90 max", high.maxWinChance, 30);
assert("100% blocked at high risk", passesBand(100, high.minWinChance, high.maxWinChance) ? 1 : 0, 0);
assert("10% ok at high risk", passesBand(10, high.minWinChance, high.maxWinChance) ? 1 : 0, 1);

// Ranking: closer to target beats farther even with similar profit
const near = riskRankScore(40, 50, 40);
const far = riskRankScore(100, 55, 40);
assert("near target ranks higher", near > far ? 1 : 0, 1);

function calcWinPct(outcomes, totalCost, fee) {
  let winProb = 0;
  for (const o of outcomes) {
    const net = o.price * (1 - fee) - totalCost;
    if (net >= 0) winProb += o.prob;
  }
  return r2(winProb * 100);
}

assert(
  "50/50 win chance",
  calcWinPct(
    [
      { price: 200, prob: 0.5 },
      { price: 50, prob: 0.5 },
    ],
    100,
    0.02
  ),
  50
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll win-chance / risk band checks passed");
