/**
 * Steam live Starting-at helpers.
 * Run: node scripts/verify-steam-live.mjs
 */

function r2(n) {
  return Math.round(n * 100) / 100;
}

function parseSteamUsdPrice(raw) {
  if (!raw || typeof raw !== "string") return 0;
  const cleaned = raw.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  return n > 0 ? r2(n) : 0;
}

function marketHashFromParts(name, wear) {
  if (name.startsWith("★ ") && !name.includes(" | ")) return name;
  return `${name} (${wear})`;
}

function collectTradeUpMarketNames(tradeUps, limit = 48) {
  const names = [];
  const seen = new Set();
  for (const tu of tradeUps) {
    for (const input of tu.inputs || []) {
      const key = marketHashFromParts(input.name, input.wear);
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(key);
      if (names.length >= limit) return names;
    }
    for (const out of tu.outcomes || []) {
      const key = marketHashFromParts(out.name, out.wear);
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(key);
      if (names.length >= limit) return names;
    }
  }
  return names;
}

function mergeLiveSteamPrices(bulk, live) {
  if (!live || !Object.keys(live).length) return bulk;
  return { ...bulk, ...live };
}

function applySteamLiveStrict(bulk, live, requiredNames) {
  const prices = { ...bulk };
  const missing = [];
  for (const name of requiredNames) {
    const livePrice = live[name] || 0;
    if (livePrice > 0) prices[name] = livePrice;
    else {
      delete prices[name];
      missing.push(name);
    }
  }
  return { prices, missing };
}

function tradeUpHasFullSteamLive(tradeUp, live) {
  for (const input of tradeUp.inputs || []) {
    const key = marketHashFromParts(input.name, input.wear);
    if (!(live[key] > 0)) return false;
  }
  for (const out of tradeUp.outcomes || []) {
    const key = marketHashFromParts(out.name, out.wear);
    if (!(live[key] > 0)) return false;
  }
  return true;
}

/** Mirrors lib/steamLive.ts applySteamLiveForRefresh */
function applySteamLiveForRefresh(bulk, live, requiredNames, tradeUp) {
  const full =
    requiredNames.length > 0 &&
    requiredNames.every((name) => (live[name] || 0) > 0) &&
    tradeUpHasFullSteamLive(tradeUp, live);
  if (full) {
    return {
      prices: applySteamLiveStrict(bulk, live, requiredNames).prices,
      steamLiveStrict: true,
    };
  }
  return {
    prices: mergeLiveSteamPrices(bulk, live),
    steamLiveStrict: false,
  };
}

function repriceTradeUp(tradeUp, prices) {
  const fee = tradeUp.fee;
  const inputs = tradeUp.inputs.map((input) => {
    const key = marketHashFromParts(input.name, input.wear);
    return { ...input, price: prices[key] || 0 };
  });
  const totalCost = r2(inputs.reduce((s, i) => s + i.price * i.count, 0));
  const outcomes = tradeUp.outcomes.map((o) => {
    const key = marketHashFromParts(o.name, o.wear);
    const price = prices[key] || 0;
    return { ...o, price, profit: r2(price * (1 - fee) - totalCost) };
  });
  let winPct = 0;
  let allWin = outcomes.length > 0;
  for (const o of outcomes) {
    if (o.profit >= 0) winPct += o.prob;
    else allWin = false;
  }
  const ev = outcomes.reduce(
    (s, o) => s + (o.prob / 100) * o.price * (1 - fee),
    0
  );
  return {
    totalCost,
    expectedProfit: r2(ev - totalCost),
    winPct: allWin ? 100 : winPct,
    inputs,
  };
}

let failed = 0;
function assert(name, got, expected) {
  const ok = got === expected;
  console.log(`${ok ? "OK" : "FAIL"} ${name}: got ${got}, expected ${expected}`);
  if (!ok) failed++;
}

assert("parse $0.77", parseSteamUsdPrice("$0.77"), 0.77);
assert("parse $1,234.56", parseSteamUsdPrice("$1,234.56"), 1234.56);
assert("parse empty", parseSteamUsdPrice(""), 0);

