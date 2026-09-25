/**
 * Cross-wear spike sanitize — drop lone ghosts, keep inverted ladders.
 * Run: node scripts/verify-sanitize.mjs
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

function sanitizePrices(prices) {
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
      const betterRows = priced.filter(
        (x) => (WEAR_RANK[x.wear] ?? 99) < rank && out[x.key] > 0
      );
      if (!betterRows.length) continue;
      if (betterRows.length === 1) {
        const onlyRank = WEAR_RANK[betterRows[0].wear];
        if (onlyRank == null) continue;
        const adjacent = onlyRank === rank - 1;
        if (!adjacent && onlyRank === 0) continue;
      }
      const better = betterRows.map((x) => out[x.key]);
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

let failed = 0;
function assert(name, cond) {
  console.log(`${cond ? "OK" : "FAIL"} ${name}`);
  if (!cond) failed++;
}

// First Class inverted ladder — keep BS premium
const firstClass = sanitizePrices({
  "Sawed-Off | First Class (Field-Tested)": 32,
  "Sawed-Off | First Class (Well-Worn)": 58,
  "Sawed-Off | First Class (Battle-Scarred)": 70,
});
assert(
  "First Class BS preserved",
  firstClass["Sawed-Off | First Class (Battle-Scarred)"] === 70
);

// CaliCamo ghost WW vs liquid wears
const cali = sanitizePrices({
  "Negev | CaliCamo (Factory New)": 0.08,
  "Negev | CaliCamo (Field-Tested)": 0.05,
  "Negev | CaliCamo (Well-Worn)": 529.56,
  "Negev | CaliCamo (Battle-Scarred)": 0.04,
});
assert(
  "CaliCamo WW ghost dropped",
  cali["Negev | CaliCamo (Well-Worn)"] === undefined
);
assert(
  "CaliCamo FT kept",
  cali["Negev | CaliCamo (Field-Tested)"] === 0.05
);

// Blind Spot — FT sale spike vs normal wear ladder (~$14)
const blind = sanitizePrices({
  "P90 | Blind Spot (Factory New)": 16.5,
  "P90 | Blind Spot (Minimal Wear)": 16.4,
  "P90 | Blind Spot (Field-Tested)": 124.38,
  "P90 | Blind Spot (Well-Worn)": 13.7,
  "P90 | Blind Spot (Battle-Scarred)": 12.1,
});
assert(
  "Blind Spot FT spike dropped",
  blind["P90 | Blind Spot (Field-Tested)"] === undefined
);
assert(
  "Blind Spot MW kept",
  blind["P90 | Blind Spot (Minimal Wear)"] === 16.4
);

// AXIA — BS quoted near FN while real BS is ~$25–40 (old 3.5× mid missed this)
const axia = sanitizePrices({
  "Glock-18 | AXIA (Factory New)": 102,
  "Glock-18 | AXIA (Minimal Wear)": 36,
  "Glock-18 | AXIA (Field-Tested)": 28,
  "Glock-18 | AXIA (Well-Worn)": 32,
  "Glock-18 | AXIA (Battle-Scarred)": 105.16,
});
assert(
  "AXIA BS above FN dropped",
  axia["Glock-18 | AXIA (Battle-Scarred)"] === undefined
);
assert(
  "AXIA FN kept",
  axia["Glock-18 | AXIA (Factory New)"] === 102
);
assert(
  "AXIA FT kept",
  axia["Glock-18 | AXIA (Field-Tested)"] === 28
);

// AXIA without FN — BS still dominates MW/FT
const axiaNoFn = sanitizePrices({
  "Glock-18 | AXIA (Minimal Wear)": 36,
  "Glock-18 | AXIA (Field-Tested)": 28,
  "Glock-18 | AXIA (Battle-Scarred)": 105,
});
assert(
  "AXIA BS without FN dropped",
  axiaNoFn["Glock-18 | AXIA (Battle-Scarred)"] === undefined
);

// Bulldozer — SteamApis safe BS stuck at $7.90 while FN–WW ~$275–376
const bulldozer = sanitizePrices({
  "SG 553 | Bulldozer (Factory New)": 376.4,
  "SG 553 | Bulldozer (Minimal Wear)": 335.08,
  "SG 553 | Bulldozer (Field-Tested)": 336.05,
  "SG 553 | Bulldozer (Well-Worn)": 275.41,
  "SG 553 | Bulldozer (Battle-Scarred)": 7.9,
});
assert(
  "Bulldozer ghost-cheap BS dropped",
  bulldozer["SG 553 | Bulldozer (Battle-Scarred)"] === undefined
);
assert(
  "Bulldozer WW kept",
  bulldozer["SG 553 | Bulldozer (Well-Worn)"] === 275.41
);

// Normal cheap BS vs mid FN — keep (BS ~20% of better mid)
const redline = sanitizePrices({
  "AK-47 | Redline (Factory New)": 80,
  "AK-47 | Redline (Minimal Wear)": 45,
  "AK-47 | Redline (Field-Tested)": 22,
  "AK-47 | Redline (Well-Worn)": 18,
  "AK-47 | Redline (Battle-Scarred)": 14,
});
assert(
  "Redline BS kept",
  redline["AK-47 | Redline (Battle-Scarred)"] === 14
);

// Sparse MW + dump BS (FT/WW/FN missing) — non-adjacent single better.
// Requires ≥2 betters on main → ghost BS survived → generator bought BS.
const mwBsDump = sanitizePrices({
  "SG 553 | Bulldozer (Minimal Wear)": 335,
  "SG 553 | Bulldozer (Battle-Scarred)": 7.9,
});
assert(
  "MW-only book drops ghost-cheap BS",
  mwBsDump["SG 553 | Bulldozer (Battle-Scarred)"] === undefined
);
assert(
  "MW-only book keeps MW",
  mwBsDump["SG 553 | Bulldozer (Minimal Wear)"] === 335
);

// FT + dump BS (non-adjacent, sole better is not FN)
const ftBsDump = sanitizePrices({
  "AK-47 | Vulcan (Field-Tested)": 95,
  "AK-47 | Vulcan (Battle-Scarred)": 8,
});
assert(
  "FT-only book drops ghost-cheap BS",
  ftBsDump["AK-47 | Vulcan (Battle-Scarred)"] === undefined
);

// Sparse FN+BS with a real-ish spread — do NOT wipe (collector FN premium)
const sparseFnBs = sanitizePrices({
  "X | Sparse (Factory New)": 70,
  "X | Sparse (Battle-Scarred)": 60,
});
assert(
  "sparse FN+BS keeps FN",
  sparseFnBs["X | Sparse (Factory New)"] === 70
);
assert(
  "sparse FN+BS keeps BS (non-adjacent FN sole better exempt)",
  sparseFnBs["X | Sparse (Battle-Scarred)"] === 60
);

// Adjacent single better still arms (WW≪BS dump)
const wwBsDump = sanitizePrices({
  "M4A4 | Asiimov (Well-Worn)": 42,
  "M4A4 | Asiimov (Battle-Scarred)": 4,
});
assert(
  "WW-only book drops adjacent ghost-cheap BS",
  wwBsDump["M4A4 | Asiimov (Battle-Scarred)"] === undefined
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll sanitize checks passed");
