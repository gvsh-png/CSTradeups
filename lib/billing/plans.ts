/** Plan limits — Free + two monthly tiers ($3 / $8). No annual. */

export type PlanId = "free" | "starter" | "pro";

export const FREE_WEEKLY_SCANS = 5;
export const FREE_MAX_SAVED = 1;

export const STARTER_WEEKLY_SCANS = 40;
export const STARTER_MAX_SAVED = 15;

export const PRO_WEEKLY_SCANS = null; // unlimited
export const PRO_MAX_SAVED = null; // unlimited

export const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
};

/** Display prices (USD / month) — Stripe price IDs wired later */
export const PLAN_PRICES: Record<
  Exclude<PlanId, "free">,
  { usd: number; label: string; blurb: string }
> = {
  starter: {
    usd: 3,
    label: "$3 / mo",
    blurb: "More scans and saved contracts for regular traders.",
  },
  pro: {
    usd: 8,
    label: "$8 / mo",
    blurb: "Unlimited scans and saved slots for heavy use.",
  },
};

export function weeklyScanLimit(plan: PlanId): number | null {
  if (plan === "pro") return PRO_WEEKLY_SCANS;
  if (plan === "starter") return STARTER_WEEKLY_SCANS;
  return FREE_WEEKLY_SCANS;
}

export function maxSavedLimit(plan: PlanId): number | null {
  if (plan === "pro") return PRO_MAX_SAVED;
  if (plan === "starter") return STARTER_MAX_SAVED;
  return FREE_MAX_SAVED;
}

/** ISO week key like 2026-W30 — resets weekly quotas */
export function currentWeekKey(date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
