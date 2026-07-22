/**
 * ROI and avg profit must match the display percents on outcome rows.
 * Run: node scripts/verify-roi.mjs
 */

function r2(n) {
  return Math.round(n * 100) / 100;
}

function fractionsToPercents(fractions) {
  if (!fractions.length) return [];
  const total = fractions.reduce((s, p) => s + (p > 0 ? p : 0), 0);
  if (!(total > 0)) return fractions.map(() => 0);
  const exact = fractions.map((p) => ((p > 0 ? p : 0) / total) * 10000);
  const floors = exact.map((x) => Math.floor(x + 1e-9));
  let left = 10000 - floors.reduce((s, n) => s + n, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = [...floors];
  for (let k = 0; k < left; k++) {
    out[order[k % order.length].i]++;
  }
  return out.map((n) => n / 100);
}

function metricsFromDisplayOutcomes(outcomes, totalCost, fee) {
  const ev = outcomes.reduce(
    (s, o) => s + (o.prob / 100) * o.price * (1 - fee),
    0
  );
  const expectedProfit = r2(ev - totalCost);
  const roi = totalCost > 0 ? r2((expectedProfit / totalCost) * 100) : 0;
  return { expectedValue: r2(ev), expectedProfit, roi };
}

let failed = 0;
function assert(name, cond, detail = "") {
  console.log(`${cond ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failed++;
}

const fee = 0.02;
const totalCost = 7.73;
const raw = [0.2, 0.2, 0.2, 0.2, 0.2];
const probs = fractionsToPercents(raw);
const prices = [4.13, 2.69, 2.0, 1.81, 1.77];
const outcomes = probs.map((prob, i) => ({
  prob,
  price: prices[i],
  profit: r2(prices[i] * (1 - fee) - totalCost),
}));

const { expectedProfit, roi } = metricsFromDisplayOutcomes(
  outcomes,
  totalCost,
  fee
);

// Weighted sum of per-outcome profits must match header avg profit
const weightedProfit = r2(
  outcomes.reduce((s, o) => s + (o.prob / 100) * o.profit, 0)
);
assert(
  "avg profit matches weighted outcomes",
  expectedProfit === weightedProfit,
  `ev=${expectedProfit} weighted=${weightedProfit}`
);

const impliedRoi = r2((expectedProfit / totalCost) * 100);
assert("roi matches profit ÷ cost", roi === impliedRoi, `roi=${roi} implied=${impliedRoi}`);

// Old bug: raw fractional EV vs display percents could diverge
const rawEv = raw.reduce((s, p, i) => s + p * prices[i] * (1 - fee), 0);
const rawProfit = r2(rawEv - totalCost);
const rawRoi = r2((rawProfit / totalCost) * 100);
// With equal 20% splits, raw and display should match — sanity only
assert("equal split raw=display", rawProfit === expectedProfit);

// Unequal split where naive r2 overshoots 100%
const rawMix = [2 / 10 / 3, 2 / 10 / 3, 2 / 10 / 3, 8 / 10 / 3, 8 / 10 / 3, 8 / 10 / 3];
const mixProbs = fractionsToPercents(rawMix);
const mixPrices = [10, 10, 10, 5, 5, 5];
const mixCost = 8;
const mixOutcomes = mixProbs.map((prob, i) => ({
  prob,
  price: mixPrices[i],
}));
const mix = metricsFromDisplayOutcomes(mixOutcomes, mixCost, fee);
const mixWeighted = r2(
  mixOutcomes.reduce(
    (s, o) => s + (o.prob / 100) * (o.price * (1 - fee) - mixCost),
    0
  )
);
assert(
  "mixed contract ROI consistent",
  mix.expectedProfit === mixWeighted,
  `profit=${mix.expectedProfit} weighted=${mixWeighted}`
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll ROI checks passed");
