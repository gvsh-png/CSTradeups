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

function mergePriceCandidates(candidates) {
  const valid = candidates.filter((p) => p > 0).sort((a, b) => a - b);
  if (!valid.length) return 0;
  if (valid.length === 1) return valid[0];
  if (valid.length === 2) {
    const [lo, hi] = valid;
    if (hi / lo > 2) return lo;
    return r2((lo + hi) / 2);
  }
  const mid = median(valid);
  const filtered = valid.filter((p) => p >= mid * 0.45 && p <= mid * 2.2);
  if (!filtered.length) return mid;
  return median(filtered);
}

function mergeTwoSources(sa, sp) {
  if (sa > 0 && sp > 0) {
    const hi = Math.max(sa, sp);
    const lo = Math.min(sa, sp);
    if (hi / lo > 2) return sp; // prefer Skinport
    return r2((sa + sp) / 2);
  }
  return mergePriceCandidates([sa, sp].filter((p) => p > 0));
}

let failed = 0;
function assert(name, got, expected) {
  const ok = got === expected;
  console.log(`${ok ? "OK" : "FAIL"} ${name}: got ${got}, expected ${expected}`);
  if (!ok) failed++;
}

// Control Panel BS style spike
assert("merge candidates 6.08 vs 57.51", mergePriceCandidates([6.08, 57.51]), 6.08);
assert("prefer skinport on disagree", mergeTwoSources(57.51, 6.08), 6.08);
assert("average when close", mergeTwoSources(6.2, 5.9), 6.05);
assert("median even", median([6, 57]), 31.5);
assert("single source", mergePriceCandidates([6.08]), 6.08);

// Wear-order style clamp simulation
function clampWorse(better, worse) {
  if (better > 0 && worse > 0 && worse > better * 1.12) return r2(better * 0.92);
  return worse;
}
assert("BS above FT clamped", clampWorse(8, 57.51), 7.36);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll price checks passed");
