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

      const raw = await res.text();
      let data: {
        results?: TradeUpResult[];
        meta?: Record<string, unknown>;
        error?: string;
        code?: string;
      } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        throw new Error(
          res.ok
            ? "Scanner returned an invalid response. Try again."
            : res.status === 504 || res.status === 502
              ? "Scan timed out — try a narrower price range or retry in a moment."
              : `Scan failed (${res.status}). Try again.`
        );
      }

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
          params.complexity === "covert"
            ? "No knife/glove contracts matched. Widen the price range or include more collections."
            : params.complexity === "souvenir"
              ? "No souvenir contracts matched. Widen the price range — souvenir inputs need real market prices."
              : "No contracts matched. Try adjusting risk chance, widening price range, or changing collection filters."
        );
      } else {
        requestAnimationFrame(() => {
          document
            .getElementById("results-feed")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      // Never surface raw JSON.parse noise
      setError(
        msg.includes("JSON.parse") || msg.includes("Unexpected token")
          ? "Scan failed — server returned an invalid response. Try again."
          : msg
      );
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
    <div className="w-full">
      {/* Mobile title — Stitch Scanner header */}
      <div className="lg:hidden mx-auto max-w-container px-4 pt-5 pb-1">
        <h1 className="text-2xl font-bold tracking-tight text-accent">Scanner</h1>
        <p className="text-[12px] text-[var(--text-muted)] mt-1">
          Configure filters and generate trade-up blueprints.
        </p>
      </div>

      {/* Configure — full-width centered hero (Stitch desktop dark) */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-5 lg:py-12 xl:py-14 animate-fade-up">
          <GeneratorForm
            variant="hero"
            onGenerate={handleGenerate}
            loading={loading}
            settings={settings}
            onOpenSettings={openSettings}
          />
        </div>
      </section>

      {/* Results feed */}
      <section
        id="results-feed"
        className="mx-auto max-w-[1100px] px-4 sm:px-6 py-6 lg:py-10"
      >
        <div className="flex items-end justify-between gap-4 mb-5 border-b border-[var(--border)] pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="hidden sm:block w-1 h-5 rounded-full bg-accent shrink-0" />
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
                Calculated Outcomes
              </h2>
            </div>
            {meta && !loading && results.length > 0 && (
              <p className="text-[11px] font-mono text-[var(--text-muted)] mt-1.5 sm:ml-3">
                {results.length} match{results.length !== 1 ? "es" : ""}
                {meta.pricesLoaded != null && (
                  <> · {String(meta.pricesLoaded)} prices</>
                )}
                {meta.priceSource != null && <> · {String(meta.priceSource)}</>}
              </p>
            )}
          </div>
          {results.length > 0 && !loading && (
            <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-mono text-accent">
              {results.length} match{results.length !== 1 ? "es" : ""}
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 px-3 py-2.5 rounded border border-[var(--loss)]/25 bg-[var(--loss)]/10 text-[var(--loss)] text-[11px] leading-relaxed">
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

        <TradeUpResults
          results={results}
          loading={loading}
          onSave={handleSave}
          onInsight={handleInsight}
          isSaved={isSaved}
        />
      </section>
    </div>
  );
}
