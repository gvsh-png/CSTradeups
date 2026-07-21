"use client";

import { useCallback, useEffect, useState } from "react";
import type { SavedTradeUp, TradeUpResult } from "@/lib/tradeup/types";
import { STORAGE_KEY } from "@/lib/constants";
import Header from "@/components/Header";
import GeneratorForm from "@/components/GeneratorForm";
import TradeUpResults from "@/components/TradeUpResults";
import SavedTradeUps from "@/components/SavedTradeUps";
import type { Complexity } from "@/lib/constants";

type Tab = "generate" | "saved";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("generate");
  const [results, setResults] = useState<TradeUpResult[]>([]);
  const [saved, setSaved] = useState<SavedTradeUp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const persistSaved = useCallback((items: SavedTradeUp[]) => {
    setSaved(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, []);

  const handleGenerate = async (params: {
    minPrice: number;
    maxPrice: number;
    targetRoi: number;
    complexity: Complexity;
    feeType: "steam" | "csfloat";
  }) => {
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
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setResults(data.results || []);
      setMeta(data.meta || null);

      if (!data.results?.length) {
        setError(
          "No trade-ups matched your criteria. Try lowering the target ROI or widening the price range."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (tradeUp: TradeUpResult) => {
    if (saved.some((s) => s.id === tradeUp.id)) return;
    const item: SavedTradeUp = {
      ...tradeUp,
      savedAt: new Date().toISOString(),
    };
    persistSaved([item, ...saved]);
  };

  const handleRemove = (id: string) => {
    persistSaved(saved.filter((s) => s.id !== id));
  };

  const isSaved = (id: string) => saved.some((s) => s.id === id);

  return (
    <div className="min-h-dvh flex flex-col">
      <Header activeTab={activeTab} onTabChange={setActiveTab} savedCount={saved.length} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        {activeTab === "generate" ? (
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
            <aside className="lg:w-80 lg:shrink-0">
              <GeneratorForm onGenerate={handleGenerate} loading={loading} />
            </aside>

            <section className="flex-1 min-w-0">
              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-loss/10 border border-loss/20 text-loss text-sm">
                  {error}
                </div>
              )}

              {meta && !loading && (
                <p className="mb-4 text-xs text-[var(--text-muted)]">
                  {String(meta.pricesLoaded)} prices loaded
                  {meta.priceSource ? ` · source: ${String(meta.priceSource)}` : ""}
                  {meta.priceCorrections
                    ? ` · ${String(meta.priceCorrections)} outliers corrected`
                    : ""}
                </p>
              )}

              <TradeUpResults
                results={results}
                loading={loading}
                onSave={handleSave}
                isSaved={isSaved}
              />
            </section>
          </div>
        ) : (
          <SavedTradeUps items={saved} onRemove={handleRemove} />
        )}
      </main>

      <footer className="border-t border-surface-border py-4 text-center text-xs text-[var(--text-muted)]">
        Prices from Steam Community Market. Data may be delayed.
      </footer>
    </div>
  );
}
