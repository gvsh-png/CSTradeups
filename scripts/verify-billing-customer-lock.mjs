/**
 * Verify first-time Checkout customer ensure serializes parallel creates.
 * Run: node scripts/verify-billing-customer-lock.mjs
 *
 * Mirrors lib/usage/store.ts ensureStripeCustomer against an in-memory Redis.
 */
import assert from "node:assert/strict";

function createMemoryRedis() {
  /** @type {Map<string, string>} */
  const kv = new Map();
  return {
    async get(key) {
      return kv.has(key) ? kv.get(key) : null;
    },
    async set(key, value, opts) {
      if (opts?.nx && kv.has(key)) return null;
      kv.set(key, value);
      return "OK";
    },
    async del(key) {
      kv.delete(key);
    },
    /** @param {string} steamId @param {string} customerId */
    async link(steamId, customerId) {
      kv.set(`stripe:customer:${customerId}`, steamId);
      const raw = kv.get(`user:${steamId}`);
      const user = raw ? JSON.parse(raw) : { steamId };
      user.stripeCustomerId = customerId;
      kv.set(`user:${steamId}`, JSON.stringify(user));
    },
    /** @param {string} steamId */
    async getUser(steamId) {
      const raw = kv.get(`user:${steamId}`);
      return raw ? JSON.parse(raw) : null;
    },
    seedUser(steamId) {
      kv.set(
        `user:${steamId}`,
        JSON.stringify({ steamId, plan: "free", name: "Test" })
      );
    },
  };
}

/**
 * @param {ReturnType<typeof createMemoryRedis>} r
 * @param {string} steamId
 * @param {() => Promise<{ id: string }>} createCustomer
 */
async function ensureStripeCustomer(r, steamId, createCustomer) {
  const existing = await r.getUser(steamId);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const lockKey = `lock:stripe-customer:${steamId}`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const locked = await r.set(lockKey, "1", { nx: true, px: 15_000 });
    if (locked) {
      try {
        const again = await r.getUser(steamId);
        if (again?.stripeCustomerId) return again.stripeCustomerId;
        const customer = await createCustomer();
        await r.link(steamId, customer.id);
        return customer.id;
      } finally {
        await r.del(lockKey);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5 * (attempt + 1)));
    const raced = await r.getUser(steamId);
    if (raced?.stripeCustomerId) return raced.stripeCustomerId;
  }
  throw new Error("Could not create billing customer — please retry.");
}

/** Buggy main path: local customer id kept after raced creates */
async function buggyParallelCreates() {
  const r = createMemoryRedis();
  r.seedUser("steamA");
  let n = 0;
  const create = async () => ({ id: `cus_${++n}` });

  const run = async () => {
    const user = await r.getUser("steamA");
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      // Artificial delay so both sides observe empty stripeCustomerId
      await new Promise((resolve) => setTimeout(resolve, 15));
      const customer = await create();
      customerId = customer.id;
      await r.link("steamA", customerId);
    }
    return customerId;
  };

  const [a, b] = await Promise.all([run(), run()]);
  assert.notEqual(a, b, "bug reproduces: two local customer ids");
  assert.equal(n, 2);
}

async function lockedParallelCreates() {
  const r = createMemoryRedis();
  r.seedUser("steamA");
  let n = 0;
  const create = async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { id: `cus_${++n}` };
  };

  const [a, b] = await Promise.all([
    ensureStripeCustomer(r, "steamA", create),
    ensureStripeCustomer(r, "steamA", create),
  ]);

  assert.equal(a, b, "lock ensures one canonical customer id");
  assert.equal(n, 1, "Stripe customers.create called once");
  const user = await r.getUser("steamA");
  assert.equal(user.stripeCustomerId, a);
}

/** #54-style per-customer sibling cancel cannot see the other customer */
function siblingCancelMissesCrossCustomer() {
  const cancelOnCustomer = (subs, keepId) =>
    subs.filter((s) => s.id !== keepId).map((s) => s.id);

  const cus1 = [{ id: "sub_1", status: "active" }];
  const cus2 = [{ id: "sub_2", status: "active" }];
  assert.deepEqual(cancelOnCustomer(cus1, "sub_1"), []);
  assert.deepEqual(cancelOnCustomer(cus2, "sub_2"), []);
}

await buggyParallelCreates();
await lockedParallelCreates();
siblingCancelMissesCrossCustomer();
console.log("verify-billing-customer-lock: ok");
