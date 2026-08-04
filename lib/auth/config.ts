/**
 * Auth + billing feature flags.
 * When auth is not fully configured, the app stays open (dev-friendly).
 * Set AUTH_REQUIRED=true in production once Steam + Redis + secrets are ready.
 */

export function authConfigured(): boolean {
  return Boolean(
    process.env.STEAM_API_KEY &&
      process.env.AUTH_SECRET &&
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/** When true, generate/save require a Steam login */
export function authRequired(): boolean {
  if (process.env.AUTH_REQUIRED === "true") return true;
  if (process.env.AUTH_REQUIRED === "false") return false;
  // Default: enforce only when fully configured
  return authConfigured();
}

export function stripeConfigured(): boolean {
  const starter = process.env.STRIPE_PRICE_ID_STARTER?.trim();
  // Legacy STRIPE_PRICE_ID is Pro-only — never treat it as Starter
  const pro =
    process.env.STRIPE_PRICE_ID_PRO?.trim() ||
    process.env.STRIPE_PRICE_ID?.trim();
  // Both plans must resolve to distinct Stripe Price objects. A shared id
  // charged Starter customers the Pro amount (or granted Pro at Starter $).
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      starter &&
      pro &&
      starter !== pro
  );
}

export function appBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}
