/**
 * Covert special pools must reject incomplete knife/glove books.
 * Partial filtering + buildOutcomes weight renormalization inflates EV/win%.
 * Run: node scripts/verify-covert-special-probs.mjs
 */

/** Current (fixed) behavior: all-or-nothing */
function pricedSpecialOutcomes(outs, avgN, priceFn) {
  if (!outs.length) return [];
  for (const outSkin of outs) {
    // avgN unused in this stub — wear/price decided by priceFn(name)
    void avgN;
    if (priceFn(outSkin.name) <= 0) return [];
  }
  return outs;
}

/** Buggy 4e3c190 behavior — filter to survivors */
function pricedSpecialOutcomesBuggy(outs, avgN, priceFn) {
  void avgN;
  return outs.filter((outSkin) => priceFn(outSkin.name) > 0);
}

function buildOutcomes(outs, priceFn) {
  const totalWeight = outs.reduce(
    (s, o) => s + Math.max(1, o.outcomeWeight || 1),
    0
  );
  if (totalWeight <= 0) return [];
  const mixed = [];
  for (const outSkin of outs) {
    const price = priceFn(outSkin.name);
    if (price <= 0) return [];
    const weight = Math.max(1, outSkin.outcomeWeight || 1);
    mixed.push({
      name: outSkin.name,
      price,
      prob: weight / totalWeight,
    });
  }
  return mixed;
}

function ev(outcomes, fee = 0.02) {
  return outcomes.reduce((s, o) => s + o.prob * o.price * (1 - fee), 0);
}

let failed = 0;
function assert(name, ok, detail = "") {
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

// 5 knives; 2 missing market prices for the float-derived wear
const rawPool = [
  { name: "Knife-A", outcomeWeight: 1 },
  { name: "Knife-B", outcomeWeight: 1 },
  { name: "Knife-C", outcomeWeight: 1 },
  { name: "Knife-D", outcomeWeight: 1 },
  { name: "Knife-E", outcomeWeight: 1 },
];

const prices = {
  "Knife-A": 400,
  "Knife-B": 350,
  "Knife-C": 50, // cheap / risk
  "Knife-D": 0, // missing
  "Knife-E": 0, // missing
};

const priceFn = (n) => prices[n] || 0;

const fixedPool = pricedSpecialOutcomes(rawPool, 0.5, priceFn);
assert(
  "incomplete Covert pool rejected",
  fixedPool.length === 0,
  `got ${fixedPool.length} skins`
);

const fixedOuts = buildOutcomes(fixedPool, priceFn);
assert("no outcomes from rejected pool", fixedOuts.length === 0);

const buggyPool = pricedSpecialOutcomesBuggy(rawPool, 0.5, priceFn);
const buggyOuts = buildOutcomes(buggyPool, priceFn);
const buggyEv = ev(buggyOuts);
// True odds: each knife 20%. Priced-only EV would still need the missing
// outcomes — honest incomplete EV is unknowable; survivors alone at 33% each:
const survivorEv = ev([
  { prob: 1 / 3, price: 400 },
  { prob: 1 / 3, price: 350 },
  { prob: 1 / 3, price: 50 },
]);
assert(
  "buggy path keeps 3 survivors",
  buggyPool.length === 3,
  `got ${buggyPool.length}`
);
assert(
  "buggy EV matches renormalized survivors",
  Math.abs(buggyEv - survivorEv) < 1e-9,
  `buggy=${buggyEv.toFixed(2)} survivor=${survivorEv.toFixed(2)}`
);

// Full book: all priced → pool kept, probs 20% each
const fullPrices = {
  "Knife-A": 400,
  "Knife-B": 350,
  "Knife-C": 50,
  "Knife-D": 200,
  "Knife-E": 180,
};
const fullFn = (n) => fullPrices[n] || 0;
const fullPool = pricedSpecialOutcomes(rawPool, 0.5, fullFn);
const fullOuts = buildOutcomes(fullPool, fullFn);
assert("complete pool kept", fullPool.length === 5);
assert(
  "complete probs sum to 1",
  Math.abs(fullOuts.reduce((s, o) => s + o.prob, 0) - 1) < 1e-9
);
assert(
  "each knife ~20%",
  fullOuts.every((o) => Math.abs(o.prob - 0.2) < 1e-9),
  fullOuts.map((o) => o.prob.toFixed(3)).join(",")
);

// Honest upper bound if missing knives were $0 (they aren't buyable but
// still exist in CS2 odds): 0.2*(400+350+50+0+0)*0.98 = 156.8
// Buggy survivor EV: ~261.3 — ~67% inflation vs that floor.
const honestFloor = ev([
  { prob: 0.2, price: 400 },
  { prob: 0.2, price: 350 },
  { prob: 0.2, price: 50 },
  { prob: 0.2, price: 0 },
  { prob: 0.2, price: 0 },
]);
assert(
  "buggy EV materially above honest floor",
  buggyEv > honestFloor * 1.4,
  `buggy=${buggyEv.toFixed(2)} floor=${honestFloor.toFixed(2)}`
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll Covert special-prob checks passed");
