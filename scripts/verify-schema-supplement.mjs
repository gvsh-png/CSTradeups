/**
 * Ascent schema: prefer live CSFloat caps; supplement only as gap-fill.
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
const ASCENT_LIVE_KEY = "set_timed_drops_cool";

/** Caps mirrored from live CSFloat (must stay in sync with schema-supplement). */
const LIVE_CAPS = {
  "M4A1-S | Stratosphere": { min: 0, max: 0.8 },
  "USP-S | Royal Guard": { min: 0, max: 0.6 },
  "AK-47 | Midnight Laminate": { min: 0, max: 0.75 },
  "Desert Eagle | Mint Fan": { min: 0, max: 0.6 },
  "FAMAS | Yeti Camo": { min: 0, max: 0.7 },
};

const ASCENT_ENTRIES = [
  {
    defIndex: "60",
    weapon: "M4A1-S",
    paint: "Stratosphere",
    rarity: 5,
    min: 0,
    max: 0.8,
  },
  {
    defIndex: "7",
    weapon: "AK-47",
    paint: "Midnight Laminate",
    rarity: 4,
    min: 0,
    max: 0.75,
  },
  {
    defIndex: "61",
    weapon: "USP-S",
    paint: "Royal Guard",
    rarity: 4,
    min: 0,
    max: 0.6,
  },
  {
    defIndex: "1",
    weapon: "Desert Eagle",
    paint: "Mint Fan",
    rarity: 3,
    min: 0,
    max: 0.6,
  },
  {
    defIndex: "10",
    weapon: "FAMAS",
    paint: "Yeti Camo",
    rarity: 3,
    min: 0,
    max: 0.7,
  },
  {
    defIndex: "32",
    weapon: "P2000",
    paint: "Royal Baroque",
    rarity: 3,
    min: 0,
    max: 0.6,
  },
  {
    defIndex: "34",
    weapon: "MP9",
    paint: "Cobalt Paisley",
    rarity: 3,
    min: 0,
    max: 0.65,
  },
  {
    defIndex: "19",
    weapon: "P90",
    paint: "Reef Grief",
    rarity: 3,
    min: 0,
    max: 0.6,
  },
  {
    defIndex: "4",
    weapon: "Glock-18",
    paint: "Ocean Topo",
    rarity: 2,
    min: 0,
    max: 0.6,
  },
  {
    defIndex: "16",
    weapon: "M4A4",
    paint: "Naval Shred Camo",
    rarity: 2,
    min: 0,
    max: 0.6,
  },
];

const EXCLUDED_KEYWORDS = [
  "armory",
  "armoury",
  "timed_drops",
  "timed-drops",
  "anubis",
  "exuberant",
  "opulent",
];
const TRADEUP_ALLOWED_COLLECTION_KEYS = new Set([ASCENT_LIVE_KEY]);

function isExcludedColName(name) {
  const nm = name.toLowerCase();
  return (
    EXCLUDED_KEYWORDS.some((k) => nm.includes(k)) || nm.includes("exclusive")
  );
}

function isTradeUpBannedCollection(key, name) {
  if (TRADEUP_ALLOWED_COLLECTION_KEYS.has(key)) return false;
  if (name && isExcludedColName(name)) return true;
  if (isExcludedColName(key)) return true;
  return false;
}

function schemaHasLiveAscent(schema) {
  for (const weapon of Object.values(schema.weapons || {})) {
    for (const paint of Object.values(weapon.paints || {})) {
      if (paint.collections?.includes(ASCENT_LIVE_KEY)) return true;
    }
  }
  return false;
}

function mergeSchemaSupplement(schema) {
  if (schemaHasLiveAscent(schema)) return schema;
  const collections = [...(schema.collections || [])];
  if (!collections.some((c) => c.key === ASCENT.key)) {
    collections.push({ ...ASCENT });
  }
  const weapons = { ...(schema.weapons || {}) };
  for (const entry of ASCENT_ENTRIES) {
    const paint = {
      name: entry.paint,
      rarity: entry.rarity,
      min: entry.min ?? 0,
      max: entry.max ?? 1,
      collections: [ASCENT.key],
    };
    const existing = weapons[entry.defIndex];
    if (!existing) {
      weapons[entry.defIndex] = {
        name: entry.weapon,
        type: "Rifles",
        paints: { [`ascent_${entry.paint}`]: paint },
      };
      continue;
    }
    weapons[entry.defIndex] = {
      ...existing,
      paints: {
        ...(existing.paints || {}),
        [`ascent_${entry.paint}`]: paint,
      },
    };
  }
  return { ...schema, collections, weapons };
}

function buildSkinDatabase(schema) {
  const colMap = {};
  for (const c of schema.collections || []) colMap[c.key] = c.name;
  const skinDB = [];
  for (const weapon of Object.values(schema.weapons || {})) {
    for (const paint of Object.values(weapon.paints || {})) {
      if (!paint.name || !paint.collections?.length) continue;
      const rarity = RARITY_MAP[paint.rarity];
      if (!rarity) continue;
      const validCols = paint.collections.filter(
        (c) => !isTradeUpBannedCollection(c, colMap[c] || c)
      );
      if (!validCols.length) continue;
      skinDB.push({
        name: `${weapon.name} | ${paint.name}`,
        minF: paint.min ?? 0,
        maxF: paint.max ?? 1,
        rarity,
        collections: validCols.map((c) => ({
          id: c,
          name: colMap[c] || c,
        })),
      });
    }
  }
  const seen = new Set();
  return skinDB.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });
}

