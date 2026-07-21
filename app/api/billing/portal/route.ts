import { NextResponse } from "next/server";
import { authConfigured, appBaseUrl, stripeConfigured } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";
import { getStripe } from "@/lib/billing/stripe";
import { getUser } from "@/lib/usage/store";

export const dynamic = "force-dynamic";

/** Stripe Customer Portal for managing/canceling Pro */
export async function POST() {
  if (!authConfigured() || !stripeConfigured()) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const user = await getUser(session.steamId);
  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account yet — upgrade first" },
      { status: 400 }
    );
  }

  const portal = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: appBaseUrl(),
  });

  return NextResponse.json({ url: portal.url });
}
