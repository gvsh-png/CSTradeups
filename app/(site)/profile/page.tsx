"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useAppFrame } from "@/components/AppFrame";
import { useSaved } from "@/components/SavedProvider";
import {
  PLAN_LABELS,
  PLAN_PRICES,
  weeklyScanLimit,
  maxSavedLimit,
} from "@/lib/billing/plans";

export default function ProfilePage() {
  const { loading, authConfigured, user, quota, logout } = useAuth();
  const { openUpgrade, openSettings } = useAppFrame();
  const { saved } = useSaved();

  if (loading) {
    return (
      <div className="mx-auto max-w-container px-4 sm:px-6 py-10">
        <div className="h-40 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] animate-pulse" />
      </div>
    );
  }

  if (!authConfigured || !user) {
    return (
      <div className="mx-auto max-w-container px-4 sm:px-6 py-10 sm:py-16">
        <div className="max-w-lg mx-auto panel panel-desktop p-6 sm:p-8 text-center relative overflow-hidden">
          <h1 className="text-xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-2 text-[13px] text-[var(--text-muted)] leading-relaxed">
            Sign in with Steam to track scan quotas, manage your plan, and keep
            saved contracts synced to your account limits.
          </p>
          {authConfigured ? (
            <a
              href="/api/auth/steam"
              className="btn-primary mt-6 inline-flex w-full sm:w-auto px-8"
            >
              Sign in with Steam
            </a>
          ) : (
            <p className="mt-6 text-[12px] text-[var(--text-muted)]">
              Steam login will be available once auth env vars are configured.
            </p>
          )}
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <Link href="/subscription" className="btn-ghost">
              View subscriptions
            </Link>
            <button type="button" onClick={openSettings} className="btn-ghost">
              Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  const plan = user.plan;
  const scanLimit = weeklyScanLimit(plan);
  const savedLimit = maxSavedLimit(plan);

  return (
    <div className="mx-auto max-w-container px-4 sm:px-6 py-5 lg:py-8 space-y-5">
      <div className="panel panel-desktop p-5 sm:p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt=""
              className="h-16 w-16 rounded border border-[var(--border-subtle)]"
              width={64}
              height={64}
            />
          ) : (
            <div className="h-16 w-16 rounded border border-[var(--border-subtle)] bg-[var(--surface-high)]" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">
              {user.name}
            </h1>
            <p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              {PLAN_LABELS[plan]} · Steam ID {user.steamId}
            </p>
          </div>
          <button type="button" onClick={() => void logout()} className="btn-ghost self-start sm:self-center">
            Sign out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat
          label="Scans this week"
          value={
            scanLimit == null
              ? String(quota?.weeklyScans ?? 0)
              : `${quota?.weeklyScans ?? 0}/${scanLimit}`
          }
          hint={scanLimit == null ? "Unlimited" : "Resets each ISO week"}
        />
        <Stat
          label="Saved locally"
          value={
            savedLimit == null
              ? String(saved.length)
              : `${saved.length}/${savedLimit}`
          }
          hint="On this device"
        />
        <Stat
          label="Plan"
          value={PLAN_LABELS[plan]}
          hint={
            plan === "free"
              ? "Upgrade for more scans"
              : plan === "starter"
                ? PLAN_PRICES.starter.label
                : PLAN_PRICES.pro.label
          }
          accent
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/subscription"
          className="panel p-4 hover:border-accent/40 transition-colors group"
        >
          <p className="label mb-1">Subscription</p>
          <p className="text-sm font-semibold group-hover:text-accent transition-colors">
            {plan === "free" ? "Upgrade plan" : "Manage plan"}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Monthly Starter $3 or Pro $8 — no annual.
          </p>
        </Link>
        <button
          type="button"
          onClick={openSettings}
          className="panel p-4 text-left hover:border-accent/40 transition-colors group"
        >
          <p className="label mb-1">Settings</p>
          <p className="text-sm font-semibold group-hover:text-accent transition-colors">
            Excluded collections
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Always skip collections you don’t want in scans.
          </p>
        </button>
      </div>

      {plan === "free" && (
        <button type="button" onClick={() => openUpgrade()} className="btn-primary">
          Upgrade — from $3 / month
        </button>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
  className = "",
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={`panel p-4 ${className}`}>
      <p className="label">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold font-mono tabular-nums ${
          accent ? "text-accent" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">{hint}</p>
    </div>
  );
}
