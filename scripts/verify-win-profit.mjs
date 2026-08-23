/**
 * Rounded micro-losses become -0 in JS; they must not count as wins.
 * Run: node scripts/verify-win-profit.mjs
 */

function r2(n) {
  return Math.round(n * 100) / 100;
}

/** Mirror of lib/tradeup/float.ts isWinProfit */
function isWinProfit(profit) {
  return profit > 0 || Object.is(profit, 0);
}

function displayWinPct(outcomes) {
  let displayWin = 0;
  for (const o of outcomes) {
    if (isWinProfit(o.profit)) displayWin += o.prob;
  }
  return outcomes.length > 0 && outcomes.every((o) => isWinProfit(o.profit))
    ? 100
    : Math.min(100, Math.max(0, r2(displayWin)));
}

/** Old bug: profit >= 0 treats -0 as a win and can force 100% */
function displayWinPctBuggy(outcomes) {
  let displayWin = 0;
  for (const o of outcomes) {
    if (o.profit >= 0) displayWin += o.prob;
  }
  return outcomes.length > 0 && outcomes.every((o) => o.profit >= 0)
    ? 100
    : Math.min(100, Math.max(0, r2(displayWin)));
}

let failed = 0;
function assert(name, got, expected) {
  const ok = got === expected;
  console.log(`${ok ? "OK" : "FAIL"} ${name}: got ${got}, expected ${expected}`);
  if (!ok) failed++;
}

// r2 of a half-cent loss yields IEEE -0
const microLoss = r2(-0.004);
assert("r2 micro-loss is -0", Object.is(microLoss, -0) ? 1 : 0, 1);
assert("buggy: -0 >= 0", microLoss >= 0 ? 1 : 0, 1);
assert("fixed: isWinProfit(-0)", isWinProfit(microLoss) ? 1 : 0, 0);
assert("fixed: isWinProfit(+0)", isWinProfit(0) ? 1 : 0, 1);
assert("fixed: isWinProfit(0.01)", isWinProfit(0.01) ? 1 : 0, 1);
assert("fixed: isWinProfit(-0.01)", isWinProfit(-0.01) ? 1 : 0, 0);

const fee = 0.02;
const totalCost = 10;
// price such that net ≈ -0.004 → r2 → -0
const lossPrice = 10.199;
const winPrice = 15;
const rawLoss = lossPrice * (1 - fee) - totalCost;
const outcomes = [
  { prob: 50, profit: r2(winPrice * (1 - fee) - totalCost) },
  { prob: 50, profit: r2(rawLoss) },
];

assert("raw loss negative", rawLoss < 0 ? 1 : 0, 1);
assert("rounded loss is -0", Object.is(outcomes[1].profit, -0) ? 1 : 0, 1);
assert("buggy win% is 100", displayWinPctBuggy(outcomes), 100);
assert("fixed win% is 50", displayWinPct(outcomes), 50);

// All micro-loss outcomes must not collapse to 100%
const allMicro = [
  { prob: 50, profit: r2(-0.004) },
  { prob: 50, profit: r2(-0.003) },
];
assert("buggy all-micro → 100", displayWinPctBuggy(allMicro), 100);
assert("fixed all-micro → 0", displayWinPct(allMicro), 0);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll win-profit -0 checks passed");
