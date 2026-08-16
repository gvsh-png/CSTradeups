/**
 * Verify first-time Checkout dedupe helpers prevent stacked subscriptions.
 * Run: node scripts/verify-billing-checkout-dedupe.mjs
 */
import assert from "node:assert/strict";

/** Mirrors lib/billing/subscriptions.ts */
function isLiveSubscriptionStatus(status) {
  return (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "unpaid" ||
    status === "incomplete"
  );
}

function findReusableCheckoutUrl(sessions, plan) {
  for (const session of sessions) {
    if (session.mode !== "subscription") continue;
    if (session.metadata?.plan !== plan) continue;
    if (session.url) return session.url;
  }
  return null;
}

function siblingSubscriptionsToCancel(subscriptions, keepSubscriptionId) {
  if (!keepSubscriptionId) return [];
  return subscriptions
    .filter(
      (sub) =>
        sub.id !== keepSubscriptionId && isLiveSubscriptionStatus(sub.status)
    )
    .map((sub) => sub.id);
}

// Reuse open Checkout for the same plan (double-click / retry)
assert.equal(
  findReusableCheckoutUrl(
    [
      {
        mode: "subscription",
        metadata: { plan: "pro" },
        url: "https://checkout.stripe.com/c/pay/cs_test_reuse",
      },
    ],
    "pro"
  ),
  "https://checkout.stripe.com/c/pay/cs_test_reuse"
);

// Different plan must not reuse
assert.equal(
  findReusableCheckoutUrl(
    [
      {
        mode: "subscription",
        metadata: { plan: "starter" },
        url: "https://checkout.stripe.com/c/pay/cs_test_starter",
      },
    ],
    "pro"
  ),
  null
);

// Payment-mode sessions are ignored
assert.equal(
  findReusableCheckoutUrl(
    [
      {
        mode: "payment",
        metadata: { plan: "pro" },
        url: "https://checkout.stripe.com/c/pay/cs_test_oneoff",
      },
    ],
    "pro"
  ),
  null
);

// Two completed Checkouts → cancel the sibling, keep the new one
assert.deepEqual(
  siblingSubscriptionsToCancel(
    [
      { id: "sub_first", status: "active" },
      { id: "sub_second", status: "active" },
    ],
    "sub_second"
  ),
  ["sub_first"]
);

// Incomplete sibling from a raced Checkout must also be canceled
assert.deepEqual(
  siblingSubscriptionsToCancel(
    [
      { id: "sub_keep", status: "active" },
      { id: "sub_race", status: "incomplete" },
      { id: "sub_old", status: "canceled" },
    ],
    "sub_keep"
  ),
  ["sub_race"]
);

// No keep id → do not cancel anything
assert.deepEqual(
  siblingSubscriptionsToCancel([{ id: "sub_a", status: "active" }], null),
  []
);

console.log("verify-billing-checkout-dedupe: ok");
