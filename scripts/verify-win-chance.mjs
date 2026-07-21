/**
 * Sanity checks for min win-chance filtering.
 * Run: node scripts/verify-win-chance.mjs
 */

function r2(n) {
  return Math.round(n * 100) / 100;
}

function calcWinPct(outcomes, totalCost, fee) {
  let winProb = 0;
  for (const o of outcomes) {
    const net = o.price * (1 - fee) - totalCost;
    if (net >= 0) winProb += o.prob;
  }
  return r2(winProb * 100);
}

function passesMinWin(winPct, minWinChance) {
  return winPct >= minWinChance;
}

let failed = 0;
function assert(name, got, expected) {
  const ok = got === expected;
  console.log(`${ok ? "OK" : "FAIL"} ${name}: got ${got}, expected ${expected}`);
  if (!ok) failed++;
}

const fee = 0.02;
const totalCost = 100;

// 50/50: one win, one loss
const fifty = calcWinPct(
  [
    { price: 200, prob: 0.5 },
    { price: 50, prob: 0.5 },
  ],
  totalCost,
  fee
);
assert("50/50 win chance", fifty, 50);
assert("passes at 40%", passesMinWin(fifty, 40) ? 1 : 0, 1);
assert("fails at 60%", passesMinWin(fifty, 60) ? 1 : 0, 0);

// Always profit
const always = calcWinPct([{ price: 200, prob: 1 }], totalCost, fee);
assert("100% win chance", always, 100);
assert("passes at 100%", passesMinWin(always, 100) ? 1 : 0, 1);

// Lottery: 10% big win
const lottery = calcWinPct(
  [
    { price: 2000, prob: 0.1 },
    { price: 40, prob: 0.9 },
  ],
  totalCost,
  fee
);
assert("lottery ~10% win", lottery, 10);
assert("fails default 40%", passesMinWin(lottery, 40) ? 1 : 0, 0);
assert("passes at 10%", passesMinWin(lottery, 10) ? 1 : 0, 1);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll win-chance checks passed");
