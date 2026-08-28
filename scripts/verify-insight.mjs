/**
 * Insight guard sanity checks (size / compact / rate limit).
 * Run: node --experimental-strip-types scripts/verify-insight.mjs
 */

import assert from "node:assert/strict";
import {
  MAX_INSIGHT_PROMPT_CHARS,
  allowInsightRequest,
  compactInsightTradeUp,
  resetInsightRateLimitForTests,
  INSIGHT_RATE_LIMIT,
} from "../lib/insightGuard.ts";

const sample = {
  id: "t1",
  description: "10x SSG 08 | Zeno (Minimal Wear)",
  inputRarity: "Mil-Spec Grade",
  outputRarity: "Restricted",
  totalCost: 10,
  expectedValue: 12,
  expectedProfit: 2,
  roi: 20,
  winPct: 100,
  fee: 0.02,
  junk: "x".repeat(100_000),
  inputs: [
    { name: "SSG 08 | Zeno", wear: "Minimal Wear", count: 10, price: 1.02 },
  ],
  outcomes: [
    {
      name: "UMP-45 | Plastic Sheen",
      wear: "Factory New",
      price: 1.5,
      prob: 0.5,
      profit: -8.5,
    },
    {
      name: "MP9 | Mount Fuji",
      wear: "Factory New",
      price: 22,
      prob: 0.5,
      profit: 11.5,
    },
  ],
};

const ok = compactInsightTradeUp(sample);
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.ok(ok.payload.length < MAX_INSIGHT_PROMPT_CHARS);
  assert.ok(!ok.payload.includes("junk"));
  assert.ok(!ok.payload.includes("x".repeat(50)));
  assert.ok(ok.payload.includes("SSG 08 | Zeno"));
}

assert.equal(compactInsightTradeUp(null).ok, false);
assert.equal(compactInsightTradeUp({}).ok, false);
assert.equal(
  compactInsightTradeUp({ inputs: [], outcomes: sample.outcomes }).ok,
  false
);
assert.equal(
  compactInsightTradeUp({
    inputs: sample.inputs,
    outcomes: Array.from({ length: 65 }, (_, i) => ({
      name: `Skin ${i}`,
      wear: "Factory New",
      price: 1,
      prob: 0.01,
    })),
  }).ok,
  false
);

resetInsightRateLimitForTests();
for (let i = 0; i < INSIGHT_RATE_LIMIT; i++) {
  assert.equal(allowInsightRequest("test-ip"), true);
}
assert.equal(allowInsightRequest("test-ip"), false);
assert.equal(allowInsightRequest("other-ip"), true);

console.log("verify-insight: ok");
