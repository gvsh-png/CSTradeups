"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import TradeUpCard from "@/components/TradeUpCard";
import { decodeTradeUpShare, hydrateTradeUpImages } from "@/lib/share";
import { STORAGE_KEY } from "@/lib/constants";
import type { SavedTradeUp, TradeUpResult } from "@/lib/tradeup/types";

function ShareContent() {
  const searchParams = useSearchParams();
  const encoded = searchParams.get("d") || "";
  const [tradeUp, setTradeUp] = useState<TradeUpResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setTradeUp(null);

      if (!encoded) {
        setError("Missing share data. Ask for a fresh share link.");
        setLoading(false);
        return;
      }

      const decoded = decodeTradeUpShare(encoded);
      if (!decoded) {
        setError(
          "This share link is invalid or was truncated. Copy it again from TradeUp Gen."
        );
        setLoading(false);
        return;
      }

      const hydrated = await hydrateTradeUpImages(decoded);
      if (cancelled) return;
      setTradeUp(hydrated);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [encoded]);

  useEffect(() => {
    if (!tradeUp) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const items = JSON.parse(raw) as SavedTradeUp[];
      setSaved(items.some((s) => s.id === tradeUp.id));
    } catch {
      /* ignore */
    }
  }, [tradeUp]);

  const handleSave = (item?: TradeUpResult) => {
    const toSave = item ?? tradeUp;
    if (!toSave) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const items: SavedTradeUp[] = raw ? JSON.parse(raw) : [];
      if (items.some((s) => s.id === toSave.id)) {
        setSaved(true);
        return;
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          { ...toSave, savedAt: new Date().toISOString() },
          ...items,
        ])
      );
      setSaved(true);
    } catch {
      /* ignore */
    }
  };

  const handleInsight = (insight: string) => {
    if (!tradeUp) return;
    const updated = { ...tradeUp, insight };
    setTradeUp(updated);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const items = JSON.parse(raw) as SavedTradeUp[];
      const idx = items.findIndex((s) => s.id === updated.id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], insight };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="panel p-6 text-center space-y-3">
          <p className="text-sm text-[var(--loss)]">{error}</p>
          <a
            href="/"
            className="inline-block text-xs font-mono text-accent hover:underline"
          >
            ← Back to scanner
          </a>
        </div>
      )}

      {loading && !error && (
        <div className="panel p-8 text-center text-[var(--text-muted)] text-sm font-mono">
          Loading shared contract…
        </div>
      )}

      {tradeUp && !error && !loading && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-wider text-accent mb-1">
                Shared trade-up
              </p>
              <h1 className="text-sm font-semibold truncate">
                {tradeUp.inputRarity.replace(/ Grade$/, "")} →{" "}
                {tradeUp.outputRarity.replace(/ Grade$/, "")}
              </h1>
            </div>
            <a href="/" className="btn-ghost shrink-0">
              New scan
            </a>
          </div>

          <TradeUpCard
            tradeUp={tradeUp}
            onSave={handleSave}
            onInsight={handleInsight}
            saved={saved}
            showShare
          />
        </>
      )}
    </div>
  );
}

export default function SharePage() {
  return (
    <div className="min-h-dvh flex flex-col relative">
      <Header
        activeTab="generate"
        onTabChange={(t) => {
          window.location.href = t === "saved" ? "/?tab=saved" : "/";
        }}
        savedCount={0}
      />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-5 lg:py-8 relative z-10">
        <Suspense
          fallback={
            <div className="panel p-8 text-center text-[var(--text-muted)] text-sm font-mono">
              Loading…
            </div>
          }
        >
          <ShareContent />
        </Suspense>
      </main>

      <footer className="border-t border-[var(--border)] py-3 text-center text-[10px] font-mono text-[var(--text-muted)] relative z-10">
        market data · cached 24h
      </footer>
    </div>
  );
}
