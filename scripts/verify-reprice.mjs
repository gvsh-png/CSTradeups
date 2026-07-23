/**
 * repriceTradeUp must not invent free / 100% win contracts when prices are missing.
 * Run: node scripts/verify-reprice.mjs
 */

function r2(n) {
  return Math.round(n * 100) / 100;
}

function getPrice(prices, skinName, wear) {
  return prices[`${skinName} (${wear})`] || 0;
}

function clampWinPct(n) {
  if (n >= 99.995) return 100;
  if (n > 99.99) return 99.99;
  if (n < 0.01 && n > 0) return 0.01;
  return r2(n);
}

function metricsFromDisplayOutcomes(outcomes, totalCost, fee) {
  const ev = r2(
    outcomes.reduce((s, o) => s + o.price * (1 - fee) * (o.prob / 100), 0)
  );
  const expectedProfit = r2(ev - totalCost);
  const roi = totalCost > 0 ? r2((expectedProfit / totalCost) * 100) : 0;
  return { expectedValue: ev, expectedProfit, roi };
}

/** Mirrors lib/tradeup/generator.ts repriceTradeUp */
function repriceTradeUp(tradeUp, prices) {
  const fee = tradeUp.fee;

  const inputs = tradeUp.inputs.map((input) => {
    const price = getPrice(prices, input.name, input.wear);
    return { ...input, price };
  });
  if (!inputs.length || inputs.some((i) => !(i.price > 0))) {
    return null;
  }

  const totalCost = r2(inputs.reduce((s, i) => s + i.price * i.count, 0));
  if (!(totalCost > 0)) return null;

  const outcomes = tradeUp.outcomes
    .map((o) => {
      const price = getPrice(prices, o.name, o.wear);
      const profit = r2(price * (1 - fee) - totalCost);
      return { ...o, price, profit };
    })
    .sort((a, b) => b.price - a.price);

  if (!outcomes.length || outcomes.some((o) => !(o.price > 0))) {
    return null;
  }

  const { expectedValue, expectedProfit, roi } = metricsFromDisplayOutcomes(
    outcomes,
    totalCost,
    fee
  );

  let winPct = 0;
  let allWin = outcomes.length > 0;
  for (const o of outcomes) {
    if (o.profit >= 0) winPct += o.prob;
    else allWin = false;
  }
  winPct = allWin ? 100 : clampWinPct(winPct);

  return {
    ...tradeUp,
    inputs,
    outcomes,
    totalCost,
    expectedValue,
    expectedProfit,
    roi,
    winPct,
  };
}

const base = {
  fee: 0.02,
  inputs: [
    {
      name: "AK-47 | Redline",
      wear: "Field-Tested",
      count: 10,
      price: 10,
    },
  ],
  outcomes: [
    {
      name: "M4A1-S | Hot Rod",
      wear: "Factory New",
      price: 50,
      prob: 60,
    },
    {
      name: "AWP | Corticera",
      wear: "Field-Tested",
      price: 5,
      prob: 40,
    },
  ],
};

let failed = 0;
function assert(name, cond) {
  console.log(`${cond ? "OK" : "FAIL"} ${name}`);
  if (!cond) failed++;
}

const priced = {
  "AK-47 | Redline (Field-Tested)": 10,
  "M4A1-S | Hot Rod (Factory New)": 50,
  "AWP | Corticera (Field-Tested)": 5,
};

const ok = repriceTradeUp(base, priced);
assert("fully priced refresh succeeds", ok != null && ok.totalCost === 100);
assert("fully priced winPct not forced to 100", ok != null && ok.winPct < 100);

const missingInput = {
  "M4A1-S | Hot Rod (Factory New)": 50,
  "AWP | Corticera (Field-Tested)": 5,
};
const badInput = repriceTradeUp(base, missingInput);
assert("missing input price rejected (no $0 / 100% win)", badInput === null);

const missingOutcome = {
  "AK-47 | Redline (Field-Tested)": 10,
  "M4A1-S | Hot Rod (Factory New)": 50,
};
const badOutcome = repriceTradeUp(base, missingOutcome);
assert("missing outcome price rejected", badOutcome === null);

// Regression: old bug path would report totalCost 0 and winPct 100
function repriceTradeUpBuggy(tradeUp, prices) {
  const fee = tradeUp.fee;
  const inputs = tradeUp.inputs.map((input) => ({
    ...input,
    price: getPrice(prices, input.name, input.wear),
  }));
  const totalCost = r2(inputs.reduce((s, i) => s + i.price * i.count, 0));
  const outcomes = tradeUp.outcomes.map((o) => {
    const price = getPrice(prices, o.name, o.wear);
    return { ...o, price, profit: r2(price * (1 - fee) - totalCost) };
  });
  let winPct = 0;
  let allWin = outcomes.length > 0;
  for (const o of outcomes) {
    if (o.profit >= 0) winPct += o.prob;
    else allWin = false;
  }
  winPct = allWin ? 100 : clampWinPct(winPct);
  return { totalCost, winPct };
}
const buggy = repriceTradeUpBuggy(base, missingInput);
assert(
  "documents old bug: missing inputs → $0 cost + 100% win",
  buggy.totalCost === 0 && buggy.winPct === 100
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll reprice checks passed");
