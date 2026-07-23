/**
 * Quick sanity checks for price merge / outlier handling.
 * Run: node scripts/verify-prices.mjs
 */

function r2(n) {
  return Math.round(n * 100) / 100;
}

function median(nums) {
  const valid = nums.filter((n) => n > 0).sort((a, b) => a - b);
  if (!valid.length) return 0;
  const mid = Math.floor(valid.length / 2);
  if (valid.length % 2 === 0) return r2((valid[mid - 1] + valid[mid]) / 2);
  return valid[mid];
}

function resolveSourceConflict(
  steamApis,
  skinport,
  steamApisSiblings = [],
  skinportSiblings = []
) {
  const sa = steamApis > 0 ? steamApis : 0;
  const sp = skinport > 0 ? skinport : 0;

  if (sa > 0 && sp <= 0) return sa;
  if (sp > 0 && sa <= 0) return sp;
  if (sa <= 0 && sp <= 0) return 0;

  const hi = Math.max(sa, sp);
  const lo = Math.min(sa, sp);
  const saMid = median(steamApisSiblings.filter((p) => p > 0));
  const spMid = median(skinportSiblings.filter((p) => p > 0));

  if (sa === hi && saMid > 0 && sa > saMid * 2.5) return sp;
  if (saMid > 0 && spMid > 0 && spMid / saMid >= 2.5) return sp;
  if (hi / lo >= 5 && sa > 0) return sa;
  return sa;
}

function resolveSteamApisPrice(item) {
  const p = item.prices;
  if (!p) return 0;
  const ts = p.safe_ts || {};
  const last7 = ts.last_7d || 0;
  const last30 = ts.last_30d || 0;
  const safe = p.safe || 0;
  const latest = p.latest || 0;
  const historicalMin = p.min || 0;
  // `min` is historical lowest sale — never treat as live listing
  return r2(last7 || last30 || safe || latest || historicalMin || 0);
}

/** Skinport: never use suggested_price */
function resolveSkinportPrice(item) {
  const qty = item.quantity || 0;
  const min = item.min_price && item.min_price > 0 && qty > 0 ? item.min_price : 0;
  const med = item.median_price && item.median_price > 0 ? item.median_price : 0;
  const mean = item.mean_price && item.mean_price > 0 ? item.mean_price : 0;

  if (min > 0 && med > min * 2) return r2(min);
  if (min > 0 && mean > min * 2) return r2(min);
  if (med > 0) return r2(med);
  if (mean > 0) return r2(mean);
  if (min > 0) return r2(min);
  return 0;
}

let failed = 0;
function assert(name, got, expected) {
  const ok = got === expected;
  console.log(`${ok ? "OK" : "FAIL"} ${name}: got ${got}, expected ${expected}`);
  if (!ok) failed++;
}

// Zeno MW: Steam Market is source of truth
assert(
  "Zeno MW prefer Steam",
  resolveSourceConflict(1.02, 0.43, [1.36, 0.55, 0.4], [0.5, 0.35, 0.3]),
  1.02
);

// Control Panel BS: Steam spike $57 vs SA siblings ~$8 → Skinport
assert(
  "Control Panel BS reject Steam spike",
  resolveSourceConflict(57.51, 6.08, [12, 9, 7.5, 6.5], [8, 7, 6]),
  6.08
);

// First Class BS: SteamApis book stuck ~$1, Skinport ~$70 → Skinport
assert(
  "First Class reject underpriced SteamApis ladder",
  resolveSourceConflict(1.27, 70, [1.5, 1.4, 1.2], [55, 50, 60]),
  70
);

// Extreme disagreement, no siblings → trust SteamApis
// (rejects Skinport $529 ghosts vs Steam $0.05; keeps souvenir Steam books)
assert(
  "extreme gap prefer SteamApis (ghost reject)",
  resolveSourceConflict(0.05, 529.56, [], []),
  0.05
);
assert(
  "extreme gap Steam high Skinport low → Steam",
  resolveSourceConflict(70, 1.27, [], []),
  70
);
assert(
  "souvenir Death Strike-style stub rejected",
  resolveSourceConflict(450, 0.09, [], []),
  450
);

// Close sources: prefer Steam
assert("Steam when close", resolveSourceConflict(6.2, 5.9, [], []), 6.2);
assert(
  "high-value close sources → Steam",
  resolveSourceConflict(620, 648, [], []),
  620
);
assert(
  "mid-tier close sources → Steam",
  resolveSourceConflict(45, 38, [], []),
  45
);
assert(
  "Acid Etched / Skinport cheaper → still Steam",
  resolveSourceConflict(0.4, 0.37, [0.42, 0.38], [0.35, 0.36]),
  0.4
);
assert(
  "Steam safe/window preferred over historical min",
  resolveSteamApisPrice({
    prices: {
      min: 0.37,
      latest: 0.42,
      safe: 0.4,
      safe_ts: { last_7d: 0.41, last_30d: 0.4 },
      sold: { last_7d: 20, last_30d: 80 },
    },
  }),
  0.41
);
assert(
  "high Steam-only kept when liquid",
  resolveSourceConflict(511, 0, [], []),
  511
);
assert(
  "high Skinport-only kept",
  resolveSourceConflict(0, 511, [], []),
  511
);

