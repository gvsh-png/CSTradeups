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
    excludeUnstableCollections: boolean;
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
          "No contracts matched. Try lowering ROI, widening price range, or disabling collection filter."
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
    persistSaved([{ ...tradeUp, savedAt: new Date().toISOString() }, ...saved]);
  };

  const handleRemove = (id: string) => {
    persistSaved(saved.filter((s) => s.id !== id));
  };

  const isSaved = (id: string) => saved.some((s) => s.id === id);

  return (
    <div className="min-h-dvh flex flex-col relative">
      <Header activeTab={activeTab} onTabChange={setActiveTab} savedCount={saved.length} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-8 relative z-10">
        {activeTab === "generate" ? (
          <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
            <aside className="lg:w-72 xl:w-80 lg:shrink-0">
              <GeneratorForm onGenerate={handleGenerate} loading={loading} />
            </aside>

            <section className="flex-1 min-w-0">
              {error && (
                <div className="mb-3 px-3 py-2.5 rounded-md bg-[var(--loss)]/8 border border-[var(--loss)]/20 text-[var(--loss)] text-[11px]">
                  {error}
                </div>
              )}

              {meta && !loading && (
                <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-[var(--text-muted)]">
                  <span>{String(meta.pricesLoaded)} prices</span>
                  <span>·</span>
                  <span>{String(meta.priceSource)}</span>
                  {meta.excludedCollections ? (
                    <>
                      <span>·</span>
                      <span>{String(meta.excludedCollections)} collections filtered</span>
                    </>
                  ) : null}
                  {meta.pricesCachedUntil ? (
                    <>
                      <span>·</span>
                      <span>
                        cache until{" "}
                        {new Date(String(meta.pricesCachedUntil)).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </>
                  ) : null}
                </div>
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

      <footer className="border-t border-[var(--border)] py-3 text-center text-[10px] font-mono text-[var(--text-muted)] relative z-10">
        market data · cached 24h
      </footer>
    </div>
  );
}
