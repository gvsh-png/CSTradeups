import { NextResponse } from "next/server";
import { authConfigured, appBaseUrl, stripeConfigured } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";
import { getStripe, stripePriceId } from "@/lib/billing/stripe";
import { getUser, linkStripeCustomer } from "@/lib/usage/store";

export const dynamic = "force-dynamic";

/** Create Stripe Checkout session for Pro */
export async function POST() {
  if (!authConfigured()) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Add Stripe env vars." },
      { status: 503 }
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in with Steam first" }, { status: 401 });
  }

  const user = await getUser(session.steamId);
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (user.plan === "pro") {
    return NextResponse.json({ error: "Already on Pro" }, { status: 400 });
  }

  const stripe = getStripe();
  let customerId = user.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { steamId: user.steamId },
      name: user.name,
    });
    customerId = customer.id;
    await linkStripeCustomer(user.steamId, customerId);
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: stripePriceId(), quantity: 1 }],
    success_url: `${appBaseUrl()}/?billing=success`,
    cancel_url: `${appBaseUrl()}/?billing=cancel`,
    metadata: { steamId: user.steamId },
    subscription_data: {
      metadata: { steamId: user.steamId },
    },
  });

  return NextResponse.json({ url: checkout.url });
}
