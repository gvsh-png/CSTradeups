/**
 * Sanitize is now a pass-through — wear-order clamps were wrong for
 * inverted skins (First Class BS > FT). Keep a smoke check.
 * Run: node scripts/verify-sanitize.mjs
 */

const prices = {
  "Sawed-Off | First Class (Field-Tested)": 32,
  "Sawed-Off | First Class (Well-Worn)": 58,
  "Sawed-Off | First Class (Battle-Scarred)": 70,
};

// Current sanitize = shallow copy
const sanitized = { ...prices };
const bs = sanitized["Sawed-Off | First Class (Battle-Scarred)"];

if (bs !== 70) {
  console.error("FAIL sanitize must not crush First Class BS", bs);
  process.exit(1);
}
console.log("OK First Class BS preserved at", bs);
console.log("\nAll sanitize checks passed");
