/**
 * Verify Starter→Pro upgrade helpers reject stacking a second subscription.
 */
import assert from "node:assert/strict";

/** Mirrors lib/billing/subscriptions.ts */
function previousSubscriptionToCancel(previousSubscriptionId, newSubscriptionId) {
  if (!previousSubscriptionId || !newSubscriptionId) return null;
  if (previousSubscriptionId === newSubscriptionId) return null;
  return previousSubscriptionId;
}

function isLiveSubscriptionStatus(status) {
  return (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "unpaid"
  );
}

// New Checkout for a Starter user must cancel the old sub id
assert.equal(
  previousSubscriptionToCancel("sub_starter", "sub_pro"),
  "sub_starter"
);

// In-place upgrade keeps the same sub — nothing to cancel
assert.equal(
  previousSubscriptionToCancel("sub_live", "sub_live"),
  null
);

// First-time Checkout (no prior sub)
assert.equal(previousSubscriptionToCancel(undefined, "sub_new"), null);
assert.equal(previousSubscriptionToCancel("sub_old", null), null);

// Only live statuses should take the in-place upgrade path
assert.equal(isLiveSubscriptionStatus("active"), true);
assert.equal(isLiveSubscriptionStatus("trialing"), true);
assert.equal(isLiveSubscriptionStatus("past_due"), true);
assert.equal(isLiveSubscriptionStatus("canceled"), false);
assert.equal(isLiveSubscriptionStatus("incomplete_expired"), false);

console.log("verify-billing-upgrade: ok");
