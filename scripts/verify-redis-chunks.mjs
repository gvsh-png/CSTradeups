/**
 * Chunked Steam Redis book must be all-or-nothing.
 * Run: node scripts/verify-redis-chunks.mjs
 */

function assembleChunkedSteamBook(meta, chunkById) {
  if (!meta?.chunks?.length || !meta.fetchedAt) return null;
  if (!(meta.priceCount >= 50)) return null;

  const prices = {};
  for (const id of meta.chunks) {
    const part = chunkById[id];
    if (!part || typeof part !== "object") return null;
    if (part.fetchedAt !== meta.fetchedAt) return null;
    if (!part.prices || typeof part.prices !== "object") return null;
    Object.assign(prices, part.prices);
  }

  const count = Object.values(prices).filter((p) => p > 0).length;
  if (count < 50 || count !== meta.priceCount) return null;

  return {
    prices,
    fetchedAt: meta.fetchedAt,
    steamApisCount: meta.steamApisCount || count,
  };
}

function makePrices(prefix, n) {
  const prices = {};
  for (let i = 0; i < n; i++) prices[`${prefix}${i} (Field-Tested)`] = 1 + i * 0.01;
  return prices;
}

let failed = 0;
function assert(name, cond) {
  console.log(`${cond ? "OK" : "FAIL"} ${name}`);
  if (!cond) failed++;
}

const fetchedAt = "2026-07-23T00:00:00.000Z";
const a = makePrices("AK-47 | Redline ", 30);
const b = makePrices("Butterfly Knife | Doppler ", 30);
const meta = {
  fetchedAt,
  steamApisCount: 60,
  chunks: ["A", "B"],
  priceCount: 60,
};

assert(
  "complete matching chunks assemble",
  assembleChunkedSteamBook(meta, {
    A: { fetchedAt, prices: a },
    B: { fetchedAt, prices: b },
  })?.steamApisCount === 60
);

assert(
  "missing chunk rejected",
  assembleChunkedSteamBook(meta, {
    A: { fetchedAt, prices: a },
    B: null,
  }) === null
);

assert(
  "mixed generation rejected",
  assembleChunkedSteamBook(meta, {
    A: { fetchedAt, prices: a },
    B: { fetchedAt: "2026-07-22T00:00:00.000Z", prices: b },
  }) === null
);

assert(
  "legacy plain PriceMap chunk rejected",
  assembleChunkedSteamBook(meta, {
    A: a,
    B: b,
  }) === null
);

assert(
  "priceCount mismatch rejected (partial alphabet)",
  assembleChunkedSteamBook(
    { ...meta, priceCount: 60 },
    {
      A: { fetchedAt, prices: a },
      B: { fetchedAt, prices: makePrices("Bowie Knife | Fade ", 10) },
    }
  ) === null
);

assert(
  "under-50 book rejected",
  assembleChunkedSteamBook(
    { fetchedAt, steamApisCount: 40, chunks: ["A"], priceCount: 40 },
    { A: { fetchedAt, prices: makePrices("AWP | Asiimov ", 40) } }
  ) === null
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll redis chunk checks passed");
