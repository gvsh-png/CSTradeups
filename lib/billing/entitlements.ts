/**
 * Pure helpers for Stripe → plan entitlement decisions.
 * Kept separate from the webhook route so verify scripts can lock behavior.
 */

/** Checkout may complete before delayed methods settle (ACH/SEPA/etc). */
export function checkoutPaymentSettled(
  paymentStatus: string | null | undefined
): boolean {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}

/** Only these statuses unlock Starter/Pro quotas. */
export function subscriptionEntitlesPaidPlan(
  status: string | null | undefined
): boolean {
  return status === "active" || status === "trialing";
}

/**
 * When a subscription no longer entitles a paid plan, decide whether to drop
 * the stored Stripe subscription id.
 *
 * Clearing on past_due/unpaid forces a second Checkout while the old sub still
 * exists in Stripe → double billing once the card recovers (see checkout path).
 */
export function shouldClearStoredSubscriptionId(
  eventType: "customer.subscription.updated" | "customer.subscription.deleted",
  status: string | null | undefined
): boolean {
  if (eventType === "customer.subscription.deleted") return true;
  return status === "canceled" || status === "incomplete_expired";
}
