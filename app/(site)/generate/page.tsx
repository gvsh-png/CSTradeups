"use client";

import { useEffect, useState } from "react";
import type { TradeUpResult } from "@/lib/tradeup/types";
import type { Complexity } from "@/lib/constants";
import GeneratorForm from "@/components/GeneratorForm";
import TradeUpResults from "@/components/TradeUpResults";
import { useAuth } from "@/components/AuthProvider";
import { useAppFrame } from "@/components/AppFrame";
import { useSaved } from "@/components/SavedProvider";

export default function GeneratePage() {
  const { authConfigured, authRequired, user, refresh } = useAuth();
  const { openUpgrade, openSettings, settings } = useAppFrame();
  const { saveTradeUp, isSaved, updateInsight, saved } = useSaved();

  const [results, setResults] = useState<TradeUpResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    // Clear auth failure toast from query if present
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "failed") {
      setError("Steam sign-in failed. Try again.");
    }
  }, []);

  const handleGenerate = async (params: {
    minPrice: number;
    maxPrice: number;
    targetWinChance: number;
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
        if (data.code === "AUTH_REQUIRED" || data.code === "SCAN_LIMIT") {
          openUpgrade(data.error);
        }
        throw new Error(data.error || "Generation failed");
      }

      setResults(data.results || []);
      setMeta(data.meta || null);
      void refresh();

      if (!data.results?.length) {
        setError(
          "No contracts matched. Try adjusting target win, widening price range, or changing collection filters."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (tradeUp: TradeUpResult) => {
    await saveTradeUp(tradeUp, openUpgrade);
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
    if (saved.some((s) => s.id === id)) {
      updateInsight(id, insight);
    }
  };

  return (
    <div className="mx-auto max-w-container px-4 sm:px-6 py-5 lg:py-8">
      <div className="mb-5 lg:mb-6 lg:hidden">
        <h1 className="text-xl font-semibold tracking-tight">Configure scanner</h1>
        <p className="text-[12px] text-[var(--text-muted)] mt-1">
          Set parameters to find high-EV trade-ups.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 lg:gap-7 xl:gap-10">
        <aside className="w-full lg:w-[22rem] xl:w-[24rem] lg:shrink-0">
          <GeneratorForm
            onGenerate={handleGenerate}
            loading={loading}
            settings={settings}
            onOpenSettings={openSettings}
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
                    <span>{String(meta.excludedCollections)} filtered</span>
                  </>
                ) : null}
              </div>
            )}
          </div>

          {error && (
            <div className="px-3 py-2.5 rounded-md bg-[var(--loss)]/10 border border-[var(--loss)]/20 text-[var(--loss)] text-[11px] leading-relaxed">
              {error}
              {(error.includes("Steam") ||
                error.includes("Upgrade") ||
                error.includes("week")) && (
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
    </div>
  );
}
