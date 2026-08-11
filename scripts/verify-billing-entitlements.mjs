/**
 * Verify Stripe webhook entitlement helpers.
 * Run: node scripts/verify-billing-entitlements.mjs
 */
import assert from "node:assert/strict";

/** Mirrors lib/billing/entitlements.ts */
function checkoutPaymentSettled(paymentStatus) {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}

function subscriptionEntitlesPaidPlan(status) {
  return status === "active" || status === "trialing";
}

function shouldClearStoredSubscriptionId(eventType, status) {
  if (eventType === "customer.subscription.deleted") return true;
  return status === "canceled" || status === "incomplete_expired";
}

// Delayed Checkout must not grant until payment settles
assert.equal(checkoutPaymentSettled("unpaid"), false);
assert.equal(checkoutPaymentSettled("paid"), true);
assert.equal(checkoutPaymentSettled("no_payment_required"), true);
assert.equal(checkoutPaymentSettled(undefined), false);

// Incomplete / past_due subs must not unlock paid quotas
assert.equal(subscriptionEntitlesPaidPlan("incomplete"), false);
assert.equal(subscriptionEntitlesPaidPlan("past_due"), false);
assert.equal(subscriptionEntitlesPaidPlan("unpaid"), false);
assert.equal(subscriptionEntitlesPaidPlan("active"), true);
assert.equal(subscriptionEntitlesPaidPlan("trialing"), true);

// past_due/unpaid must KEEP the stored sub id (re-checkout / in-place upgrade)
assert.equal(
  shouldClearStoredSubscriptionId("customer.subscription.updated", "past_due"),
  false
);
assert.equal(
  shouldClearStoredSubscriptionId("customer.subscription.updated", "unpaid"),
  false
);
assert.equal(
  shouldClearStoredSubscriptionId("customer.subscription.updated", "incomplete"),
  false
);
assert.equal(
  shouldClearStoredSubscriptionId("customer.subscription.updated", "canceled"),
  true
);
assert.equal(
  shouldClearStoredSubscriptionId(
    "customer.subscription.updated",
    "incomplete_expired"
  ),
  true
);
assert.equal(
  shouldClearStoredSubscriptionId("customer.subscription.deleted", "canceled"),
  true
);

console.log("verify-billing-entitlements: ok");
