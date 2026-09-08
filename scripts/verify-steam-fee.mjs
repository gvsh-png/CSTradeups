/**
 * Steam Community Market seller fee must be 15% (5% + 10%), not the legacy 13%.
 * Run: node scripts/verify-steam-fee.mjs
 */

const STEAM_FEE = 0.15;
const LEGACY_STEAM_FEE = 0.13;
const CSFLOAT_FEE = 0.02;

function normalizeSellFee(fee) {
  if (fee == null || !Number.isFinite(fee)) return CSFLOAT_FEE;
  if (Math.abs(fee - LEGACY_STEAM_FEE) < 1e-9) return STEAM_FEE;
  if (Math.abs(fee - STEAM_FEE) < 1e-9) return STEAM_FEE;
  if (Math.abs(fee - CSFLOAT_FEE) < 1e-9) return CSFLOAT_FEE;
  return fee;
}

function feeTypeFromFee(fee) {
  return Math.abs(normalizeSellFee(fee) - STEAM_FEE) < 1e-9 ? "steam" : "csfloat";
}

let failed = 0;
function assert(name, ok, detail = "") {
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

// Mirror lib/constants.ts — fail if someone reverts the constant without updating this
const fs = await import("fs");
const constantsSrc = fs.readFileSync(
  new URL("../lib/constants.ts", import.meta.url),
  "utf8"
);
assert(
  "lib/constants.ts exports STEAM_FEE = 0.15",
  /export const STEAM_FEE = 0\.15;/.test(constantsSrc)
);
assert(
  "lib/constants.ts keeps LEGACY_STEAM_FEE = 0.13",
  /export const LEGACY_STEAM_FEE = 0\.13;/.test(constantsSrc)
);
assert(
  "UI no longer advertises Steam · 13%",
  !fs
    .readFileSync(new URL("../components/GeneratorForm.tsx", import.meta.url), "utf8")
    .includes("Steam · 13%")
);
assert(
  "UI advertises Steam · 15%",
  fs
    .readFileSync(new URL("../components/GeneratorForm.tsx", import.meta.url), "utf8")
    .includes("Steam · 15%")
);

assert("normalize upgrades legacy 13% → 15%", normalizeSellFee(0.13) === 0.15);
assert("normalize keeps 15%", normalizeSellFee(0.15) === 0.15);
assert("normalize keeps 2%", normalizeSellFee(0.02) === 0.02);
assert("normalize null → csfloat", normalizeSellFee(null) === 0.02);
assert("feeTypeFromFee(0.13) → steam", feeTypeFromFee(0.13) === "steam");
assert("feeTypeFromFee(0.15) → steam", feeTypeFromFee(0.15) === "steam");
assert("feeTypeFromFee(0.02) → csfloat", feeTypeFromFee(0.02) === "csfloat");

// Marginal contract: gross EV $116 on $100 cost — 13% shows +EV, 15% is -EV
const cost = 100;
const gross = 116;
const shownLegacy = gross * (1 - 0.13) - cost;
const shownFixed = gross * (1 - STEAM_FEE) - cost;
assert(
  "legacy 13% flips break-even to fake +EV",
  shownLegacy > 0 && shownFixed < 0,
  `legacy=${shownLegacy.toFixed(2)} fixed=${shownFixed.toFixed(2)}`
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll steam-fee checks passed");
