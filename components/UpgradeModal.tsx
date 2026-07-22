"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PLAN_PRICES,
  STARTER_MAX_SAVED,
  STARTER_WEEKLY_SCANS,
} from "@/lib/billing/plans";
import { useAuth } from "./AuthProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  reason?: string | null;
};

export default function UpgradeModal({ open, onClose, reason }: Props) {
  const {
    user,
    authConfigured,
    stripeConfigured,
    limits,
    startCheckout,
  } = useAuth();
  const [busy, setBusy] = useState<"starter" | "pro" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const go = async (plan: "starter" | "pro") => {
    setError(null);
    setBusy(plan);
    try {
      if (!user) {
        window.location.href = "/api/auth/steam";
        return;
      }
      await startCheckout(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg panel panel-desktop p-5 sm:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="upgrade-title" className="text-base font-semibold tracking-tight">
              Choose a plan
            </h2>
            <p className="mt-1 text-[12px] text-[var(--text-muted)] leading-relaxed">
              {reason ||
                "Monthly plans only — pick the scan and save limits that fit how you trade."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-md border border-[var(--border-subtle)] p-3 space-y-1">
            <p className="font-mono uppercase tracking-wider text-[var(--text-muted)]">
              Free
            </p>
            <p className="text-lg font-semibold font-mono">$0</p>
            <p>{limits.freeWeeklyScans} scans / week</p>
            <p>{limits.freeMaxSaved} saved slot</p>
          </div>
          <div className="rounded-md border border-accent/35 bg-accent/5 p-3 space-y-1">
            <p className="font-mono uppercase tracking-wider text-accent">
              Starter
            </p>
            <p className="text-lg font-semibold font-mono">
              {PLAN_PRICES.starter.label}
            </p>
            <p>{STARTER_WEEKLY_SCANS} scans / week</p>
            <p>{STARTER_MAX_SAVED} saved slots</p>
          </div>
          <div className="rounded-md border border-accent/50 bg-accent/10 p-3 space-y-1">
            <p className="font-mono uppercase tracking-wider text-accent">Pro</p>
            <p className="text-lg font-semibold font-mono">
              {PLAN_PRICES.pro.label}
            </p>
            <p>Unlimited scans</p>
            <p>Unlimited saved</p>
          </div>
        </div>

        {error && (
          <p className="text-[11px] text-[var(--loss)] leading-relaxed">{error}</p>
        )}

        {!authConfigured && (
          <p className="text-[11px] text-[var(--text-muted)]">
            Auth is not configured on this deploy yet. Add Steam + Redis + Stripe
            env vars.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {!user ? (
            <button
              type="button"
              disabled={!authConfigured}
              onClick={() => void go("pro")}
              className="btn-primary flex-1"
            >
              Sign in with Steam
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={!!busy || !stripeConfigured || user.plan === "starter" || user.plan === "pro"}
                onClick={() => void go("starter")}
                className="btn-accent-outline flex-1"
              >
                {busy === "starter" ? "Redirecting…" : "Starter · $3"}
              </button>
              <button
                type="button"
                disabled={!!busy || !stripeConfigured || user.plan === "pro"}
                onClick={() => void go("pro")}
                className="btn-primary flex-1"
              >
                {busy === "pro"
                  ? "Redirecting…"
                  : stripeConfigured
                    ? "Pro · $8"
                    : "Billing not configured"}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Link
            href="/subscription"
            onClick={onClose}
            className="text-[11px] text-accent hover:underline"
          >
            View full plans
          </Link>
          <button type="button" onClick={onClose} className="btn-ghost">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
