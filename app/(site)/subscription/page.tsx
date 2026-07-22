"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FREE_MAX_SAVED,
  FREE_WEEKLY_SCANS,
  PLAN_PRICES,
  STARTER_MAX_SAVED,
  STARTER_WEEKLY_SCANS,
} from "@/lib/billing/plans";
import { useAuth } from "@/components/AuthProvider";

export default function SubscriptionPage() {
  const {
    loading,
    authConfigured,
    user,
    quota,
    stripeConfigured,
    startCheckout,
    openPortal,
  } = useAuth();
  const [busy, setBusy] = useState<"starter" | "pro" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkout = async (plan: "starter" | "pro") => {
    setError(null);
    if (!authConfigured) {
      setError("Auth is not configured on this deploy yet.");
      return;
    }
    if (!user) {
      window.location.href = "/api/auth/steam";
      return;
    }
    if (!stripeConfigured) {
      setError("Billing is not configured yet.");
      return;
    }
    setBusy(plan);
    try {
      await startCheckout(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusy(null);
    }
  };

  const portal = async () => {
    setError(null);
    setBusy("portal");
    try {
      await openPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed");
      setBusy(null);
    }
  };

  const current = user?.plan ?? "free";

  return (
    <div className="mx-auto max-w-container px-4 sm:px-6 py-5 lg:py-8 space-y-6">
      <div>
        <p className="label text-accent/80 mb-1">Billing</p>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Subscription
        </h1>
        <p className="text-[12px] text-[var(--text-muted)] mt-1 max-w-lg">
          Two monthly plans — Starter $3 and Pro $8. No annual billing.
        </p>
      </div>

      {/* Current plan */}
      <section className="panel panel-desktop p-5 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label mb-1">Current plan</p>
            <p className="text-lg font-semibold">
              {loading ? "…" : user ? user.planLabel : "Guest / Free"}
            </p>
            {quota && (
              <p className="mt-1 text-[12px] text-[var(--text-muted)] font-mono">
                {quota.weeklyScanLimit == null
                  ? `${quota.weeklyScans} scans this week · unlimited`
                  : `${quota.weeklyScans}/${quota.weeklyScanLimit} scans this week`}
                {" · "}
                {quota.maxSaved == null
                  ? `${quota.savedCount} saved`
                  : `${quota.savedCount}/${quota.maxSaved} saved`}
              </p>
            )}
          </div>
          {user && (current === "starter" || current === "pro") && stripeConfigured && (
            <button
              type="button"
              disabled={busy === "portal"}
              onClick={() => void portal()}
              className="btn-ghost"
            >
              {busy === "portal" ? "Opening…" : "Manage billing"}
            </button>
          )}
        </div>
      </section>

      {error && (
        <p className="text-[12px] text-[var(--loss)]">{error}</p>
      )}

      {/* Plans */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PlanCard
          name="Free"
          price="$0"
          period="/ forever"
          features={[
            `${FREE_WEEKLY_SCANS} scans / week`,
            `${FREE_MAX_SAVED} saved contract`,
            "Steam login when auth is live",
          ]}
          active={current === "free"}
          cta={null}
        />
        <PlanCard
          name="Starter"
          price={`$${PLAN_PRICES.starter.usd}`}
          period="/ mo"
          blurb={PLAN_PRICES.starter.blurb}
          features={[
            `${STARTER_WEEKLY_SCANS} scans / week`,
            `${STARTER_MAX_SAVED} saved contracts`,
            "Same scanner tools as Pro",
          ]}
          highlight
          active={current === "starter"}
          cta={
            current === "starter" || current === "pro"
              ? null
              : {
                  label: busy === "starter" ? "Redirecting…" : "Select Starter",
                  onClick: () => void checkout("starter"),
                  disabled: !!busy,
                }
          }
        />
        <PlanCard
          name="Pro"
          price={`$${PLAN_PRICES.pro.usd}`}
          period="/ mo"
          blurb={PLAN_PRICES.pro.blurb}
          features={[
            "Unlimited weekly scans",
            "Unlimited saved contracts",
            "Best for heavy daily use",
          ]}
          highlight
          active={current === "pro"}
          cta={
            current === "pro"
              ? null
              : {
                  label: busy === "pro" ? "Redirecting…" : "Select Pro",
                  onClick: () => void checkout("pro"),
                  disabled: !!busy,
                  primary: true,
                }
          }
        />
      </section>

      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed max-w-2xl">
        Subscriptions are monthly only. Cancel anytime via the Stripe billing
        portal. Steam login and live checkout activate once env vars are set on
        the deploy.
      </p>

      <Link href="/profile" className="text-[12px] text-accent hover:underline">
        ← Back to profile
      </Link>
    </div>
  );
}

function PlanCard({
  name,
  price,
  period,
  blurb,
  features,
  highlight,
  active,
  cta,
}: {
  name: string;
  price: string;
  period: string;
  blurb?: string;
  features: string[];
  highlight?: boolean;
  active?: boolean;
  cta: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    primary?: boolean;
  } | null;
}) {
  return (
    <div
      className={`panel p-5 flex flex-col relative overflow-hidden ${
        highlight ? "border-accent/35" : ""
      } ${active ? "ring-1 ring-accent/50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          className={`text-base font-semibold ${highlight ? "text-accent" : ""}`}
        >
          {name}
        </h2>
        {active && (
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-muted)]">
            Active
          </span>
        )}
      </div>
      <p className="mt-3">
        <span className="text-3xl font-semibold font-mono tabular-nums">
          {price}
        </span>
        <span className="text-[12px] text-[var(--text-muted)] ml-1">
          {period}
        </span>
      </p>
      {blurb && (
        <p className="mt-2 text-[12px] text-[var(--text-muted)] leading-relaxed">
          {blurb}
        </p>
      )}
      <ul className="mt-4 space-y-2 flex-1">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-[12px] text-[var(--text-soft)]"
          >
            <span className="text-accent mt-0.5">✓</span>
            {f}
          </li>
        ))}
      </ul>
      {cta && (
        <button
          type="button"
          disabled={cta.disabled}
          onClick={cta.onClick}
          className={`mt-5 ${cta.primary ? "btn-primary" : "btn-accent-outline w-full"}`}
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}
