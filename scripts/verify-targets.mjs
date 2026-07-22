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

function searchTargetableOutcomes(skins, query, limit = 25) {
  const q = query.trim().toLowerCase();
  if (!q) return skins.slice(0, limit);
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const skin of skins) {
    const name = skin.name.toLowerCase();
    if (!tokens.every((t) => name.includes(t))) continue;
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
