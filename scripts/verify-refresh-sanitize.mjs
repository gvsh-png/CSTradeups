/**
 * Refresh must sanitize the bulk book without depending on fetchSchema.
 * sanitizePrices ignores skinDB — a schema timeout must not leave raw dumps.
 * Run: node scripts/verify-refresh-sanitize.mjs
 */

const WEAR_RANK = {
  "Factory New": 0,
  "Minimal Wear": 1,
  "Field-Tested": 2,
  "Well-Worn": 3,
  "Battle-Scarred": 4,
};

function wearFromPriceKey(key) {
  const open = key.lastIndexOf(" (");
  if (open < 0 || !key.endsWith(")")) return null;
  return key.slice(open + 2, -1);
}

function medianPositive(nums) {
  const sorted = nums.filter((n) => n > 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/** Mirrors lib/tradeup/generator.ts sanitizePrices (skinDB unused). */
function sanitizePrices(prices, _skinDB = []) {
  void _skinDB;
  const out = { ...prices };
  const byBase = new Map();

  for (const key of Object.keys(out)) {
    const idx = key.lastIndexOf(" (");
    const base = idx > 0 ? key.slice(0, idx) : key;
    const list = byBase.get(base);
    if (list) list.push(key);
    else byBase.set(base, [key]);
  }

  for (const keys of byBase.values()) {
    if (keys.length < 2) continue;
    const vals = keys.map((k) => out[k]).filter((p) => p > 0);
    if (vals.length < 2) continue;
    const mid = medianPositive(vals);
    if (mid <= 0) continue;

    for (const key of keys) {
      const p = out[key];
      if (!(p > 0)) continue;
      if (p > mid * 3.5 && p > mid + 5) {
        delete out[key];
      }
    }

    const priced = keys
      .map((key) => {
        const wear = wearFromPriceKey(key);
        const p = out[key];
        return wear && p > 0 ? { key, wear, p } : null;
      })
      .filter(Boolean);

    const fn = priced.find((x) => x.wear === "Factory New")?.p || 0;

    for (const row of priced) {
      if (!(out[row.key] > 0)) continue;
      if (fn > 0) {
        if (row.wear === "Factory New") continue;
        if (row.wear === "Minimal Wear") {
          if (row.p > fn * 1.2) delete out[row.key];
        } else if (row.p > fn) {
          delete out[row.key];
        }
      } else if (
        row.wear === "Well-Worn" ||
        row.wear === "Battle-Scarred"
      ) {
        const rank = WEAR_RANK[row.wear];
        if (rank == null) continue;
        const better = priced
          .filter((x) => (WEAR_RANK[x.wear] ?? 99) < rank && out[x.key] > 0)
          .map((x) => out[x.key]);
        if (!better.length) continue;
        const betterMax = Math.max(...better);
        if (row.p > betterMax * 2.2 && row.p > betterMax + 10) {
          delete out[row.key];
        }
      }
    }

    for (const row of priced) {
      if (!(out[row.key] > 0)) continue;
      const rank = WEAR_RANK[row.wear];
      if (rank == null || rank === 0) continue;
      const better = priced
        .filter((x) => (WEAR_RANK[x.wear] ?? 99) < rank && out[x.key] > 0)
        .map((x) => out[x.key]);
      if (better.length < 2) continue;
      const betterLo = Math.min(...better);
      const betterHi = Math.max(...better);
      if (!(betterLo > 0) || betterHi / betterLo > 3.5) continue;
      const betterMid = medianPositive(better);
      if (betterMid >= 20 && row.p < betterMid * 0.15) {
        delete out[row.key];
      }
    }
  }

  return out;
}

/**
 * Old /api/refresh path: try schema → sanitize; on any throw use raw bulk.
 * New path: always sanitize (empty skinDB).
 */
function refreshPricesOld(bulk, schemaOk) {
  let prices = bulk;
  try {
    if (!schemaOk) throw new Error("Schema fetch failed: 503");
    prices = sanitizePrices(bulk, [{ name: "unused" }]);
  } catch {
    prices = bulk;
  }
  return prices;
}

function refreshPricesNew(bulk) {
  return sanitizePrices(bulk, []);
}

let failed = 0;
function assert(name, cond) {
  console.log(`${cond ? "OK" : "FAIL"} ${name}`);
  if (!cond) failed++;
}

const dumpBook = {
  "SG 553 | Bulldozer (Factory New)": 376.4,
  "SG 553 | Bulldozer (Minimal Wear)": 335.08,
  "SG 553 | Bulldozer (Field-Tested)": 336.05,
  "SG 553 | Bulldozer (Well-Worn)": 275.41,
  "SG 553 | Bulldozer (Battle-Scarred)": 7.9,
};

const oldOnSchemaFail = refreshPricesOld(dumpBook, false);
assert(
  "OLD path on schema fail keeps ghost-cheap BS (bug)",
  oldOnSchemaFail["SG 553 | Bulldozer (Battle-Scarred)"] === 7.9
);

const newOnSchemaFail = refreshPricesNew(dumpBook);
assert(
  "NEW path drops ghost-cheap BS without schema",
  newOnSchemaFail["SG 553 | Bulldozer (Battle-Scarred)"] === undefined
);
assert(
  "NEW path keeps liquid WW",
  newOnSchemaFail["SG 553 | Bulldozer (Well-Worn)"] === 275.41
);

const withSkinDb = sanitizePrices(dumpBook, [{ name: "anything" }]);
const withoutSkinDb = sanitizePrices(dumpBook, []);
assert(
  "skinDB argument does not change sanitize output",
  JSON.stringify(withSkinDb) === JSON.stringify(withoutSkinDb)
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll refresh-sanitize checks passed");
