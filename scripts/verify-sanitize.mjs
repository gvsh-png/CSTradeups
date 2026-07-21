/**
 * Ensure sanitize no longer crushes MW premiums down to FT.
 * Run: node scripts/verify-sanitize.mjs
 */

function r2(n) {
  return Math.round(n * 100) / 100;
}

const WEARS = [
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
];

function marketHashName(skin, wear) {
  return `${skin} (${wear})`;
}

/** Mirror of fixed sanitizePrices */
function sanitizePrices(prices, skinName) {
  const sanitized = { ...prices };
  const get = (wear) => sanitized[marketHashName(skinName, wear)] || 0;
  const set = (wear, price) => {
    sanitized[marketHashName(skinName, wear)] = r2(price);
  };

  for (let i = 1; i < WEARS.length; i++) {
    const better = get(WEARS[i - 1]);
    const worse = get(WEARS[i]);
    if (better > 0 && worse > 0 && worse > better * 1.2) {
      set(WEARS[i], better * 0.95);
    }
  }

  for (let i = 1; i < WEARS.length - 1; i++) {
    const prev = get(WEARS[i - 1]);
    const cur = get(WEARS[i]);
    const next = get(WEARS[i + 1]);
    if (prev > 0 && next > 0 && cur > Math.max(prev, next) * 3) {
      set(WEARS[i], (prev + next) / 2);
    }
  }
  return sanitized;
}

/** Old broken median clamp (for contrast) */
function oldSanitize(prices, skinName) {
  const sanitized = { ...prices };
  const wearPrices = WEARS.map((w) => prices[marketHashName(skinName, w)]).filter(
    (p) => p > 0
  );
  const sorted = [...wearPrices].sort((a, b) => a - b);
  const mid =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
  const inliers = wearPrices.filter((w) => w >= mid * 0.3 && w <= mid * 3);
  const fallback = inliers.sort((a, b) => a - b)[Math.floor(inliers.length / 2)];
  for (const wear of WEARS) {
    const key = marketHashName(skinName, wear);
    const p = sanitized[key];
    if (p && (p > mid * 3 || p < mid * 0.3)) sanitized[key] = fallback;
  }
  return sanitized;
}

// No FN listing — common for cheap skins; old median clamp crushed MW → FT
const calf = {
  "MAC-10 | Calf Skin (Minimal Wear)": 0.27,
  "MAC-10 | Calf Skin (Field-Tested)": 0.09,
  "MAC-10 | Calf Skin (Well-Worn)": 0.08,
  "MAC-10 | Calf Skin (Battle-Scarred)": 0.05,
};

const oldMw = oldSanitize(calf, "MAC-10 | Calf Skin")[
  "MAC-10 | Calf Skin (Minimal Wear)"
];
const newMw = sanitizePrices(calf, "MAC-10 | Calf Skin")[
  "MAC-10 | Calf Skin (Minimal Wear)"
];

let failed = 0;
function assert(name, ok, detail = "") {
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed++;
}

assert("old sanitize crushed MW", oldMw < 0.15, `old MW=${oldMw}`);
assert("new sanitize keeps MW ~0.27", newMw === 0.27, `new MW=${newMw}`);

// Control Panel style: BS spike above FT
const control = {
  "M4A1-S | Control Panel (Field-Tested)": 8,
  "M4A1-S | Control Panel (Well-Worn)": 7,
  "M4A1-S | Control Panel (Battle-Scarred)": 57,
};
const fixedBs = sanitizePrices(control, "M4A1-S | Control Panel")[
  "M4A1-S | Control Panel (Battle-Scarred)"
];
assert("BS spike above WW clamped", fixedBs < 10, `BS=${fixedBs}`);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll sanitize checks passed");
