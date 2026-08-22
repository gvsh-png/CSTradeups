import type Stripe from "stripe";

/**
 * Decide which subscription snapshot to apply for entitlement changes.
 *
 * Stripe can deliver `customer.subscription.updated` out of order or retry an
 * older "active" payload after a newer cancel/delete for the *same* sub id.
 * Trusting the event object alone resurrects Starter/Pro after cancel.
 *
 * Cross-sub stale deletes (old id after replace) are handled separately.
 */
export function resolveSubscriptionStatusForEntitlement(
  eventType: string,
  eventSub: Pick<Stripe.Subscription, "id" | "status">,
  liveSub: Pick<Stripe.Subscription, "id" | "status"> | null
): { status: Stripe.Subscription.Status; source: "live" | "event" | "deleted" } {
  if (eventType === "customer.subscription.deleted") {
    return { status: "canceled", source: "deleted" };
  }

  if (liveSub && liveSub.id === eventSub.id) {
    return { status: liveSub.status, source: "live" };
  }

  // Retrieve failed (sub gone) — do not apply a stale "active" event payload.
  if (eventType === "customer.subscription.updated" && !liveSub) {
    return { status: "canceled", source: "deleted" };
  }

  return { status: eventSub.status, source: "event" };
}

export function subscriptionStatusEntitlesPaid(
  status: Stripe.Subscription.Status | string
): boolean {
  return status === "active" || status === "trialing";
}
