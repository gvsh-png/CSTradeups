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

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll steam-live checks passed");
