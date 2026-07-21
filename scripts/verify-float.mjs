/**
 * Verify the new CS2 trade-up float formula (normalized per-input floats,
 * float32 precision) matches known TradeUpSpy-style behavior.
 * Run: node scripts/verify-float.mjs
 */

const f32 = Math.fround;

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

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll float formula checks passed");