const names = collectTradeUpMarketNames([
  {
    inputs: [
      { name: "G3SG1 | Scavenger", wear: "Well-Worn", count: 4 },
      { name: "P90 | Vent Rush", wear: "Well-Worn", count: 6 },
    ],
    outcomes: [
      { name: "Desert Eagle | Mecha Industries", wear: "Field-Tested" },
      { name: "G3SG1 | Scavenger", wear: "Well-Worn" },
    ],
  },
]);
assert("dedupe collect", names.length, 3);
assert(
  "scavenger key",
  names.includes("G3SG1 | Scavenger (Well-Worn)") ? 1 : 0,
  1
);

const merged = mergeLiveSteamPrices(
  { "G3SG1 | Scavenger (Well-Worn)": 0.52, "P90 | Vent Rush (Well-Worn)": 0.41 },
  { "G3SG1 | Scavenger (Well-Worn)": 0.77 }
);
assert("live overlays bulk", merged["G3SG1 | Scavenger (Well-Worn)"], 0.77);
assert("untouched kept", merged["P90 | Vent Rush (Well-Worn)"], 0.41);

const strict = applySteamLiveStrict(
  {
    "G3SG1 | Scavenger (Well-Worn)": 0.52,
    "P90 | Vent Rush (Well-Worn)": 0.41,
  },
  { "G3SG1 | Scavenger (Well-Worn)": 0.77 },
  ["G3SG1 | Scavenger (Well-Worn)", "P90 | Vent Rush (Well-Worn)"]
);
assert("strict live wins", strict.prices["G3SG1 | Scavenger (Well-Worn)"], 0.77);
assert(
  "strict clears missing bulk",
  strict.prices["P90 | Vent Rush (Well-Worn)"] === undefined ? 1 : 0,
  1
);
assert("strict missing count", strict.missing.length, 1);

// --- Refresh PARTIAL must keep bulk for misses (not strict-delete → $0) ---
const refreshTu = {
  fee: 0.02,
  inputs: [
    { name: "Skin A", wear: "FT", count: 7, price: 5 },
    { name: "Skin B", wear: "FT", count: 3, price: 2 },
  ],
  outcomes: [
    { name: "Out A", wear: "FT", price: 80, prob: 70 },
    { name: "Out B", wear: "FT", price: 40, prob: 30 },
  ],
};
const refreshBulk = {
  "Skin A (FT)": 5,
  "Skin B (FT)": 2,
  "Out A (FT)": 80,
  "Out B (FT)": 40,
};
const refreshNames = Object.keys(refreshBulk);
// Skin B timed out; outcomes + Skin A returned — classic PARTIAL $0 input wipe
const partialLive = {
  "Skin A (FT)": 4.8,
  "Out A (FT)": 82,
  "Out B (FT)": 40,
};

const buggyStrict = applySteamLiveStrict(
  refreshBulk,
  partialLive,
  refreshNames
);
const buggy = repriceTradeUp(refreshTu, buggyStrict.prices);
assert("buggy partial zeros Skin B", buggy.inputs[1].price, 0);
assert("buggy partial win% 100", buggy.winPct, 100);

const fixedPartial = applySteamLiveForRefresh(
  refreshBulk,
  partialLive,
  refreshNames,
  refreshTu
);
assert("partial not strict", fixedPartial.steamLiveStrict ? 1 : 0, 0);
assert(
  "partial keeps Skin B bulk",
  fixedPartial.prices["Skin B (FT)"],
  2
);
assert(
  "partial overlays Skin A live",
  fixedPartial.prices["Skin A (FT)"],
  4.8
);
const fixed = repriceTradeUp(refreshTu, fixedPartial.prices);
// cost = 4.8*7 + 2*3 = 39.6; Out B 40*0.98-39.6 < 0 → win 70 not 100
assert("partial cost keeps filler", fixed.totalCost, 39.6);
assert("partial win% stays 70", fixed.winPct, 70);

const fullLive = {
  "Skin A (FT)": 4.8,
  "Skin B (FT)": 1.9,
  "Out A (FT)": 82,
  "Out B (FT)": 41,
};
const fixedFull = applySteamLiveForRefresh(
  refreshBulk,
  fullLive,
  refreshNames,
  refreshTu
);
assert("full is strict", fixedFull.steamLiveStrict ? 1 : 0, 1);
assert("full Skin B live", fixedFull.prices["Skin B (FT)"], 1.9);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll steam-live checks passed");
