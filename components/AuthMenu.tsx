"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

type Props = {
  onUpgrade: () => void;
};

export default function AuthMenu({ onUpgrade }: Props) {
  const {
    loading,
    authConfigured,
    user,
    quota,
    stripeConfigured,
    logout,
    openPortal,
  } = useAuth();
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="h-8 w-20 rounded border border-[var(--border-subtle)] bg-[var(--surface)] animate-pulse" />
    );
  }

  if (!authConfigured) {
    return (
      <Link
        href="/profile"
        className="hidden sm:inline-flex h-8 items-center rounded border border-[var(--border-subtle)] px-2.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        Profile
      </Link>
    );
  }

  if (!user) {
    return (
      <a
        href="/api/auth/steam"
        className="inline-flex h-8 items-center gap-1.5 rounded border border-accent/40 bg-[var(--accent-dim)] px-2.5 text-[11px] font-semibold text-[var(--accent-ink)] hover:brightness-110 transition-all"
      >
        <SteamMark />
        <span className="hidden sm:inline">Sign in with Steam</span>
        <span className="sm:hidden">Steam</span>
      </a>
    );
  }

  const paid = user.plan === "starter" || user.plan === "pro";

  return (
    <div className="flex items-center gap-1.5">
      {quota && user.plan === "free" && (
        <button
          type="button"
          onClick={onUpgrade}
          className="hidden sm:inline-flex h-8 items-center rounded border border-accent/30 bg-accent/10 px-2.5 text-[10px] font-mono text-accent hover:bg-accent/15 transition-colors"
          title="Weekly scan + save limits"
        >
          {quota.weeklyScansRemaining ?? 0}/{quota.weeklyScanLimit} scans
        </button>
      )}
      {user.plan === "starter" && (
        <span className="hidden sm:inline-flex h-8 items-center rounded border border-accent/30 bg-accent/10 px-2 text-[10px] font-mono text-accent">
          Starter
        </span>
      )}
      {user.plan === "pro" && (
        <span className="hidden sm:inline-flex h-8 items-center rounded border border-[var(--profit)]/30 bg-[var(--profit)]/10 px-2 text-[10px] font-mono text-[var(--profit)]">
          Pro
        </span>
      )}
      <div className="relative group">
        <Link
          href="/profile"
          className="inline-flex h-8 items-center gap-1.5 rounded border border-[var(--border-subtle)] bg-[var(--surface)] pl-1 pr-2 text-[11px] max-w-[148px] hover:border-accent/30 transition-colors"
        >
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt=""
              className="h-6 w-6 rounded"
              width={24}
              height={24}
            />
          ) : (
            <span className="h-6 w-6 rounded bg-[var(--border-subtle)]" />
          )}
          <span className="truncate font-medium">{user.name}</span>
        </Link>
        <div className="absolute right-0 top-full z-50 mt-1 hidden min-w-[190px] rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1 shadow-lg group-hover:block group-focus-within:block">
          <p className="px-2 py-1.5 text-[10px] font-mono text-[var(--text-muted)]">
            {user.planLabel}
            {quota?.weeklyScanLimit != null && (
              <> · {quota.weeklyScans}/{quota.weeklyScanLimit} scans</>
            )}
          </p>
          <Link
            href="/profile"
            className="block w-full rounded px-2 py-1.5 text-left text-[11px] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            Profile
          </Link>
          <Link
            href="/subscription"
            className="block w-full rounded px-2 py-1.5 text-left text-[11px] text-accent hover:bg-accent/10"
          >
            {paid ? "Manage subscription" : "Upgrade"}
          </Link>
          {!paid && stripeConfigured && (
            <button
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-[11px] text-accent hover:bg-accent/10"
              onClick={onUpgrade}
            >
              Quick upgrade
            </button>
          )}
          {paid && stripeConfigured && (
            <button
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-[11px] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await openPortal();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Billing portal
            </button>
          )}
          <button
            type="button"
            className="w-full rounded px-2 py-1.5 text-left text-[11px] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
            onClick={() => void logout()}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function SteamMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="currentColor"
      aria-hidden
    >
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
    </svg>
  );
}
