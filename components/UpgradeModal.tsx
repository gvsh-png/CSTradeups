"use client";

import { useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleUpgrade = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!user) {
        window.location.href = "/api/auth/steam";
        return;
      }
      await startCheckout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md panel p-5 sm:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="upgrade-title" className="text-sm font-semibold">
              Unlock unlimited scans
            </h2>
            <p className="mt-1 text-[12px] text-[var(--text-muted)] leading-relaxed">
              {reason ||
                "Free accounts get limited weekly scans and one saved trade-up. Pro removes the caps."}
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

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-md border border-[var(--border)] p-3 space-y-1">
            <p className="font-mono uppercase tracking-wider text-[var(--text-muted)]">
              Free
            </p>
            <p>{limits.freeWeeklyScans} scans / week</p>
            <p>{limits.freeMaxSaved} saved at a time</p>
            <p>Steam login required</p>
          </div>
          <div className="rounded-md border border-accent/40 bg-accent/5 p-3 space-y-1">
            <p className="font-mono uppercase tracking-wider text-accent">Pro</p>
            <p>Unlimited scans</p>
            <p>Unlimited saved</p>
            <p>Priority updates</p>
          </div>
        </div>

        {error && (
          <p className="text-[11px] text-[var(--loss)] leading-relaxed">{error}</p>
        )}

        {!authConfigured && (
          <p className="text-[11px] text-[var(--text-muted)]">
            Auth is not configured on this deploy yet. Add Steam + Redis + Stripe
            env vars (see README).
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={busy || !authConfigured || (Boolean(user) && !stripeConfigured)}
            onClick={() => void handleUpgrade()}
            className="btn-primary flex-1"
          >
            {!user
              ? "Sign in with Steam"
              : busy
                ? "Redirecting…"
                : stripeConfigured
                  ? "Upgrade to Pro"
                  : "Billing not configured"}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
