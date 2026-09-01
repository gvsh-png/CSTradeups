/**
 * Souvenir mode must keep ≥1 souvenir in each input pool.
 * Without that, weapon-diversity fills with cheaper normals and the
 * post-filter wipes every contract for collections with ≥4 weapons.
 *
 * Run: node scripts/verify-souvenir-pool.mjs
 */

function weaponOf(skinName) {
  let name = skinName;
  if (name.startsWith("Souvenir ")) name = name.slice("Souvenir ".length);
  return name.split(" | ")[0] || name;
}

function isSouvenirCandidate(opt) {
  return Boolean(
    opt.skin.isSouvenir || opt.skin.name.startsWith("Souvenir ")
  );
}

/** Mirrors lib/tradeup/generator.ts pickInputPoolCandidates */
function pickInputPoolCandidates(options, poolSize, requireSouvenir = false) {
  const sorted = [...options].sort((a, b) => a.price - b.price);
  const picked = [];
  const seenWeapons = new Set();

  for (const opt of sorted) {
    if (picked.length >= poolSize) break;
    const w = weaponOf(opt.skin.name);
    if (seenWeapons.has(w)) continue;
    seenWeapons.add(w);
    picked.push(opt);
  }
  for (const opt of sorted) {
    if (picked.length >= poolSize) break;
    if (picked.some((p) => p.skin.name === opt.skin.name)) continue;
    picked.push(opt);
  }

  if (
    requireSouvenir &&
    picked.length > 0 &&
    !picked.some(isSouvenirCandidate)
  ) {
    const souv = sorted.find(
      (o) =>
        isSouvenirCandidate(o) &&
        !picked.some((p) => p.skin.name === o.skin.name)
    );
    if (souv) {
      let replaceAt = -1;
      let worst = -Infinity;
      for (let i = 0; i < picked.length; i++) {
        if (isSouvenirCandidate(picked[i])) continue;
        if (picked[i].price >= worst) {
          worst = picked[i].price;
          replaceAt = i;
        }
      }
      if (replaceAt >= 0) picked[replaceAt] = souv;
      else picked.push(souv);
    }
  }

  return picked;
}

/** Pre-fix buggy picker (diversity only, no souvenir reserve) */
function pickBuggy(options, poolSize) {
  return pickInputPoolCandidates(options, poolSize, false);
}

let failed = 0;
function assert(name, cond, detail = "") {
  console.log(`${cond ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failed++;
}

const weapons = ["AK-47", "USP-S", "Glock-18", "P250", "MP9"];
const options = [];
for (const w of weapons) {
  options.push({
    skin: { name: `${w} | Paint`, isSouvenir: false },
    price: 1.0,
  });
  options.push({
    skin: { name: `Souvenir ${w} | Paint`, isSouvenir: true },
    price: 1.2,
  });
}

const buggy = pickBuggy(options, 4);
assert(
  "buggy picker drops all souvenirs when ≥4 weapons",
  !buggy.some(isSouvenirCandidate),
  buggy.map((p) => p.skin.name).join(", ")
);

const fixed = pickInputPoolCandidates(options, 4, true);
assert(
  "souvenir mode keeps ≥1 souvenir",
  fixed.some(isSouvenirCandidate),
  fixed.map((p) => p.skin.name).join(", ")
);
assert("souvenir mode still fills pool", fixed.length === 4);

// Replaces most expensive normal (P250 @ 1.0 among first-pass normals)
assert(
  "keeps cheaper normals for mix diversity",
  fixed.some((p) => p.skin.name === "AK-47 | Paint")
);

// Sparse pool (<4 weapons): second pass already adds a souvenir
const sparse = options.filter((o) =>
  ["AK-47", "USP-S", "Glock-18"].some((w) => o.skin.name.includes(w))
);
const sparseFixed = pickInputPoolCandidates(sparse, 4, true);
assert(
  "sparse pools still include a souvenir",
  sparseFixed.some(isSouvenirCandidate)
);

// No souvenir priced at all — do not invent one
const normalsOnly = options.filter((o) => !isSouvenirCandidate(o));
const noSouv = pickInputPoolCandidates(normalsOnly, 4, true);
assert(
  "no crash when souvenirs unpriced",
  noSouv.length === 4 && !noSouv.some(isSouvenirCandidate)
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll souvenir pool checks passed");
