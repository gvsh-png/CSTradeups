"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TradeUpCard from "@/components/TradeUpCard";
import AppProviders from "@/components/AppProviders";
import AppFrame from "@/components/AppFrame";
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
          "This share link is invalid or was truncated. Copy it again from CSTradeups."
        );
        setLoading(false);
        return;
      }

      const hydrated = await hydrateTradeUpImages(decoded);
      if (cancelled) return;
      setTradeUp(hydrated);
      setLoading(false);
    }

    void load();
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

  const handleInsight = (insight: string | undefined) => {
    if (!tradeUp) return;
    const updated =
      insight === undefined
        ? (() => {
            const { insight: _removed, ...rest } = tradeUp;
            return rest;
          })()
        : { ...tradeUp, insight };
    setTradeUp(updated);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const items = JSON.parse(raw) as SavedTradeUp[];
      const idx = items.findIndex((s) => s.id === updated.id);
      if (idx >= 0) {
        if (insight === undefined) {
          const { insight: _removed, ...rest } = items[idx];
          items[idx] = rest as SavedTradeUp;
        } else {
          items[idx] = { ...items[idx], insight };
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-5 lg:py-8 space-y-4">
      {error && (
        <div className="panel p-6 text-center space-y-3">
          <p className="text-sm text-[var(--loss)]">{error}</p>
          <Link
            href="/generate"
            className="inline-block text-xs font-mono text-accent hover:underline"
          >
            ← Open scanner
          </Link>
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
            <Link href="/generate" className="btn-ghost shrink-0">
              New scan
            </Link>
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
    <AppProviders>
      <AppFrame>
        <Suspense
          fallback={
            <div className="panel mx-auto max-w-3xl m-6 p-8 text-center text-[var(--text-muted)] text-sm font-mono">
              Loading…
            </div>
          }
        >
          <ShareContent />
        </Suspense>
      </AppFrame>
    </AppProviders>
  );
}
