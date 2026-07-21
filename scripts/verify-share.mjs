/**
 * Share encode/decode sanity checks.
 * Run: node scripts/verify-share.mjs
 */

function toBase64Url(json) {
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(encoded) {
  const cleaned = encoded.trim().replace(/\s+/g, "");
  const padded = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64").toString("utf8");
}

const tradeUp = {
  id: "t1",
  type: "single",
  inputRarity: "Mil-Spec Grade",
  outputRarity: "Restricted",
  complexity: "simple",
  fee: 0.02,
  description: "10x SSG 08 | Zeno (Minimal Wear)",
  generatedAt: "2026-07-21T00:00:00.000Z",
  totalCost: 10,
  expectedValue: 12,
  expectedProfit: 2,
  roi: 20,
  winPct: 100,
  insight: "Solid contract.",
  inputs: [
    {
      name: "SSG 08 | Zeno",
      count: 10,
      price: 1.02,
      wear: "Minimal Wear",
      float: 0.11,
      image: "https://community.akamai.steamstatic.com/economy/image/" + "x".repeat(200),
    },
  ],
  outcomes: [
    {
      name: "MP9 | Arctic Tri-Tone",
      float: 0.12,
      wear: "Minimal Wear",
      price: 5.99,
      prob: 33.33,
      profit: 1.5,
      image: "https://community.akamai.steamstatic.com/economy/image/" + "y".repeat(200),
    },
  ],
};

// v2 compact without images
const compact = {
  v: 2,
  id: tradeUp.id,
  t: "s",
  inR: tradeUp.inputRarity,
  outR: tradeUp.outputRarity,
  c: "s",
  fee: tradeUp.fee,
  desc: tradeUp.description,
  at: tradeUp.generatedAt,
  tc: tradeUp.totalCost,
  ev: tradeUp.expectedValue,
  ep: tradeUp.expectedProfit,
  roi: tradeUp.roi,
  win: tradeUp.winPct,
  ins: tradeUp.insight,
  inputs: tradeUp.inputs.map(({ name: n, count: c, price: p, wear: w, float: f }) => ({
    n, c, p, w, f,
  })),
  outs: tradeUp.outcomes.map(({ name: n, float: f, wear: w, price: p, prob: pr, profit: pl }) => ({
    n, f, w, p, pr, pl,
  })),
};

const encoded = toBase64Url(JSON.stringify(compact));
const withImagesLen = toBase64Url(JSON.stringify(tradeUp)).length;
const roundtrip = JSON.parse(fromBase64Url(encoded));
const url = `https://example.com/share?d=${encodeURIComponent(encoded)}`;

let failed = 0;
function assert(name, ok) {
  console.log(`${ok ? "OK" : "FAIL"} ${name}`);
  if (!ok) failed++;
}

assert("roundtrip id", roundtrip.id === "t1");
assert("no images in payload", !("img" in (roundtrip.inputs[0] || {})));
assert("v2 shorter than raw with images", encoded.length < withImagesLen);
assert("url under 2k", url.length < 2000);
assert("handles whitespace in decode", JSON.parse(fromBase64Url(encoded.match(/.{1,40}/g).join("\n"))).id === "t1");

console.log("encoded length", encoded.length, "url length", url.length);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll share checks passed");
