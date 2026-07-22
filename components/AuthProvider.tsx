"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PlanId } from "@/lib/billing/plans";

export type AuthUser = {
  steamId: string;
  name: string;
  avatar?: string;
  plan: PlanId;
  planLabel: string;
};

export type Quota = {
  plan: PlanId;
  weeklyScans: number;
  weeklyScanLimit: number | null;
  weeklyScansRemaining: number | null;
  savedCount: number;
  maxSaved: number | null;
  canScan: boolean;
  canSave: boolean;
};

type AuthState = {
  loading: boolean;
  authConfigured: boolean;
  authRequired: boolean;
  stripeConfigured: boolean;
  user: AuthUser | null;
  quota: Quota | null;
  limits: {
    freeWeeklyScans: number;
    freeMaxSaved: number;
    starterWeeklyScans: number;
    starterMaxSaved: number;
  };
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  startCheckout: (plan?: Exclude<PlanId, "free">) => Promise<void>;
  openPortal: () => Promise<void>;
  claimSave: () => Promise<{ ok: boolean; error?: string }>;
  releaseSave: () => Promise<void>;
  syncSavedCount: (count: number) => Promise<{ ok: boolean; error?: string }>;
};

const AuthContext = createContext<AuthState | null>(null);

const defaultLimits = {
  freeWeeklyScans: 5,
  freeMaxSaved: 1,
  starterWeeklyScans: 40,
  starterMaxSaved: 15,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [limits, setLimits] = useState(defaultLimits);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setAuthConfigured(Boolean(data.authConfigured));
      setAuthRequired(Boolean(data.authRequired));
      setStripeConfigured(Boolean(data.stripeConfigured));
      setUser(data.user ?? null);
      setQuota(data.quota ?? null);
      if (data.limits) {
        setLimits({
          ...defaultLimits,
          ...data.limits,
        });
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setQuota(null);
    await refresh();
  }, [refresh]);

  const startCheckout = useCallback(
    async (plan: Exclude<PlanId, "free"> = "pro") => {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) window.location.href = data.url;
    },
    []
  );

  const openPortal = useCallback(async () => {
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Portal failed");
    if (data.url) window.location.href = data.url;
  }, []);

  const claimSave = useCallback(async () => {
    if (!authConfigured) return { ok: true };
    const res = await fetch("/api/usage/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim" }),
    });
    const data = await res.json();
    if (data.quota) setQuota(data.quota);
    if (!res.ok) return { ok: false, error: data.error || "Save limit reached" };
    return { ok: true };
  }, [authConfigured]);

  const releaseSave = useCallback(async () => {
    if (!authConfigured) return;
    const res = await fetch("/api/usage/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release" }),
    });
    const data = await res.json();
    if (data.quota) setQuota(data.quota);
  }, [authConfigured]);

  const syncSavedCount = useCallback(
    async (count: number) => {
      if (!authConfigured || !user) return { ok: true };
      const res = await fetch("/api/usage/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", savedCount: count }),
      });
      const data = await res.json();
      if (data.quota) setQuota(data.quota);
      if (!res.ok) return { ok: false, error: data.error || "Save limit reached" };
      return { ok: true };
    },
    [authConfigured, user]
  );

  const value = useMemo(
    () => ({
      loading,
      authConfigured,
      authRequired,
      stripeConfigured,
      user,
      quota,
      limits,
      refresh,
      logout,
      startCheckout,
      openPortal,
      claimSave,
      releaseSave,
      syncSavedCount,
    }),
    [
      loading,
      authConfigured,
      authRequired,
      stripeConfigured,
      user,
      quota,
      limits,
      refresh,
      logout,
      startCheckout,
      openPortal,
      claimSave,
      releaseSave,
      syncSavedCount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
