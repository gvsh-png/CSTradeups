import { NextResponse } from "next/server";
import { authConfigured, appBaseUrl, stripeConfigured } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";
import { getStripe, stripePriceIdForPlan } from "@/lib/billing/stripe";
import type { PlanId } from "@/lib/billing/plans";
import { getUser, linkStripeCustomer } from "@/lib/usage/store";

export const dynamic = "force-dynamic";

function parsePlan(raw: unknown): Exclude<PlanId, "free"> {
  return raw === "starter" ? "starter" : "pro";
}

/** Create Stripe Checkout session for Starter ($3) or Pro ($8) monthly */
export async function POST(request: Request) {
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

  let body: { plan?: string } = {};
  try {
    body = (await request.json()) as { plan?: string };
  } catch {
    /* empty body ok — default pro */
  }
  const plan = parsePlan(body.plan);

  if (user.plan === plan) {
    return NextResponse.json(
      { error: `Already on ${plan === "starter" ? "Starter" : "Pro"}` },
      { status: 400 }
    );
  }
  if (user.plan === "pro" && plan === "starter") {
    return NextResponse.json(
      { error: "Already on Pro — manage billing to change plans." },
      { status: 400 }
    );
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
    line_items: [{ price: stripePriceIdForPlan(plan), quantity: 1 }],
    success_url: `${appBaseUrl()}/subscription?billing=success`,
    cancel_url: `${appBaseUrl()}/subscription?billing=cancel`,
    metadata: { steamId: user.steamId, plan },
    subscription_data: {
      metadata: { steamId: user.steamId, plan },
    },
  });

  return NextResponse.json({ url: checkout.url });
}
