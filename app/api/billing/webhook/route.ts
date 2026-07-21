import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeConfigured } from "@/lib/auth/config";
import { getStripe } from "@/lib/billing/stripe";
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
  if (metadataSteamId) return metadataSteamId;
  if (!customerId) return null;
  const user = await findByStripeCustomer(customerId);
  return user?.steamId ?? null;
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
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        const steamId = await resolveSteamId(
          customerId,
          session.metadata?.steamId
        );
        if (steamId && customerId) {
          await linkStripeCustomer(steamId, customerId);
          await setPlan(steamId, "pro", {
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
          (sub.status === "active" || sub.status === "trialing");

        await setPlan(steamId, active ? "pro" : "free", {
          customerId,
          subscriptionId: active ? sub.id : null,
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
