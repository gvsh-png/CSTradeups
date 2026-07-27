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

const WEAR_SUFFIXES = [
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
];

function isVanillaStarName(name) {
  return name.startsWith("★ ") && !name.includes(" | ");
}

function clearVanillaWearAliases(prices, bareName) {
  if (!isVanillaStarName(bareName)) return;
  for (const wear of WEAR_SUFFIXES) {
    delete prices[`${bareName} (${wear})`];
  }
}

function applySteamLiveStrict(bulk, live, requiredNames) {
  const prices = { ...bulk };
  const missing = [];
  for (const name of requiredNames) {
    const livePrice = live[name] || 0;
    if (livePrice > 0) {
      prices[name] = livePrice;
      clearVanillaWearAliases(prices, name);
    } else {
      delete prices[name];
      clearVanillaWearAliases(prices, name);
      missing.push(name);
    }
  }
  return { prices, missing };
}

/** Mirror lib/prices.ts getPrice vanilla preference */
function getPrice(prices, skinName, wear) {
  if (skinName.startsWith("★ ") && !skinName.includes(" | ")) {
    const bare = prices[skinName] || 0;
    if (bare > 0) return bare;
  }
  return prices[`${skinName} (${wear})`] || 0;
}

/** Mirror live-reprice bulk key construction */
function bulkFromTradeUps(tradeUps) {
  const bulk = {};
  for (const tu of tradeUps) {
    for (const input of tu.inputs || []) {
      const key = marketHashFromParts(input.name, input.wear);
      if (input.price > 0) bulk[key] = input.price;
    }
    for (const out of tu.outcomes || []) {
      const key = marketHashFromParts(out.name, out.wear);
      if (out.price > 0) bulk[key] = out.price;
    }
  }
  return bulk;
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

// Regression: Covert vanilla ★ outcomes carry a float-derived wear in the
// blueprint, but Steam Market lists them bare. live-reprice used to invent
// "★ Karambit (Factory New)" bulk keys that shadowed live Starting-at.
assert(
  "vanilla market hash is bare",
  marketHashFromParts("★ Karambit", "Factory New"),
  "★ Karambit"
);

const vanillaTu = [
  {
    inputs: [{ name: "AK-47 | Redline", wear: "Field-Tested", price: 12, count: 10 }],
    outcomes: [
      { name: "★ Karambit", wear: "Factory New", price: 500 },
      { name: "★ Karambit | Doppler", wear: "Factory New", price: 800 },
    ],
  },
];
const vanillaBulk = bulkFromTradeUps(vanillaTu);
assert(
  "bulk uses bare vanilla key",
  vanillaBulk["★ Karambit"] === 500 ? 1 : 0,
  1
);
assert(
  "bulk does not invent wear-suffixed vanilla",
  vanillaBulk["★ Karambit (Factory New)"] === undefined ? 1 : 0,
  1
);
assert(
  "painted ★ still uses wear suffix",
  vanillaBulk["★ Karambit | Doppler (Factory New)"],
  800
);

const vanillaLive = { "★ Karambit": 1200 };
const vanillaStrict = applySteamLiveStrict(
  {
    "★ Karambit (Factory New)": 500,
    "★ Karambit": 480,
    "AK-47 | Redline (Field-Tested)": 12,
  },
  vanillaLive,
  ["★ Karambit", "AK-47 | Redline (Field-Tested)"]
);
assert("vanilla live wins", vanillaStrict.prices["★ Karambit"], 1200);
assert(
  "vanilla wear alias cleared on live",
  vanillaStrict.prices["★ Karambit (Factory New)"] === undefined ? 1 : 0,
  1
);
assert(
  "getPrice prefers bare live over wear alias",
  getPrice(
    {
      "★ Karambit (Factory New)": 500,
      "★ Karambit": 1200,
    },
    "★ Karambit",
    "Factory New"
  ),
  1200
);

const vanillaMiss = applySteamLiveStrict(
  {
    "★ Karambit (Minimal Wear)": 500,
    "★ Karambit": 480,
  },
  {},
  ["★ Karambit"]
);
assert(
  "missing live clears bare vanilla",
  vanillaMiss.prices["★ Karambit"] === undefined ? 1 : 0,
  1
);
assert(
  "missing live clears wear-suffixed vanilla alias",
  vanillaMiss.prices["★ Karambit (Minimal Wear)"] === undefined ? 1 : 0,
  1
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll steam-live checks passed");
