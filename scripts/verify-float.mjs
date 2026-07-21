/**
 * Verify the new CS2 trade-up float formula (normalized per-input floats,
 * float32 precision) and per-skin float-cap wear rules.
 * Run: node scripts/verify-float.mjs
 */

const f32 = Math.fround;

const WEAR_RANGES = [
  { name: "Factory New", min: 0, max: 0.07 },
  { name: "Minimal Wear", min: 0.07, max: 0.15 },
  { name: "Field-Tested", min: 0.15, max: 0.38 },
  { name: "Well-Worn", min: 0.38, max: 0.45 },
  { name: "Battle-Scarred", min: 0.45, max: 1.0 },
];

function norm(f, min, max) {
  return max <= min ? 0 : f32((f32(f) - f32(min)) / (f32(max) - f32(min)));
}

function outF(n, min, max) {
  return f32(f32(min) + f32(n) * f32(f32(max) - f32(min)));
}

function getWear(float) {
  if (float < 0.07) return "Factory New";
  if (float < 0.15) return "Minimal Wear";
  if (float < 0.38) return "Field-Tested";
  if (float < 0.45) return "Well-Worn";
  return "Battle-Scarred";
}

function wearIntersection(minF, maxF, wear) {
  const band = WEAR_RANGES.find((w) => w.name === wear);
  if (!band) return null;
  const lo = Math.max(minF, band.min);
  const hi = Math.min(maxF, band.max);
  if (!(hi > lo)) return null;
  return { lo, hi };
}

function possibleWears(minF, maxF, minSpan = 0.01) {
  return WEAR_RANGES.map((w) => w.name).filter((name) => {
    const hit = wearIntersection(minF, maxF, name);
    return Boolean(hit && hit.hi - hit.lo >= minSpan - 1e-9);
  });
}

let failed = 0;
function assert(name, ok, detail = "") {
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed++;
}

// Case 1: MAC-10 Calf Skin (0–1 range) float 0.11 → n = 0.11
{
  const n = norm(0.11, 0, 1);
  assert("full-range skin normalizes to itself", Math.abs(n - 0.11) < 1e-6, `n=${n}`);
}

// Case 2: SSG 08 Zeno (0–0.7) float 0.11 → n = 0.157142…
{
  const n = norm(0.11, 0, 0.7);
  assert(
    "Zeno 0.11 normalizes to ~0.1571 (matches TradeUpSpy A-value)",
    Math.abs(n - 0.15714285) < 1e-5,
    `n=${n}`
  );
}

// Case 3: Ten Zeno inputs at 0.11 → USP-S Check Engine (0–0.6) output
{
  const n = norm(0.11, 0, 0.7); // 0.157142…
  const avgN = f32((n * 10) / 10);
  const out = outF(avgN, 0, 0.6);
  assert(
    "output float maps into outcome range (0.0943 for 0–0.6)",
    Math.abs(out - 0.0942857) < 1e-4,
    `out=${out}`
  );
  assert("output wear MW", getWear(out) === "Minimal Wear", getWear(out));
}

// Case 4: mixed collections weighted by count
{
  const nA = norm(0.11, 0, 0.7); // 0.1571
  const nB = norm(0.2, 0, 1); // 0.2
  const avgN = f32((nA * 5 + nB * 5) / 10);
  const expected = (0.15714285714 + 0.2) / 2;
  assert(
    "mixed avgN weights per-input normalized floats",
    Math.abs(avgN - expected) < 1e-5,
    `avgN=${avgN}`
  );
}

// Case 5: outcome min offset respected (e.g. 0.06–0.8 skin)
{
  const avgN = 0.5;
  const out = outF(avgN, 0.06, 0.8);
  assert(
    "outcome min offset respected",
    Math.abs(out - (0.06 + 0.5 * 0.74)) < 1e-5,
    `out=${out}`
  );
}

// Case 6: Hot Rod (0–0.08) — only FN/MW exist, never FT/WW/BS
{
  const wears = possibleWears(0, 0.08);
  assert(
    "Hot Rod possible wears FN+MW only",
    wears.join(",") === "Factory New,Minimal Wear",
    wears.join(",")
  );
}

// Case 7: Minotaur's Labyrinth (0–0.39) — WW band is only ~0.01, not buyable
{
  const loose = possibleWears(0, 0.39, 0.01);
  const strict = possibleWears(0, 0.39, 0.025);
  assert("Minotaur has no Battle-Scarred", !loose.includes("Battle-Scarred"));
  assert("Minotaur allows Field-Tested", loose.includes("Field-Tested"));
  assert(
    "Minotaur WW blocked for inputs (strict span)",
    !strict.includes("Well-Worn"),
    strict.join(",")
  );
}

// Case 6b: Hot Rod input wears — MW too thin under strict span, FN ok
{
  const strict = possibleWears(0, 0.08, 0.025);
  assert(
    "Hot Rod input wears FN only under strict span",
    strict.join(",") === "Factory New",
    strict.join(",")
  );
}

// Case 8: Nitro (0.06–0.8) — cannot go below 0.06 (no clean 0.00 FN)
{
  const wears = possibleWears(0.06, 0.8);
  assert("Nitro still allows Factory New band", wears.includes("Factory New"));
  const out = outF(0, 0.06, 0.8);
  assert("Nitro floor at minF", Math.abs(out - 0.06) < 1e-6, `out=${out}`);
}

// Case 9: Icarus Fell / Chronos caps — avgN=1 maps to maxF, never above
{
  const icarus = outF(1, 0, 0.1);
  const chronos = outF(1, 0, 0.4);
  assert("Icarus never above 0.10", icarus <= 0.1 + 1e-6, `out=${icarus}`);
  assert("Chronos never above 0.40", chronos <= 0.4 + 1e-6, `out=${chronos}`);
  assert("Icarus wear MW at cap", getWear(icarus) === "Minimal Wear");
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll float formula checks passed");
