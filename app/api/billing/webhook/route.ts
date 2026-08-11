import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeConfigured } from "@/lib/auth/config";
import {
  checkoutPaymentSettled,
  shouldClearStoredSubscriptionId,
  subscriptionEntitlesPaidPlan,
} from "@/lib/billing/entitlements";
import { getStripe, planFromStripePriceId } from "@/lib/billing/stripe";
import type { PlanId } from "@/lib/billing/plans";
import {
  findByStripeCustomer,
  linkStripeCustomer,
  setPlan,
} from "@/lib/usage/store";

export const dynamic = "force-dynamic";

async function resolveSteamId(
  customerId: string | undefined,
  metadataSteamId?: string | null
): Promise<string | null> {
  if (customerId) {
    const user = await findByStripeCustomer(customerId);
    if (user?.steamId) return user.steamId;
  }
  return metadataSteamId || null;
}

function planFromSubscription(sub: Stripe.Subscription): PlanId {
  const metaPlan = sub.metadata?.plan;
  if (metaPlan === "starter" || metaPlan === "pro") return metaPlan;
  const priceId = sub.items.data[0]?.price?.id;
  return planFromStripePriceId(priceId);
}

async function grantCheckoutPlan(session: Stripe.Checkout.Session) {
  // Delayed methods (ACH/SEPA/etc.) fire checkout.session.completed with
  // payment_status=unpaid — do not unlock paid quotas until payment settles.
  if (!checkoutPaymentSettled(session.payment_status)) {
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  const steamId = await resolveSteamId(customerId, session.metadata?.steamId);
  const planMeta = session.metadata?.plan;
  let plan: PlanId =
    planMeta === "starter" || planMeta === "pro" ? planMeta : "pro";

  if (subscriptionId) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      // Incomplete first invoice must not grant Starter/Pro.
      if (!subscriptionEntitlesPaidPlan(sub.status)) {
        return;
      }
      plan = planFromSubscription(sub);
    } catch {
      /* payment already settled — keep metadata plan if retrieve fails */
    }
  }

  if (steamId && customerId) {
    await linkStripeCustomer(steamId, customerId);
    await setPlan(steamId, plan, {
      customerId,
      subscriptionId: subscriptionId ?? undefined,
    });
  }
}

export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = getStripe();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Stripe webhook signature failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        await grantCheckoutPlan(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        const steamId = await resolveSteamId(
          customerId,
          session.metadata?.steamId
        );
        if (steamId && customerId) {
          // Keep subscription id when present — sub may still be incomplete;
          // clearing it would force a stacked second Checkout later.
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;
          await setPlan(steamId, "free", {
            customerId,
            subscriptionId: subscriptionId ?? undefined,
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const steamId = await resolveSteamId(customerId, sub.metadata?.steamId);
        if (!steamId) break;

        const active =
          event.type === "customer.subscription.updated" &&
          subscriptionEntitlesPaidPlan(sub.status);

        const clearId = shouldClearStoredSubscriptionId(event.type, sub.status);

        await setPlan(steamId, active ? planFromSubscription(sub) : "free", {
          customerId,
          // Preserve id on past_due/unpaid so re-checkout can update in place
          // instead of opening a second live subscription.
          subscriptionId: clearId ? null : sub.id,
        });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
