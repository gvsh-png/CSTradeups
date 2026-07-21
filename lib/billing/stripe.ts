import Stripe from "stripe";
import { stripeConfigured } from "@/lib/auth/config";

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

export function stripePriceId(): string {
  const id = process.env.STRIPE_PRICE_ID;
  if (!id) throw new Error("STRIPE_PRICE_ID is not set");
  return id;
}
