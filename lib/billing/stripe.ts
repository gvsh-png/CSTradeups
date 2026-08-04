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

/** Starter monthly price — never falls back to the Pro / legacy price id */
export function stripePriceIdStarter(): string | undefined {
  const id = process.env.STRIPE_PRICE_ID_STARTER?.trim();
  return id || undefined;
}

/**
 * Pro monthly price. `STRIPE_PRICE_ID` remains a legacy alias for Pro only
 * (never for Starter — that silently overcharged Starter at the Pro amount).
 */
export function stripePriceIdPro(): string | undefined {
  const id =
    process.env.STRIPE_PRICE_ID_PRO?.trim() ||
    process.env.STRIPE_PRICE_ID?.trim();
  return id || undefined;
}

/** Paid plan price IDs — monthly only ($3 starter / $8 pro) */
export function stripePriceIdForPlan(
  plan: Exclude<PlanId, "free">
): string {
  if (plan === "starter") {
    const id = stripePriceIdStarter();
    if (!id) throw new Error("STRIPE_PRICE_ID_STARTER is not set");
    return id;
  }
  const id = stripePriceIdPro();
  if (!id) throw new Error("STRIPE_PRICE_ID_PRO is not set");
  return id;
}

/** Map a Stripe price id back to a plan (webhook) */
export function planFromStripePriceId(priceId: string | undefined): PlanId {
  if (!priceId) return "pro";
  const starter = stripePriceIdStarter();
  const pro = stripePriceIdPro();
  if (starter && priceId === starter) return "starter";
  if (pro && priceId === pro) return "pro";
  return "pro";
}

/** @deprecated use stripePriceIdForPlan("pro") */
export function stripePriceId(): string {
  return stripePriceIdForPlan("pro");
}
