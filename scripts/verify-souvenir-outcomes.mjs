/**
 * Souvenir mode must price Souvenir outcomes (not normals) and reject mixes.
 * Wrong normal outcomes can flip −EV contracts to fake +EV (Dust II 2021).
 * Run: node scripts/verify-souvenir-outcomes.mjs
 */

function outcomePool(skins, souvenirMode) {
  return skins.filter((s) =>
    souvenirMode
      ? Boolean(s.isSouvenir || s.name.startsWith("Souvenir "))
      : !s.isSouvenir && !s.name.startsWith("Souvenir ")
  );
}

function allSouvenirInputs(inputs) {
  return (
    inputs.length > 0 &&
    inputs.every((i) => i.name.startsWith("Souvenir "))
  );
}

function r2(n) {
  return Math.round(n * 100) / 100;
}

function ev(outcomes, fee) {
  return outcomes.reduce((s, o) => s + o.prob * o.price * (1 - fee), 0);
}

let failed = 0;
function assert(name, ok, detail = "") {
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

// Dust II 2021 Restricted → Classified (Skinport-shaped snapshot)
const fee = 0.02;
const cost = 201.5; // 10× Souvenir USP-S | Orange Anolis FT
const pool = [
  { name: "UMP-45 | Fade", isSouvenir: false, price: 208.24 },
  { name: "SSG 08 | Death Strike", isSouvenir: false, price: 235.88 },
  { name: "Souvenir UMP-45 | Fade", isSouvenir: true, price: 166.15 },
  {
    name: "Souvenir SSG 08 | Death Strike",
    isSouvenir: true,
    price: 164.56,
  },
];

const buggyOuts = outcomePool(pool, false); // old souvenir-mode behavior
const fixedOuts = outcomePool(pool, true);

assert("buggy pool is normals only", buggyOuts.every((s) => !s.isSouvenir));
assert("fixed pool is souvenirs only", fixedOuts.every((s) => s.isSouvenir));
assert("fixed pool size 2", fixedOuts.length === 2);

const buggyEv = ev(
  buggyOuts.map((o) => ({ price: o.price, prob: 1 / buggyOuts.length })),
  fee
);
const fixedEv = ev(
  fixedOuts.map((o) => ({ price: o.price, prob: 1 / fixedOuts.length })),
  fee
);
const buggyProfit = r2(buggyEv - cost);
const fixedProfit = r2(fixedEv - cost);

assert(
  "buggy path looks profitable",
  buggyProfit > 0,
  `profit=${buggyProfit}`
);
assert(
  "fixed path is a loss (sign flip)",
  fixedProfit < 0,
  `profit=${fixedProfit}`
);
assert(
  "sign flip magnitude > $20",
  buggyProfit - fixedProfit > 20,
  `delta=${r2(buggyProfit - fixedProfit)}`
);

// Mix rejection
assert(
  "rejects 1 souvenir + 9 normals",
  !allSouvenirInputs([
    { name: "Souvenir USP-S | Orange Anolis" },
    { name: "M4A4 | Red DDPAT" },
  ])
);
assert(
  "keeps all-souvenir inputs",
  allSouvenirInputs([
    { name: "Souvenir USP-S | Orange Anolis" },
    { name: "Souvenir M4A4 | Red DDPAT" },
  ])
);

// Standard mode still strips souvenirs
const std = outcomePool(pool, false);
assert(
  "standard outcomes exclude souvenirs",
  std.length === 2 && std.every((s) => !s.isSouvenir)
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll souvenir-outcome checks passed");
