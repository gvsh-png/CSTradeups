/**
 * Target outcome helpers — Standard mode skin hunt.
 * Run: node scripts/verify-targets.mjs
 */

const RARITY_ORDER = [
  "Consumer Grade",
  "Industrial Grade",
  "Mil-Spec Grade",
  "Restricted",
  "Classified",
  "Covert",
];

function prevRarity(rarity) {
  const i = RARITY_ORDER.indexOf(rarity);
  if (i <= 0) return null;
  return RARITY_ORDER[i - 1];
}

function targetHitPct(outcomes, targetName) {
  let sum = 0;
  for (const o of outcomes) {
    if (o.name === targetName) sum += o.prob;
  }
  return Math.round(sum * 100) / 100;
}

function searchTokenVariants(token) {
  const t = token.toLowerCase();
  if (t === "m4" || t === "m4a") return ["m4a4", "m4a1-s"];
  if (t === "m4a1") return ["m4a1-s"];
  if (t === "tec" || t === "tec9" || t === "tec-9") return ["tec-9"];
  if (t === "sg" || t === "sg553") return ["sg 553"];
  if (t === "cz" || t === "cz75") return ["cz75-auto"];
  if (t === "glock") return ["glock-18"];
  if (t === "usp") return ["usp-s"];
  if (t === "mp5") return ["mp5-sd"];
  return [t];
}

function nameMatchesSearch(name, tokens) {
  const lower = name.toLowerCase();
  return tokens.every((token) => {
    const variants = searchTokenVariants(token);
    return variants.some((v) => lower.includes(v));
  });
}

function searchTargetableOutcomes(skins, query, limit = 25) {
  const q = query.trim().toLowerCase();
  if (!q) return skins.slice(0, limit);
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const skin of skins) {
    if (!nameMatchesSearch(skin.name, tokens)) continue;
    const name = skin.name.toLowerCase();
    let score = 0;
    if (name.startsWith(q)) score += 40;
    if (name.includes(`| ${q}`)) score += 30;
    score += Math.max(0, 20 - Math.min(20, name.indexOf(tokens[0])));
    score += skin.maxHitPct;
    scored.push({ skin, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.skin.name.localeCompare(b.skin.name)
  );
  return scored.slice(0, limit).map((s) => s.skin);
}

function getTargetBlockReason(skin, byCR) {
  if (skin.isSouvenir || skin.isSpecial) {
    return "Knife, glove, and souvenir skins are not available as Standard targets.";
  }
  const i = RARITY_ORDER.indexOf(skin.rarity);
  if (i <= 0) return "Consumer Grade skins cannot be trade-up outcomes.";
  const prev = prevRarity(skin.rarity);
  if (!prev) return "This rarity cannot be produced by a Standard contract.";

  for (const col of skin.collections) {
    const pool = (byCR[`${col.id}|${skin.rarity}`] || []).filter(
      (s) => !s.isSouvenir && !s.isSpecial
    );
    if (!pool.some((s) => s.name === skin.name)) continue;
    const inputs = (byCR[`${col.id}|${prev}`] || []).filter(
      (s) => !s.isSouvenir && !s.isSpecial
    );
    if (inputs.length) return null;
  }

  return `${skin.name} is the lowest trade-up tier in its collection — there are no ${prev} inputs to trade up from, so it cannot be a contract outcome.`;
}

let failed = 0;
function assert(name, cond, detail = "") {
  console.log(`${cond ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failed++;
}

assert("prev Classified → Restricted", prevRarity("Classified") === "Restricted");
assert("prev Consumer null", prevRarity("Consumer Grade") === null);

// 5+5 mix: 5/10 * 1/2 = 25% for target in 2-skin pool
assert(
  "mixed hit pct",
  targetHitPct(
    [
      { name: "Glock-18 | AXIA", prob: 25 },
      { name: "Other", prob: 25 },
      { name: "Cheap", prob: 50 },
    ],
    "Glock-18 | AXIA"
  ) === 25
);

const skins = [
  { name: "Glock-18 | AXIA", maxHitPct: 50 },
  { name: "AK-47 | Redline", maxHitPct: 20 },
  { name: "AWP | Asiimov", maxHitPct: 25 },
];
const hits = searchTargetableOutcomes(skins, "axia", 10);
assert("search axia", hits.length === 1 && hits[0].name.includes("AXIA"));

const m4Skins = [
  { name: "M4A1-S | Stratosphere", maxHitPct: 25 },
  { name: "M4A4 | Howl", maxHitPct: 10 },
];
const m4Hits = searchTargetableOutcomes(m4Skins, "m4 stratosphere", 10);
assert(
  "search m4 alias → M4A1-S Stratosphere",
  m4Hits.length === 1 && m4Hits[0].name.includes("Stratosphere")
);

const safetyNet = {
  name: "Tec-9 | Safety Net",
  rarity: "Mil-Spec Grade",
  collections: [{ id: "set_train_2021", name: "2021 Train" }],
};
const byCR = {
  "set_train_2021|Mil-Spec Grade": [safetyNet],
  "set_train_2021|Industrial Grade": [],
};
const safetyReason = getTargetBlockReason(safetyNet, byCR);
assert(
  "Safety Net blocked — no Industrial inputs",
  safetyReason !== null && safetyReason.includes("lowest trade-up tier")
);

/** Ranking for target hunt: win% > 0 first, then hit%, then EV */
function rankTargetHunt(a, b, target) {
  const aWin = a.winPct > 0 ? 1 : 0;
  const bWin = b.winPct > 0 ? 1 : 0;
  if (bWin !== aWin) return bWin - aWin;
  const aPos = a.expectedProfit > 0 ? 1 : 0;
  const bPos = b.expectedProfit > 0 ? 1 : 0;
  if (bPos !== aPos) return bPos - aPos;
  const tb = targetHitPct(b.outcomes, target);
  const ta = targetHitPct(a.outcomes, target);
  if (tb !== ta) return tb - ta;
  return b.expectedProfit - a.expectedProfit;
}

const target = "AK-47 | Rat Rod";
const huntCandidates = [
  {
    winPct: 0,
    expectedProfit: -5,
    outcomes: [
      { name: target, prob: 20 },
      { name: "Other", prob: 80 },
    ],
  },
  {
    winPct: 40,
    expectedProfit: 1.5,
    outcomes: [
      { name: target, prob: 10 },
      { name: "Other", prob: 90 },
    ],
  },
  {
    winPct: 20,
    expectedProfit: 0.5,
    outcomes: [
      { name: target, prob: 15 },
      { name: "Other", prob: 85 },
    ],
  },
];
const ranked = [...huntCandidates].sort((a, b) =>
  rankTargetHunt(a, b, target)
);
// Among profitable: higher target hit% first (15% over 10%), losers last
assert(
  "hunt ranks profitable before max-hit loser",
  ranked[0].winPct === 20 && targetHitPct(ranked[0].outcomes, target) === 15
);
assert(
  "hunt second is other profitable",
  ranked[1].winPct === 40 && ranked[1].expectedProfit === 1.5
);
assert("hunt loser last", ranked[ranked.length - 1].winPct === 0);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll target checks passed");
