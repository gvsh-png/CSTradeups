/**
 * Out-of-order Stripe subscription.updated must not resurrect paid access.
 * Mirrors lib/billing/subscriptionLiveStatus.ts
 * Run: node scripts/verify-subscription-live-status.mjs
 */

function resolveSubscriptionStatusForEntitlement(
  eventType,
  eventSub,
  liveSub
) {
  if (eventType === "customer.subscription.deleted") {
    return { status: "canceled", source: "deleted" };
  }

  if (liveSub && liveSub.id === eventSub.id) {
    return { status: liveSub.status, source: "live" };
  }

  if (eventType === "customer.subscription.updated" && !liveSub) {
    return { status: "canceled", source: "deleted" };
  }

  return { status: eventSub.status, source: "event" };
}

function subscriptionStatusEntitlesPaid(status) {
  return status === "active" || status === "trialing";
}

function planFromActive(status) {
  return subscriptionStatusEntitlesPaid(status) ? "pro" : "free";
}

let failed = 0;
function assert(name, ok, detail = "") {
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

// Delayed active payload after cancel (same sub id) → trust live canceled
{
  const { status, source } = resolveSubscriptionStatusForEntitlement(
    "customer.subscription.updated",
    { id: "sub_1", status: "active" },
    { id: "sub_1", status: "canceled" }
  );
  assert("stale active uses live source", source === "live", source);
  assert("stale active stays free", planFromActive(status) === "free", status);
}

// Live still active → keep paid
{
  const { status, source } = resolveSubscriptionStatusForEntitlement(
    "customer.subscription.updated",
    { id: "sub_1", status: "active" },
    { id: "sub_1", status: "active" }
  );
  assert("fresh active uses live", source === "live");
  assert("fresh active stays paid", planFromActive(status) === "pro", status);
}

// Deleted event → always free
{
  const { status, source } = resolveSubscriptionStatusForEntitlement(
    "customer.subscription.deleted",
    { id: "sub_1", status: "canceled" },
    null
  );
  assert("deleted source", source === "deleted");
  assert("deleted is free", planFromActive(status) === "free");
}

// Retrieve miss (sub gone) + stale active payload → free
{
  const { status, source } = resolveSubscriptionStatusForEntitlement(
    "customer.subscription.updated",
    { id: "sub_1", status: "active" },
    null
  );
  assert("missing live treated as deleted", source === "deleted");
  assert("missing live stays free", planFromActive(status) === "free");
}

assert("trialing entitles", subscriptionStatusEntitlesPaid("trialing"));
assert("past_due does not", !subscriptionStatusEntitlesPaid("past_due"));
assert("unpaid does not", !subscriptionStatusEntitlesPaid("unpaid"));

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll subscription live-status checks passed");
