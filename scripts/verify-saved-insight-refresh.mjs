/**
 * Saved favorites: insight must not clobber a concurrent price refresh.
 * Run: node scripts/verify-saved-insight-refresh.mjs
 *
 * Mirrors SavedProvider.patchSaved + insight-only update vs the old
 * SavedTradeUps pattern of onUpdate({ ...staleItem, insight }).
 */

let failed = 0;
function assert(name, ok, detail = "") {
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

function patchSaved(prev, fn) {
  return fn(prev);
}

function updateSaved(prev, item) {
  return patchSaved(prev, (p) => p.map((s) => (s.id === item.id ? item : s)));
}

function updateInsight(prev, id, insight) {
  return patchSaved(prev, (p) =>
    p.map((s) => {
      if (s.id !== id) return s;
      if (insight === undefined) {
        const { insight: _removed, ...rest } = s;
        return rest;
      }
      return { ...s, insight };
    })
  );
}

/** Old buggy path: spread a closed-over item (pre-refresh) when insight lands */
function buggyInsightUpdate(prev, staleItem, insight) {
  return updateSaved(prev, { ...staleItem, insight });
}

const bulk = {
  id: "t1",
  totalCost: 50,
  expectedProfit: 12,
  winPct: 80,
  savedAt: "2026-08-01T00:00:00.000Z",
};

const live = {
  ...bulk,
  totalCost: 90,
  expectedProfit: -8,
  winPct: 40,
  generatedAt: "2026-08-31T00:00:00.000Z",
};

// Start with bulk-priced favorite
let saved = [bulk];

// User clicks Get AI analysis (closes over bulk), then Refresh completes
saved = updateSaved(saved, live);
assert("refresh applied live cost", saved[0].totalCost === 90);
assert("refresh applied live EV", saved[0].expectedProfit === -8);

// Buggy insight path restores bulk prices
const clobbered = buggyInsightUpdate(saved, bulk, "Looks solid.");
assert(
  "BUG: stale insight spread restores bulk cost",
  clobbered[0].totalCost === 50
);
assert(
  "BUG: stale insight spread restores bulk EV",
  clobbered[0].expectedProfit === 12
);

// Fixed insight-only path keeps live prices
saved = updateInsight(saved, "t1", "Looks solid.");
assert("fixed insight keeps live cost", saved[0].totalCost === 90);
assert("fixed insight keeps live EV", saved[0].expectedProfit === -8);
assert("fixed insight attaches text", saved[0].insight === "Looks solid.");

// Concurrent refresh of two favorites must not drop the first write
let two = [
  { id: "a", totalCost: 1, expectedProfit: 1 },
  { id: "b", totalCost: 2, expectedProfit: 2 },
];
const aLive = { id: "a", totalCost: 10, expectedProfit: -1 };
const bLive = { id: "b", totalCost: 20, expectedProfit: -2 };
// Both updates read the latest array (functional patch), not a stale closure
two = updateSaved(two, aLive);
two = updateSaved(two, bLive);
assert(
  "concurrent refresh keeps both live quotes",
  two.find((s) => s.id === "a").totalCost === 10 &&
    two.find((s) => s.id === "b").totalCost === 20
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll saved insight/refresh checks passed");
