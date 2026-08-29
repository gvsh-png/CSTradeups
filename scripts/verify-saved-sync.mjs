/**
 * Saved ↔ live-reprice sync: mid-flight favorites must pick up live prices.
 * Run: node scripts/verify-saved-sync.mjs
 */

function applyLiveResultsToSaved(saved, liveResults) {
  if (!saved.length || !liveResults.length) {
    return { next: saved, updatedIds: [] };
  }
  const byId = new Map(liveResults.map((r) => [r.id, r]));
  const updatedIds = [];
  const next = saved.map((s) => {
    const live = byId.get(s.id);
    if (!live) return s;
    updatedIds.push(s.id);
    const merged = { ...live, savedAt: s.savedAt };
    if (s.note != null) merged.note = s.note;
    if (live.insight == null && s.insight != null) merged.insight = s.insight;
    return merged;
  });
  return { next, updatedIds };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const bulk = {
  id: "tu-1",
  totalCost: 10,
  expectedProfit: 5,
  expectedValue: 15,
  roi: 50,
  winPct: 80,
  inputs: [{ name: "A", count: 10, price: 1, wear: "FT", float: 0.2 }],
  outcomes: [
    { name: "B", price: 20, profit: 10, wear: "FT", float: 0.2, prob: 100 },
  ],
};

const live = {
  ...bulk,
  totalCost: 18,
  expectedProfit: -2,
  expectedValue: 16,
  roi: -11,
  winPct: 40,
  inputs: [{ name: "A", count: 10, price: 1.8, wear: "FT", float: 0.2 }],
  outcomes: [
    { name: "B", price: 16, profit: -2, wear: "FT", float: 0.2, prob: 100 },
  ],
};

const saved = [
  {
    ...bulk,
    savedAt: "2026-08-29T00:00:00.000Z",
    note: "keep",
    insight: "ai",
  },
  {
    id: "tu-other",
    totalCost: 1,
    expectedProfit: 0,
    expectedValue: 1,
    roi: 0,
    winPct: 0,
    inputs: [],
    outcomes: [],
    savedAt: "2026-08-29T00:00:00.000Z",
  },
];

const { next, updatedIds } = applyLiveResultsToSaved(saved, [live]);

assert(updatedIds.length === 1 && updatedIds[0] === "tu-1", "updates matching id");
assert(next[0].totalCost === 18, "overlays live totalCost");
assert(next[0].expectedProfit === -2, "overlays live EV/profit");
assert(next[0].savedAt === "2026-08-29T00:00:00.000Z", "keeps savedAt");
assert(next[0].note === "keep", "keeps note");
assert(next[0].insight === "ai", "keeps insight when live omits it");
assert(
  next[1].id === "tu-other" && next[1].totalCost === 1,
  "leaves other favorites alone"
);

const noop = applyLiveResultsToSaved(saved, []);
assert(noop.next === saved && noop.updatedIds.length === 0, "empty live is no-op");

const none = applyLiveResultsToSaved([], [live]);
assert(none.next.length === 0 && none.updatedIds.length === 0, "empty saved is no-op");

console.log("verify-saved-sync: ok");
