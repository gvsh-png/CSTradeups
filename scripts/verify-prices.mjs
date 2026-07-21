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
  if (hi / lo <= 2) return r2((sa + sp) / 2);

  const saMid = median(steamApisSiblings.filter((p) => p > 0));
  const spMid = median(skinportSiblings.filter((p) => p > 0));

  if (sa === hi && saMid > 0 && sa > saMid * 2.5) return sp;
  if (sp === hi && spMid > 0 && sp > spMid * 2.5) return sa;

  if (saMid > 0 && spMid > 0) {
    if (spMid / saMid >= 2.5) return sp;
    if (saMid / spMid >= 2.5) return sa;
  }

  if (hi / lo >= 5) return hi;
  return sa;
}

let failed = 0;
function assert(name, got, expected) {
  const ok = got === expected;
  console.log(`${ok ? "OK" : "FAIL"} ${name}: got ${got}, expected ${expected}`);
  if (!ok) failed++;
}

// Zeno MW: Steam ~$1.02, Skinport cheap ~$0.43 → keep Steam
assert(
  "Zeno MW prefer SteamApis",
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

// Extreme disagreement, no siblings → higher (avoid fake ROI)
assert("extreme gap prefer higher", resolveSourceConflict(1.27, 70, [], []), 70);

// Close sources: average at any price level (no $30 ceiling)
assert("average when close", resolveSourceConflict(6.2, 5.9, [], []), 6.05);
assert(
  "high-value close sources average",
  resolveSourceConflict(620, 648, [], []),
  634
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
assert(
  "mid-tier close sources average",
  resolveSourceConflict(45, 38, [], []),
  41.5
);

assert("median even", median([6, 57]), 31.5);

/** Ghost wears with zero Steam sold and zero Skinport listings are dropped */
function hasBuyableLiquidity(liq) {
  return liq.steamSold7 > 0 || liq.steamSold30 > 0 || liq.skinportQty > 0;
}

assert(
  "dead Steam+Skinport rejected",
  hasBuyableLiquidity({ steamSold7: 0, steamSold30: 0, skinportQty: 0 }) ? 1 : 0,
  0
);
assert(
  "Steam sold30 keeps item",
  hasBuyableLiquidity({ steamSold7: 0, steamSold30: 2, skinportQty: 0 }) ? 1 : 0,
  1
);
assert(
  "Skinport listing keeps item",
  hasBuyableLiquidity({ steamSold7: 0, steamSold30: 0, skinportQty: 1 }) ? 1 : 0,
  1
);
assert(
  "Steam sold7 alone keeps item",
  hasBuyableLiquidity({ steamSold7: 1, steamSold30: 0, skinportQty: 0 }) ? 1 : 0,
  1
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll price checks passed");
