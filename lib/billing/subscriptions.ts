/**
 * When Checkout creates a new subscription for a customer who already has one,
 * return the prior subscription id that must be canceled to avoid double billing.
 */
export function previousSubscriptionToCancel(
  previousSubscriptionId: string | undefined | null,
  newSubscriptionId: string | undefined | null
): string | null {
  if (!previousSubscriptionId || !newSubscriptionId) return null;
  if (previousSubscriptionId === newSubscriptionId) return null;
  return previousSubscriptionId;
}

/** Stripe statuses that mean the customer is still on a live billable subscription */
export function isLiveSubscriptionStatus(status: string | undefined | null): boolean {
  return (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "unpaid"
  );
}
