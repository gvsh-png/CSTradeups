/**
 * CSFloat schema gap — The Ascent Collection (Stratosphere, etc.)
 * Run: node scripts/verify-schema-supplement.mjs
 */

const RARITY_MAP = {
  1: "Consumer Grade",
  2: "Industrial Grade",
  3: "Mil-Spec Grade",
  4: "Restricted",
  5: "Classified",
  6: "Covert",
};

const ASCENT = { key: "set_ascent", name: "The Ascent Collection" };

const ASCENT_ENTRIES = [
  { defIndex: "60", weapon: "M4A1-S", paint: "Stratosphere", rarity: 5 },
  { defIndex: "7", weapon: "AK-47", paint: "Midnight Laminate", rarity: 4 },
  { defIndex: "61", weapon: "USP-S", paint: "Royal Guard", rarity: 4 },
  { defIndex: "1", weapon: "Desert Eagle", paint: "Mint Fan", rarity: 3 },
  { defIndex: "10", weapon: "FAMAS", paint: "Yeti Camo", rarity: 3 },
  { defIndex: "32", weapon: "P2000", paint: "Royal Baroque", rarity: 3 },
  { defIndex: "34", weapon: "MP9", paint: "Cobalt Paisley", rarity: 3 },
  { defIndex: "19", weapon: "P90", paint: "Reef Grief", rarity: 3 },
  { defIndex: "4", weapon: "Glock-18", paint: "Ocean Topo", rarity: 2 },
  { defIndex: "16", weapon: "M4A4", paint: "Naval Shred Camo", rarity: 2 },
];

function buildFromSupplement() {
  const skinDB = [];
  for (const e of ASCENT_ENTRIES) {
    skinDB.push({
      name: `${e.weapon} | ${e.paint}`,
      rarity: RARITY_MAP[e.rarity],
      collections: [ASCENT],
    });
  }
  return skinDB;
}

function groupByCR(skinDB) {
  const byCR = {};
  for (const s of skinDB) {
    for (const c of s.collections) {
      const k = `${c.key}|${s.rarity}`;
      byCR[k] = byCR[k] || [];
      byCR[k].push(s);
    }
  }
  return byCR;
}

function listTargetable(skinDB, byCR) {
  const out = [];
  for (const skin of skinDB) {
    const prev = {
      "Classified": "Restricted",
      "Restricted": "Mil-Spec Grade",
      "Mil-Spec Grade": "Industrial Grade",
    }[skin.rarity];
    if (!prev) continue;
    const inputs = byCR[`${ASCENT.key}|${prev}`] || [];
    if (!inputs.length) continue;
    const pool = byCR[`${ASCENT.key}|${skin.rarity}`] || [];
    out.push({
      name: skin.name,
      maxHitPct: Math.round((100 / pool.length) * 100) / 100,
    });
  }
  return out;
}

let failed = 0;
function assert(name, cond, detail = "") {
  console.log(`${cond ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failed++;
}

const skinDB = buildFromSupplement();
const byCR = groupByCR(skinDB);
const targets = listTargetable(skinDB, byCR);
const strato = targets.find((s) => s.name === "M4A1-S | Stratosphere");

assert("Stratosphere targetable with Restricted inputs", Boolean(strato));
assert("Stratosphere 100% max hit in Ascent", strato?.maxHitPct === 100);
assert(
  "Restricted pool has 2 skins",
  (byCR["set_ascent|Restricted"] || []).length === 2
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll schema supplement checks passed");
