/**
 * Stripe can deliver subscription.updated / .deleted out of order after a
 * customer replaces subscription A with B. Applying A's deleted event after
 * B is linked would wipe a paid plan back to free.
 */
export function isStaleSubscriptionEvent(
  currentSubscriptionId: string | undefined | null,
  eventSubscriptionId: string
): boolean {
  if (!eventSubscriptionId) return true;
  if (!currentSubscriptionId) return false;
  return currentSubscriptionId !== eventSubscriptionId;
}
