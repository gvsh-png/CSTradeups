import Stripe from "stripe";
import { stripeConfigured } from "@/lib/auth/config";
import type { PlanId } from "./plans";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeConfigured()) {
    throw new Error("Stripe is not configured");
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

/** Paid plan price IDs — monthly only ($3 starter / $8 pro) */
export function stripePriceIdForPlan(
  plan: Exclude<PlanId, "free">
): string {
  if (plan === "starter") {
    const id =
      process.env.STRIPE_PRICE_ID_STARTER || process.env.STRIPE_PRICE_ID;
    if (!id) throw new Error("STRIPE_PRICE_ID_STARTER is not set");
    return id;
  }
  const id = process.env.STRIPE_PRICE_ID_PRO || process.env.STRIPE_PRICE_ID;
  if (!id) throw new Error("STRIPE_PRICE_ID_PRO is not set");
  return id;
}

/** Map a Stripe price id back to a plan (webhook) */
export function planFromStripePriceId(priceId: string | undefined): PlanId {
  if (!priceId) return "pro";
  const starter =
    process.env.STRIPE_PRICE_ID_STARTER || process.env.STRIPE_PRICE_ID;
  const pro = process.env.STRIPE_PRICE_ID_PRO || process.env.STRIPE_PRICE_ID;
  if (starter && priceId === starter && starter !== pro) return "starter";
  if (pro && priceId === pro) return "pro";
  return "pro";
}

/** @deprecated use stripePriceIdForPlan("pro") */
export function stripePriceId(): string {
  return stripePriceIdForPlan("pro");
}
