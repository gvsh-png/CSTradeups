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
import type { Complexity } from "@/lib/constants";

type Tab = "generate" | "saved";

function HomeInner() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("generate");
  const [results, setResults] = useState<TradeUpResult[]>([]);
  const [saved, setSaved] = useState<SavedTradeUp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    if (searchParams.get("tab") === "saved") setActiveTab("saved");
  }, [searchParams]);

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
    customExcludedCollections: string[];
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
          "No contracts matched. Try lowering ROI, widening price range, or adjusting collection filters."
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
    // Also persist onto saved copy if already bookmarked
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

  const handleRemove = (id: string) => {
    persistSaved(saved.filter((s) => s.id !== id));
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
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-8 relative z-10">
        {activeTab === "generate" ? (
          <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
            <aside className="w-full lg:w-80 lg:shrink-0">
              <GeneratorForm
                onGenerate={handleGenerate}
                loading={loading}
                settings={settings}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            </aside>

            <section className="flex-1 min-w-0 space-y-3">
              {error && (
                <div className="px-3 py-2.5 rounded-md bg-[var(--loss)]/10 border border-[var(--loss)]/20 text-[var(--loss)] text-[11px] leading-relaxed">
                  {error}
                </div>
              )}

              {meta && !loading && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono text-[var(--text-muted)]">
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
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--bg)]" />}>
      <HomeInner />
    </Suspense>
  );
}
