/**
 * Prefer live Stripe price over sticky checkout metadata.plan.
 * Run: node scripts/verify-plan-from-subscription.mjs
 */

function planFromStripePriceId(priceId, env) {
  if (!priceId) return "pro";
  const starter = env.STRIPE_PRICE_ID_STARTER || env.STRIPE_PRICE_ID;
  const pro = env.STRIPE_PRICE_ID_PRO || env.STRIPE_PRICE_ID;
  if (starter && priceId === starter && starter !== pro) return "starter";
  if (pro && priceId === pro) return "pro";
  return "pro";
}

function planFromSubscription(sub, env) {
  const priceId = sub.items?.data?.[0]?.price?.id;
  const starter = env.STRIPE_PRICE_ID_STARTER || env.STRIPE_PRICE_ID;
  const pro = env.STRIPE_PRICE_ID_PRO || env.STRIPE_PRICE_ID;
  if (priceId && starter && pro && starter !== pro) {
    if (priceId === starter) return "starter";
    if (priceId === pro) return "pro";
  }
  const metaPlan = sub.metadata?.plan;
  if (metaPlan === "starter" || metaPlan === "pro") return metaPlan;
  return planFromStripePriceId(priceId, env);
}

/** Old webhook logic — metadata wins even after portal price change */
function planFromSubscriptionLegacy(sub, env) {
  const metaPlan = sub.metadata?.plan;
  if (metaPlan === "starter" || metaPlan === "pro") return metaPlan;
  const priceId = sub.items?.data?.[0]?.price?.id;
  return planFromStripePriceId(priceId, env);
}

let failed = 0;
function assert(name, got, expected) {
  const ok = got === expected;
  console.log(`${ok ? "OK" : "FAIL"} ${name}: got ${got}, expected ${expected}`);
  if (!ok) failed++;
}

const distinct = {
  STRIPE_PRICE_ID_STARTER: "price_starter",
  STRIPE_PRICE_ID_PRO: "price_pro",
};

const portalUpgrade = {
  metadata: { plan: "starter" },
  items: { data: [{ price: { id: "price_pro" } }] },
};

assert(
  "legacy: portal upgrade stays starter (bug)",
  planFromSubscriptionLegacy(portalUpgrade, distinct),
  "starter"
);
assert(
  "fixed: portal upgrade follows price → pro",
  planFromSubscription(portalUpgrade, distinct),
  "pro"
);

assert(
  "starter checkout still starter",
  planFromSubscription(
    {
      metadata: { plan: "starter" },
      items: { data: [{ price: { id: "price_starter" } }] },
    },
    distinct
  ),
  "starter"
);

assert(
  "pro checkout still pro",
  planFromSubscription(
    {
      metadata: { plan: "pro" },
      items: { data: [{ price: { id: "price_pro" } }] },
    },
    distinct
  ),
  "pro"
);

const legacySingle = { STRIPE_PRICE_ID: "price_legacy" };
assert(
  "legacy single price: metadata starter preserved",
  planFromSubscription(
    {
      metadata: { plan: "starter" },
      items: { data: [{ price: { id: "price_legacy" } }] },
    },
    legacySingle
  ),
  "starter"
);

assert(
  "unknown price falls back to metadata",
  planFromSubscription(
    {
      metadata: { plan: "starter" },
      items: { data: [{ price: { id: "price_other" } }] },
    },
    distinct
  ),
  "starter"
);

/**
 * Lost-update illustration: scan save must not keep a stale plan when a
 * fresher billing write already landed. Mutators re-read under a lock.
 */
function applyScanAfterBilling(staleRead, freshBilling, weeklyScans) {
  // Correct path: merge usage onto the fresh billing record
  return { ...freshBilling, weeklyScans };
}

const staleFree = {
  steamId: "1",
  plan: "free",
  weeklyScans: 2,
  stripeSubscriptionId: undefined,
};
const billedPro = {
  steamId: "1",
  plan: "pro",
  weeklyScans: 2,
  stripeSubscriptionId: "sub_new",
};
const wrong = { ...staleFree, weeklyScans: 3 };
const right = applyScanAfterBilling(staleFree, billedPro, 3);

assert("stale full-SET would wipe plan", wrong.plan, "free");
assert("locked re-read keeps pro", right.plan, "pro");
assert("locked re-read keeps sub id", right.stripeSubscriptionId, "sub_new");
assert("locked re-read updates scans", right.weeklyScans, 3);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll plan-from-subscription checks passed");
