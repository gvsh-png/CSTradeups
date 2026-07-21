"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SavedTradeUp, TradeUpResult } from "@/lib/tradeup/types";
import { STORAGE_KEY } from "@/lib/constants";
import { loadSettings, type AppSettings } from "@/lib/settings";
import Header from "@/components/Header";
import GeneratorForm from "@/components/GeneratorForm";
import TradeUpResults from "@/components/TradeUpResults";
import SavedTradeUps from "@/components/SavedTradeUps";
import SettingsPanel from "@/components/SettingsPanel";
import AuthMenu from "@/components/AuthMenu";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import CurrencySelect from "@/components/CurrencySelect";
import UpgradeModal from "@/components/UpgradeModal";
import type { Complexity } from "@/lib/constants";

type Tab = "generate" | "saved";

function HomeInner() {
  const searchParams = useSearchParams();
  const {
    authConfigured,
    authRequired,
    user,
    refresh,
    claimSave,
    releaseSave,
    syncSavedCount,
    limits,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("generate");
  const [results, setResults] = useState<TradeUpResult[]>([]);
  const [saved, setSaved] = useState<SavedTradeUp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);

  const persistSaved = useCallback((items: SavedTradeUp[]) => {
    setSaved(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    if (searchParams.get("tab") === "saved") setActiveTab("saved");

    const auth = searchParams.get("auth");
    const billing = searchParams.get("billing");
    if (auth === "ok" || billing === "success") void refresh();
    if (auth === "failed") setError("Steam sign-in failed. Try again.");
  }, [searchParams, refresh]);

  // Reconcile server savedCount once after login
  useEffect(() => {
    if (!authConfigured || !user) return;
    void syncSavedCount(saved.length).then((result) => {
      if (!result.ok && result.error) {
        const max = limits.freeMaxSaved;
        if (saved.length > max) {
          persistSaved(saved.slice(0, max));
          void syncSavedCount(max);
        }
        setUpgradeReason(result.error);
        setUpgradeOpen(true);
      }
    });
    // Only when the signed-in Steam account changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authConfigured, user?.steamId]);

  const openUpgrade = (reason?: string) => {
    setUpgradeReason(reason ?? null);
    setUpgradeOpen(true);
  };

  const handleGenerate = async (params: {
    minPrice: number;
    maxPrice: number;
    targetRoi: number;
    complexity: Complexity;
    feeType: "steam" | "csfloat";
    excludeUnstableCollections: boolean;
    customExcludedCollections: string[];
  }) => {
    if (authConfigured && authRequired && !user) {
      openUpgrade("Sign in with Steam to run scans on the free plan.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === "AUTH_REQUIRED") {
          openUpgrade(data.error);
          throw new Error(data.error);
        }
        if (data.code === "SCAN_LIMIT") {
          openUpgrade(data.error);
          throw new Error(data.error);
        }
        throw new Error(data.error || "Generation failed");
      }

      setResults(data.results || []);
      setMeta(data.meta || null);
      void refresh();

      if (!data.results?.length) {
        setError(
          "No contracts matched. Try lowering ROI, widening price range, or adjusting collection filters."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (tradeUp: TradeUpResult) => {
    if (saved.some((s) => s.id === tradeUp.id)) return;

    if (authConfigured && authRequired && !user) {
      openUpgrade("Sign in with Steam to save trade-ups.");
      return;
    }

    if (authConfigured && user) {
      const claimed = await claimSave();
      if (!claimed.ok) {
        openUpgrade(claimed.error);
        return;
      }
    }

    persistSaved([
      { ...tradeUp, savedAt: new Date().toISOString() },
      ...saved,
    ]);
  };

  const handleInsight = (id: string, insight: string | undefined) => {
    setResults((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (insight === undefined) {
          const { insight: _removed, ...rest } = r;
          return rest;
        }
        return { ...r, insight };
      })
    );
    const savedMatch = saved.find((s) => s.id === id);
    if (savedMatch) {
      persistSaved(
        saved.map((s) => {
          if (s.id !== id) return s;
          if (insight === undefined) {
            const { insight: _removed, ...rest } = s;
            return rest as SavedTradeUp;
          }
          return { ...s, insight };
        })
      );
    }
  };

  const handleRemove = async (id: string) => {
    const next = saved.filter((s) => s.id !== id);
    persistSaved(next);
    if (authConfigured && user) {
      await releaseSave();
    }
  };

  const handleUpdate = (item: SavedTradeUp) => {
    persistSaved(saved.map((s) => (s.id === item.id ? item : s)));
  };

  const isSaved = (id: string) => saved.some((s) => s.id === id);

  return (
    <div className="min-h-dvh flex flex-col relative">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        savedCount={saved.length}
        currencySlot={<CurrencySelect />}
        authSlot={<AuthMenu onUpgrade={() => openUpgrade()} />}
      />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-8 relative z-10">
        {activeTab === "generate" ? (
          <div className="flex flex-col lg:flex-row gap-5 lg:gap-7 xl:gap-10">
            <aside className="w-full lg:w-[22rem] xl:w-[24rem] lg:shrink-0">
              <GeneratorForm
                onGenerate={handleGenerate}
                loading={loading}
                settings={settings}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            </aside>

            <section className="flex-1 min-w-0 space-y-3 lg:space-y-4">
              <div className="hidden lg:flex items-end justify-between gap-4 pb-1">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-accent/80">
                    Results board
                  </p>
                  <h2 className="text-lg font-semibold tracking-tight mt-1">
                    Trade-up contracts
                  </h2>
                </div>
                {meta && !loading && (
                  <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[10px] font-mono text-[var(--text-muted)]">
                    <span>{String(meta.pricesLoaded)} prices</span>
                    <span aria-hidden>·</span>
                    <span>{String(meta.priceSource)}</span>
                    {meta.excludedCollections ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>
                          {String(meta.excludedCollections)} filtered
                        </span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              {error && (
                <div className="px-3 py-2.5 rounded-md bg-[var(--loss)]/10 border border-[var(--loss)]/20 text-[var(--loss)] text-[11px] leading-relaxed">
                  {error}
                  {(error.includes("Steam") || error.includes("Upgrade") || error.includes("week")) && (
                    <button
                      type="button"
                      className="ml-2 underline text-accent"
                      onClick={() => openUpgrade(error)}
                    >
                      Details
                    </button>
                  )}
                </div>
              )}

              {meta && !loading && (
                <div className="flex lg:hidden flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono text-[var(--text-muted)]">
                  <span>{String(meta.pricesLoaded)} prices</span>
                  <span aria-hidden>·</span>
                  <span>{String(meta.priceSource)}</span>
                  {meta.excludedCollections ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>
                        {String(meta.excludedCollections)} filtered
                      </span>
                    </>
                  ) : null}
                </div>
              )}

              <TradeUpResults
                results={results}
                loading={loading}
                onSave={handleSave}
                onInsight={handleInsight}
                isSaved={isSaved}
              />
            </section>
          </div>
        ) : (
          <SavedTradeUps
            items={saved}
            onRemove={handleRemove}
            onUpdate={handleUpdate}
          />
        )}
      </main>

      <footer className="border-t border-[var(--border)] py-3 text-center text-[10px] font-mono text-[var(--text-muted)] relative z-10">
        market data · cached 24h
      </footer>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onChange={setSettings}
      />

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason={upgradeReason}
      />
    </div>
  );
}

export default function Home() {
  return (
    <CurrencyProvider>
      <AuthProvider>
        <Suspense fallback={<div className="min-h-dvh bg-[var(--bg)]" />}>
          <HomeInner />
        </Suspense>
      </AuthProvider>
    </CurrencyProvider>
  );
}
