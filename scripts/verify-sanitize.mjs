/**
 * Cross-wear spike sanitize — drop lone ghosts, keep inverted ladders.
 * Run: node scripts/verify-sanitize.mjs
 */

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
    const sorted = [...vals].sort((a, b) => a - b);
    const mid =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    if (mid <= 0) continue;

    for (const key of keys) {
      const p = out[key];
      if (!(p > 0)) continue;
      if (p > mid * 3.5 && p > mid + 5) {
        delete out[key];
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

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll sanitize checks passed");