/** Concrete float/wear bug: WW Royal Guard → Stratosphere wear band */
function predictedOutFloat(inFloat, inMax, outMax) {
  const n = inFloat / inMax;
  return n * outMax;
}

function wearOf(f) {
  if (f < 0.07) return "FN";
  if (f < 0.15) return "MW";
  if (f < 0.38) return "FT";
  if (f < 0.45) return "WW";
  return "BS";
}

let failed = 0;
function assert(name, cond, detail = "") {
  console.log(`${cond ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failed++;
}

// --- Offline unit checks ---
assert(
  "live Ascent key is not soft-banned",
  !isTradeUpBannedCollection(ASCENT_LIVE_KEY, "The Ascent Collection")
);
assert(
  "other timed_drops keys stay banned",
  isTradeUpBannedCollection("set_timed_drops_warm", "The Radiant Collection")
);
assert(
  "supplement skips when live Ascent paints exist",
  mergeSchemaSupplement({
    collections: [{ key: ASCENT_LIVE_KEY, name: "The Ascent Collection" }],
    weapons: {
      "60": {
        name: "M4A1-S",
        paints: {
          "1216": {
            name: "Stratosphere",
            rarity: 5,
            min: 0,
            max: 0.8,
            collections: [ASCENT_LIVE_KEY],
          },
        },
      },
    },
  }).weapons["60"].paints["ascent_Stratosphere"] === undefined
);

const gapFilled = mergeSchemaSupplement({ collections: [], weapons: {} });
const gapSkin = buildSkinDatabase(gapFilled).find(
  (s) => s.name === "USP-S | Royal Guard"
);
assert("gap-fill injects Royal Guard", Boolean(gapSkin));
assert(
  "gap-fill Royal Guard max is 0.6 (not 0.8/1.0)",
  gapSkin?.maxF === 0.6,
  `maxF=${gapSkin?.maxF}`
);
assert(
  "gap-fill Stratosphere max is 0.8 (not 0.85)",
  buildSkinDatabase(gapFilled).find((s) => s.name === "M4A1-S | Stratosphere")
    ?.maxF === 0.8
);

const badOut = predictedOutFloat(0.4, 0.8, 0.85);
const goodOut = predictedOutFloat(0.4, 0.6, 0.8);
assert(
  "wrong caps predict WW Stratosphere",
  wearOf(badOut) === "WW",
  `f=${badOut.toFixed(4)}`
);
assert(
  "live caps predict BS Stratosphere for same WW inputs",
  wearOf(goodOut) === "BS",
  `f=${goodOut.toFixed(4)}`
);

const byCR = {};
for (const s of buildSkinDatabase(gapFilled)) {
  for (const c of s.collections) {
    const k = `${c.id}|${s.rarity}`;
    byCR[k] = byCR[k] || [];
    byCR[k].push(s);
  }
}
assert(
  "Restricted pool has 2 skins",
  (byCR["set_ascent|Restricted"] || []).length === 2
);

// --- Live schema check ---
fetch("https://csfloat.com/api/v1/schema")
  .then((r) => r.json())
  .then((live) => {
    assert("CSFloat schema includes live Ascent paints", schemaHasLiveAscent(live));

    const merged = mergeSchemaSupplement(live);
    assert(
      "merge leaves live schema unchanged when Ascent present",
      merged === live || !merged.collections.some((c) => c.key === ASCENT.key)
    );

    const skinDB = buildSkinDatabase(merged);
    const strato = skinDB.find((s) => s.name === "M4A1-S | Stratosphere");
    const royal = skinDB.find((s) => s.name === "USP-S | Royal Guard");

    assert("Stratosphere present after allowlist", Boolean(strato));
    assert(
      "Stratosphere uses live collection key",
      Boolean(strato?.collections.some((c) => c.id === ASCENT_LIVE_KEY))
    );
    assert(
      "Stratosphere max matches live 0.8",
      strato?.maxF === LIVE_CAPS["M4A1-S | Stratosphere"].max,
      `maxF=${strato?.maxF}`
    );
    assert(
      "Royal Guard max matches live 0.6",
      royal?.maxF === LIVE_CAPS["USP-S | Royal Guard"].max,
      `maxF=${royal?.maxF}`
    );

    // Spot-check a few more against LIVE_CAPS
    for (const [name, caps] of Object.entries(LIVE_CAPS)) {
      const skin = skinDB.find((s) => s.name === name);
      assert(`${name} in trade-up pool`, Boolean(skin));
      if (skin) {
        assert(
          `${name} float cap`,
          skin.minF === caps.min && skin.maxF === caps.max,
          `got ${skin.minF}-${skin.maxF}`
        );
      }
    }

    if (failed) {
      console.error(`\n${failed} failed`);
      process.exit(1);
    }
    console.log("\nAll schema supplement checks passed");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
