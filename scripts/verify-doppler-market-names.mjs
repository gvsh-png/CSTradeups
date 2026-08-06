/**
 * CSFloat Doppler finishes must collapse onto Steam market titles with weight.
 * Run: node scripts/verify-doppler-market-names.mjs
 */

function normalizeSpecialPaintName(paintName) {
  const p = (paintName || "").trim();
  if (!p) return "Vanilla";
  if (
    /^Doppler(\s+Phase\s+[1-4]|\s*\((?:Phase\s+[1-4]|Ruby|Sapphire|Black Pearl)\))$/i.test(
      p
    )
  ) {
    return "Doppler";
  }
  if (
    /^Gamma Doppler(\s+Phase\s+[1-4]|\s*\((?:Phase\s+[1-4]|Emerald)\))$/i.test(
      p
    )
  ) {
    return "Gamma Doppler";
  }
  return p;
}

function specialItemMarketName(weaponName, paintName) {
  const paint = normalizeSpecialPaintName(paintName);
  const vanilla =
    !paint || paint.toLowerCase() === "vanilla" || paint === "—";
  if (vanilla) return `★ ${weaponName}`;
  return `★ ${weaponName} | ${paint}`;
}

/** Mirror of buildSpecialOutcomesByCollection merge for one collection */
function buildSpecialPool(paints) {
  const byName = new Map();
  for (const p of paints) {
    const name = specialItemMarketName(p.weapon, p.paint);
    const prev = byName.get(name);
    if (prev) prev.outcomeWeight += 1;
    else byName.set(name, { name, outcomeWeight: 1 });
  }
  return [...byName.values()];
}

/** Buggy regex that only matched legacy "Doppler Phase N" (no parentheses) */
function normalizeBuggy(paintName) {
  const p = (paintName || "").trim();
  if (!p) return "Vanilla";
  if (/^Doppler Phase [1-4]$/i.test(p)) return "Doppler";
  if (/^Gamma Doppler Phase [1-4]$/i.test(p)) return "Gamma Doppler";
  return p;
}

function buggyMarketName(weaponName, paintName) {
  const paint = normalizeBuggy(paintName);
  const vanilla =
    !paint || paint.toLowerCase() === "vanilla" || paint === "—";
  if (vanilla) return `★ ${weaponName}`;
  return `★ ${weaponName} | ${paint}`;
}

let failed = 0;
function assert(name, ok, detail = "") {
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

// CSFloat live schema forms
assert(
  "Phase 1 parenthetical → Doppler",
  normalizeSpecialPaintName("Doppler (Phase 1)") === "Doppler"
);
assert(
  "Ruby parenthetical → Doppler",
  normalizeSpecialPaintName("Doppler (Ruby)") === "Doppler"
);
assert(
  "Sapphire parenthetical → Doppler",
  normalizeSpecialPaintName("Doppler (Sapphire)") === "Doppler"
);
assert(
  "Black Pearl parenthetical → Doppler",
  normalizeSpecialPaintName("Doppler (Black Pearl)") === "Doppler"
);
assert(
  "Gamma Phase 2 parenthetical → Gamma Doppler",
  normalizeSpecialPaintName("Gamma Doppler (Phase 2)") === "Gamma Doppler"
);
assert(
  "Emerald parenthetical → Gamma Doppler",
  normalizeSpecialPaintName("Gamma Doppler (Emerald)") === "Gamma Doppler"
);

// Legacy forms still work
assert(
  "legacy Doppler Phase 3",
  normalizeSpecialPaintName("Doppler Phase 3") === "Doppler"
);
assert(
  "legacy Gamma Doppler Phase 1",
  normalizeSpecialPaintName("Gamma Doppler Phase 1") === "Gamma Doppler"
);

// Non-Doppler paints untouched (incl. glove Emerald Web)
assert(
  "Tiger Tooth unchanged",
  normalizeSpecialPaintName("Tiger Tooth") === "Tiger Tooth"
);
assert(
  "Emerald Web unchanged",
  normalizeSpecialPaintName("Emerald Web") === "Emerald Web"
);
assert(
  "bare Emerald unchanged",
  normalizeSpecialPaintName("Emerald") === "Emerald"
);

// Chroma-style knife pool: 7 Doppler finishes + 1 Marble Fade
{
  const paints = [
    "Doppler (Phase 1)",
    "Doppler (Phase 2)",
    "Doppler (Phase 3)",
    "Doppler (Phase 4)",
    "Doppler (Ruby)",
    "Doppler (Sapphire)",
    "Doppler (Black Pearl)",
    "Marble Fade",
  ].map((paint) => ({ weapon: "Bayonet", paint }));

  const fixed = buildSpecialPool(paints);
  const doppler = fixed.find((x) => x.name === "★ Bayonet | Doppler");
  const marble = fixed.find((x) => x.name === "★ Bayonet | Marble Fade");
  assert("fixed pool size 2", fixed.length === 2, `len=${fixed.length}`);
  assert("Doppler weight 7", doppler?.outcomeWeight === 7, String(doppler?.outcomeWeight));
  assert("Marble weight 1", marble?.outcomeWeight === 1, String(marble?.outcomeWeight));

  const buggyNames = paints.map((p) => buggyMarketName(p.weapon, p.paint));
  const uniqueBuggy = new Set(buggyNames);
  assert(
    "buggy path keeps phase/gem Steam-invalid titles",
    uniqueBuggy.size === 8 &&
      [...uniqueBuggy].some((n) => n.includes("(Phase 1)")),
    [...uniqueBuggy].join(" | ")
  );

  // Odds: Doppler should be 7/8 of the knife family in this stub
  const totalW = fixed.reduce((s, x) => s + x.outcomeWeight, 0);
  const dopplerProb = doppler.outcomeWeight / totalW;
  assert(
    "Doppler keeps 7/8 probability mass",
    Math.abs(dopplerProb - 7 / 8) < 1e-9,
    String(dopplerProb)
  );
}

// Weapon skin path: Glock Gamma Doppler finishes collapse with weight
{
  const finishes = [
    "Gamma Doppler (Phase 1)",
    "Gamma Doppler (Phase 2)",
    "Gamma Doppler (Phase 3)",
    "Gamma Doppler (Phase 4)",
    "Gamma Doppler (Emerald)",
  ];
  const byName = new Map();
  for (const paint of finishes) {
    const title = normalizeSpecialPaintName(paint);
    const name = `Glock-18 | ${title}`;
    const prev = byName.get(name);
    if (prev) prev.outcomeWeight += 1;
    else byName.set(name, { name, outcomeWeight: 1 });
  }
  assert("weapon pool one market row", byName.size === 1);
  const row = byName.get("Glock-18 | Gamma Doppler");
  assert("weapon Gamma Doppler weight 5", row?.outcomeWeight === 5);

  const buggyWeapon = finishes.map((p) => `Glock-18 | ${normalizeBuggy(p)}`);
  assert(
    "buggy weapon path keeps phase titles",
    new Set(buggyWeapon).size === 5 &&
      buggyWeapon[0] === "Glock-18 | Gamma Doppler (Phase 1)"
  );
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nverify-doppler-market-names: ok");
