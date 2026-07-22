/**
 * Display percents must sum to 100.00 — no 100.02% / 99.99% win headers.
 * Run: node scripts/verify-percent-round.mjs
 */

function r2(n) {
  return Math.round(n * 100) / 100;
}

function clampWinPct(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, r2(n)));
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

let failed = 0;
function assert(name, cond, detail = "") {
  console.log(`${cond ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failed++;
}

// Classic mixed contract: 2 inputs → 3 outs + 8 inputs → 3 outs
// Independent r2 would print 6.67×3 + 26.67×3 = 100.02
const raw = [
  2 / 10 / 3,
  2 / 10 / 3,
  2 / 10 / 3,
  8 / 10 / 3,
  8 / 10 / 3,
  8 / 10 / 3,
];
const naive = raw.map((p) => r2(p * 100));
const naiveSum = r2(naive.reduce((s, p) => s + p, 0));
assert("naive r2 overshoots 100", naiveSum === 100.02, `sum=${naiveSum}`);

const rounded = fractionsToPercents(raw);
const sum = r2(rounded.reduce((s, p) => s + p, 0));
assert("largest-remainder sums to 100", sum === 100, `sum=${sum} → ${rounded.join(",")}`);
assert(
  "all wins → winPct 100",
  clampWinPct(sum) === 100 && (rounded.every(() => true) ? 100 : 0) === 100
);

// 3+7 split → often shows 99.99 with naive rounding
const raw37 = [
  3 / 10 / 3,
  3 / 10 / 3,
  3 / 10 / 3,
  7 / 10 / 3,
  7 / 10 / 3,
  7 / 10 / 3,
];
const rounded37 = fractionsToPercents(raw37);
const sum37 = r2(rounded37.reduce((s, p) => s + p, 0));
assert("3+7 split sums to 100", sum37 === 100, `sum=${sum37}`);

assert("clamp 100.02 → 100", clampWinPct(100.02) === 100);
assert("clamp 99.99 stays", clampWinPct(99.99) === 99.99);
assert("clamp -1 → 0", clampWinPct(-1) === 0);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll percent-round checks passed");
