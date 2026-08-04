/**
 * Starter and Pro must use distinct Stripe price ids.
 * A shared STRIPE_PRICE_ID fallback charged Starter at the Pro amount.
 * Run: node scripts/verify-stripe-prices.mjs
 */

function stripePriceIdStarter(env) {
  const id = env.STRIPE_PRICE_ID_STARTER?.trim();
  return id || undefined;
}

function stripePriceIdPro(env) {
  const id =
    env.STRIPE_PRICE_ID_PRO?.trim() || env.STRIPE_PRICE_ID?.trim();
  return id || undefined;
}

function stripePriceIdForPlan(plan, env) {
  if (plan === "starter") {
    const id = stripePriceIdStarter(env);
    if (!id) throw new Error("STRIPE_PRICE_ID_STARTER is not set");
    return id;
  }
  const id = stripePriceIdPro(env);
  if (!id) throw new Error("STRIPE_PRICE_ID_PRO is not set");
  return id;
}

function planFromStripePriceId(priceId, env) {
  if (!priceId) return "pro";
  const starter = stripePriceIdStarter(env);
  const pro = stripePriceIdPro(env);
  if (starter && priceId === starter) return "starter";
  if (pro && priceId === pro) return "pro";
  return "pro";
}

function stripeConfigured(env) {
  const starter = env.STRIPE_PRICE_ID_STARTER?.trim();
  const pro =
    env.STRIPE_PRICE_ID_PRO?.trim() || env.STRIPE_PRICE_ID?.trim();
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      starter &&
      pro &&
      starter !== pro
  );
}

let failed = 0;
function assert(name, ok, detail = "") {
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

const secrets = {
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
};

// Documented single-price setup must NOT enable billing (would overcharge)
assert(
  "README-style single STRIPE_PRICE_ID → not configured",
  stripeConfigured({
    ...secrets,
    STRIPE_PRICE_ID: "price_pro_8",
  }) === false
);

assert(
  "identical starter+pro ids → not configured",
  stripeConfigured({
    ...secrets,
    STRIPE_PRICE_ID_STARTER: "price_same",
    STRIPE_PRICE_ID_PRO: "price_same",
  }) === false
);

assert(
  "distinct starter+pro → configured",
  stripeConfigured({
    ...secrets,
    STRIPE_PRICE_ID_STARTER: "price_starter_3",
    STRIPE_PRICE_ID_PRO: "price_pro_8",
  }) === true
);

assert(
  "legacy STRIPE_PRICE_ID as Pro alias with starter → configured",
  stripeConfigured({
    ...secrets,
    STRIPE_PRICE_ID_STARTER: "price_starter_3",
    STRIPE_PRICE_ID: "price_pro_8",
  }) === true
);

const dual = {
  STRIPE_PRICE_ID_STARTER: "price_starter_3",
  STRIPE_PRICE_ID_PRO: "price_pro_8",
};

assert(
  "starter checkout uses starter price id",
  stripePriceIdForPlan("starter", dual) === "price_starter_3"
);
assert(
  "pro checkout uses pro price id",
  stripePriceIdForPlan("pro", dual) === "price_pro_8"
);

const legacyPro = {
  STRIPE_PRICE_ID_STARTER: "price_starter_3",
  STRIPE_PRICE_ID: "price_pro_legacy",
};
assert(
  "legacy STRIPE_PRICE_ID aliases Pro only",
  stripePriceIdForPlan("pro", legacyPro) === "price_pro_legacy"
);

let starterFellBack = false;
try {
  stripePriceIdForPlan("starter", { STRIPE_PRICE_ID: "price_pro_8" });
  starterFellBack = true;
} catch {
  starterFellBack = false;
}
assert(
  "starter never falls back to STRIPE_PRICE_ID",
  starterFellBack === false
);

assert(
  "webhook maps starter price → starter",
  planFromStripePriceId("price_starter_3", dual) === "starter"
);
assert(
  "webhook maps pro price → pro",
  planFromStripePriceId("price_pro_8", dual) === "pro"
);
assert(
  "legacy Pro alias does not map as starter",
  planFromStripePriceId("price_pro_legacy", legacyPro) === "pro"
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll stripe price checks passed");
