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

function applyLiveRepriceToTradeUps(tradeUps, bulk, live, reprice) {
  const overlay = mergeLiveSteamPrices(bulk, live);
  let fullLiveCount = 0;
  const results = tradeUps.map((t) => {
    if (tradeUpHasFullSteamLive(t, live)) {
      fullLiveCount++;
      return reprice(t, overlay);
    }
    return t;
  });
  return {
    results,
    fullLiveCount,
    steamLiveStrict: fullLiveCount > 0 && fullLiveCount === results.length,
  };
}

const tuA = {
  id: "a",
  expectedProfit: 1,
  inputs: [{ name: "Skin A", wear: "FT", price: 1 }],
  outcomes: [{ name: "Out A", wear: "FT", price: 10 }],
};
const tuB = {
  id: "b",
  expectedProfit: 2,
  inputs: [{ name: "Skin B", wear: "FT", price: 2 }],
  outcomes: [{ name: "Out B", wear: "FT", price: 20 }],
};
const bulkBook = {
  "Skin A (FT)": 1,
  "Out A (FT)": 10,
  "Skin B (FT)": 2,
  "Out B (FT)": 20,
};
const partialLive = {
  "Skin A (FT)": 1.5,
  "Out A (FT)": 12,
  // Skin B / Out B missing — name cap or Steam timeout
};
const applied = applyLiveRepriceToTradeUps(
  [tuA, tuB],
  bulkBook,
  partialLive,
  (t, prices) => ({
    ...t,
    inputs: t.inputs.map((i) => ({
      ...i,
      price: prices[marketHashFromParts(i.name, i.wear)] ?? 0,
    })),
  })
);
assert("partial live keeps result count", applied.results.length, 2);
assert("partial live updates covered", applied.results[0].inputs[0].price, 1.5);
assert(
  "partial live leaves uncovered bulk",
  applied.results[1].inputs[0].price,
  2
);
assert("partial live fullLiveCount", applied.fullLiveCount, 1);
assert("partial live not strict", applied.steamLiveStrict ? 1 : 0, 0);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll steam-live checks passed");
