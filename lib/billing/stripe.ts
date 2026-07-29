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

/**
 * Resolve plan from a Stripe subscription.
 * Prefer the live item price when Starter/Pro price IDs are distinct —
 * checkout `metadata.plan` is sticky and goes stale after portal upgrades.
 * Fall back to metadata only for legacy single-price configs.
 */
export function planFromSubscription(sub: {
  metadata?: { plan?: string | null } | null;
  items?: { data?: Array<{ price?: { id?: string } | null } | null> } | null;
}): PlanId {
  const priceId = sub.items?.data?.[0]?.price?.id;
  const starter =
    process.env.STRIPE_PRICE_ID_STARTER || process.env.STRIPE_PRICE_ID;
  const pro = process.env.STRIPE_PRICE_ID_PRO || process.env.STRIPE_PRICE_ID;
  if (priceId && starter && pro && starter !== pro) {
    if (priceId === starter) return "starter";
    if (priceId === pro) return "pro";
  }
  const metaPlan = sub.metadata?.plan;
  if (metaPlan === "starter" || metaPlan === "pro") return metaPlan;
  return planFromStripePriceId(priceId);
}

/** @deprecated use stripePriceIdForPlan("pro") */
export function stripePriceId(): string {
  return stripePriceIdForPlan("pro");
}
