/**
 * Missing outcome prices must NOT renormalize remaining odds (EV inflation).
 * Run: node scripts/verify-outcome-probs.mjs
 */

function buildOutcomeProbs(slots, priceFn) {
  const mixed = [];
  for (const slot of slots) {
    for (const out of slot.outs) {
      const price = priceFn(out.name);
      // Fixed behavior: abort the whole set — never drop + renormalize
      if (price <= 0) return [];
      mixed.push({
        name: out.name,
        price,
        prob: (slot.count / 10) * (1 / slot.outs.length),
      });
    }
  }
  return mixed;
}

/** Buggy a16e781 behavior — for regression contrast only */
function buildOutcomeProbsBuggy(slots, priceFn) {
  const mixed = [];
  for (const slot of slots) {
    for (const out of slot.outs) {
      const price = priceFn(out.name);
      if (price <= 0) continue;
      mixed.push({
        name: out.name,
        price,
        prob: (slot.count / 10) * (1 / slot.outs.length),
      });
    }
  }
  const probSum = mixed.reduce((s, o) => s + o.prob, 0);
  if (probSum > 0 && Math.abs(probSum - 1) > 1e-6) {
    for (const o of mixed) o.prob = o.prob / probSum;
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

// Collection A: 5 inputs, 2 outcomes ($100 and $10)
// Collection B: 5 inputs, 2 outcomes ($80 priced, $90 MISSING)
const slots = [
  {
    count: 5,
    outs: [{ name: "A-win" }, { name: "A-lose" }],
  },
  {
    count: 5,
    outs: [{ name: "B-mid" }, { name: "B-ghost" }],
  },
];

const prices = {
  "A-win": 100,
  "A-lose": 10,
  "B-mid": 80,
  "B-ghost": 0, // no liquidity / unknown
};

const fixed = buildOutcomeProbs(slots, (n) => prices[n] || 0);
assert(
  "incomplete outcomes rejected",
  fixed.length === 0,
  `got ${fixed.length} outcomes`
);

const buggy = buildOutcomeProbsBuggy(slots, (n) => prices[n] || 0);
const buggyEv = ev(buggy);
// True EV if B-ghost were known at $90: 0.25*(100+10+80+90)*0.98 = 68.6
// With price 0 kept: 0.25*(100+10+80+0)*0.98 = 46.55
// Buggy renorm: probs become ~0.333 each on three survivors → EV ~62
assert(
  "buggy path still invents odds",
  buggy.length === 3 && Math.abs(buggy.reduce((s, o) => s + o.prob, 0) - 1) < 1e-9,
  `n=${buggy.length} sum=${buggy.reduce((s, o) => s + o.prob, 0).toFixed(4)} ev=${buggyEv.toFixed(2)}`
);
assert(
  "buggy EV exceeds honest zero-price EV",
  buggyEv > 46.55 + 1,
  `buggyEv=${buggyEv.toFixed(2)}`
);

// Complete price map → probs stay at true CS2 weights (sum 1, no scale-up)
const completePrices = { ...prices, "B-ghost": 90 };
const complete = buildOutcomeProbs(slots, (n) => completePrices[n] || 0);
const sum = complete.reduce((s, o) => s + o.prob, 0);
assert("complete set has 4 outcomes", complete.length === 4);
assert("complete probs sum to 1", Math.abs(sum - 1) < 1e-9, `sum=${sum}`);
assert(
  "each outcome is 25%",
  complete.every((o) => Math.abs(o.prob - 0.25) < 1e-9)
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll outcome-prob checks passed");
