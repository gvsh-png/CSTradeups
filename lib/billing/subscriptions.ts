/**
 * Helpers to prevent stacked Stripe subscriptions from multiple Checkout sessions.
 */

/** Stripe statuses that mean the customer is still on a billable / in-flight subscription */
export function isLiveSubscriptionStatus(
  status: string | undefined | null
): boolean {
  return (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "unpaid" ||
    status === "incomplete"
  );
}

/**
 * Prefer reusing an open Checkout session for the same plan so double-clicks /
 * retries do not create a second billable subscription.
 */
export function findReusableCheckoutUrl(
  sessions: Array<{
    mode?: string | null;
    url?: string | null;
    metadata?: { plan?: string | null } | null;
  }>,
  plan: string
): string | null {
  for (const session of sessions) {
    if (session.mode !== "subscription") continue;
    if (session.metadata?.plan !== plan) continue;
    if (session.url) return session.url;
  }
  return null;
}

/**
 * After Checkout completes, any other live subscription on the same customer
 * must be canceled — otherwise two completed sessions leave two active bills.
 */
export function siblingSubscriptionsToCancel(
  subscriptions: Array<{ id: string; status?: string | null }>,
  keepSubscriptionId: string | undefined | null
): string[] {
  if (!keepSubscriptionId) return [];
  return subscriptions
    .filter(
      (sub) =>
        sub.id !== keepSubscriptionId && isLiveSubscriptionStatus(sub.status)
    )
    .map((sub) => sub.id);
}
