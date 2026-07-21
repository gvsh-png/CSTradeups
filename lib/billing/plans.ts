/** Free vs Pro plan limits — tune here */

export type PlanId = "free" | "pro";

export const FREE_WEEKLY_SCANS = 5;
export const FREE_MAX_SAVED = 1;

export const PRO_WEEKLY_SCANS = null; // unlimited
export const PRO_MAX_SAVED = null; // unlimited

export const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  pro: "Pro",
};

export function weeklyScanLimit(plan: PlanId): number | null {
  return plan === "pro" ? PRO_WEEKLY_SCANS : FREE_WEEKLY_SCANS;
}

export function maxSavedLimit(plan: PlanId): number | null {
  return plan === "pro" ? PRO_MAX_SAVED : FREE_MAX_SAVED;
}

/** ISO week key like 2026-W30 — resets weekly quotas */
export function currentWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