assert("median even", median([6, 57]), 31.5);

// Skinport suggested ghosts
assert(
  "suggested-only qty0 → 0",
  resolveSkinportPrice({
    market_hash_name: "Negev | CaliCamo (Well-Worn)",
    median_price: null,
    mean_price: null,
    min_price: null,
    suggested_price: 529.56,
    quantity: 0,
  }),
  0
);
assert(
  "suggested ignored even with qty",
  resolveSkinportPrice({
    market_hash_name: "X",
    median_price: null,
    mean_price: null,
    min_price: null,
    suggested_price: 99,
    quantity: 5,
  }),
  0
);
assert(
  "min_price with qty kept",
  resolveSkinportPrice({
    market_hash_name: "Y",
    median_price: null,
    mean_price: null,
    min_price: 0.04,
    suggested_price: 50,
    quantity: 12,
  }),
  0.04
);
assert(
  "min_price qty0 rejected",
  resolveSkinportPrice({
    market_hash_name: "Z",
    median_price: null,
    mean_price: null,
    min_price: 0.04,
    suggested_price: null,
    quantity: 0,
  }),
  0
);
assert(
  "median preferred over suggested",
  resolveSkinportPrice({
    market_hash_name: "W",
    median_price: 0.06,
    mean_price: null,
    min_price: 0.05,
    suggested_price: 400,
    quantity: 3,
  }),
  0.06
);
assert(
  "Blind Spot spiked median → live min",
  resolveSkinportPrice({
    market_hash_name: "P90 | Blind Spot (Field-Tested)",
    median_price: 124.38,
    mean_price: 80,
    min_price: 14.2,
    suggested_price: null,
    quantity: 8,
  }),
  14.2
);
assert(
  "AXIA BS median ~2.6× live min → prefer min",
  resolveSkinportPrice({
    market_hash_name: "Glock-18 | AXIA (Battle-Scarred)",
    median_price: 105.16,
    mean_price: 90,
    min_price: 39.22,
    suggested_price: null,
    quantity: 11,
  }),
  39.22
);

/** Per-source liquidity helpers (mirror mergeBulkSources) */
function steamUsable(price, liq) {
  return price > 0 && (liq.steamSold7 > 0 || liq.steamSold30 > 0) ? price : 0;
}
function skinportUsable(price, liq) {
  return price > 0 && liq.skinportQty > 0 ? price : 0;
}

assert(
  "Steam sold does NOT unlock Skinport ghost",
  skinportUsable(529.56, { steamSold7: 5, steamSold30: 20, skinportQty: 0 }),
  0
);
assert(
  "Skinport qty unlocks Skinport",
  skinportUsable(0.06, { steamSold7: 0, steamSold30: 0, skinportQty: 4 }),
  0.06
);
assert(
  "Steam sold unlocks Steam",
  steamUsable(2.16, { steamSold7: 0, steamSold30: 3, skinportQty: 0 }),
  2.16
);

/** Live Steam band: latest≈median can override stale safe */
function resolveCheapSteamPrice(safe, latest, median = 0) {
  const s = safe > 0 ? safe : 0;
  const l = latest > 0 ? latest : 0;
  const m = median > 0 ? median : 0;
  const LIVE = 40;

  let fresh = 0;
  let consensus = false;
  if (l > 0 && m > 0) {
    const hi = Math.max(l, m);
    const lo = Math.min(l, m);
    if (hi / lo <= 1.25) {
      fresh = (l + m) / 2;
      consensus = true;
    }
  }

  if (!(s > 0)) return fresh > 0 ? r2(fresh) : l || m ? r2(l || m) : 0;
  if (s > LIVE && !(consensus && fresh <= LIVE)) return r2(s);

  if (consensus && fresh > 0) {
    const maxRef = Math.max(s, fresh);
    if (maxRef <= LIVE * 1.25) {
      if (fresh / s >= 1.35 || s / fresh >= 1.35) {
        if (fresh > s) return r2(fresh);
        return r2(Math.min(l, m));
      }
      const lower = Math.min(s, l, m);
      if (lower >= s * 0.7) return r2(lower);
    }
  }

  const one = l || m;
  if (one > 0 && one >= s * 0.7 && one <= s * 1.05 && s <= LIVE) {
    return r2(Math.min(s, one));
  }
  return r2(s);
}

assert(
  "Anodized-style: latest≈median under safe → Starting at",
  resolveCheapSteamPrice(2.59, 2.24, 2.2),
  2.2
);
assert(
  "Airlock-style: stale-low safe, fresh consensus → pull up",
  resolveCheapSteamPrice(8.09, 16.6, 16.5),
  16.55
);
assert(
  "cheap but latest dumped alone → keep safe",
  resolveCheapSteamPrice(2.59, 0.4, 0),
  2.59
);
assert(
  "latest spiked vs median → keep safe",
  resolveCheapSteamPrice(14, 80, 14.5),
  14
);
assert(
  "expensive skin stays on safe",
  resolveCheapSteamPrice(376.4, 350, 360),
  376.4
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll price checks passed");
