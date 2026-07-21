"use client";

import { useState } from "react";
import type { SavedTradeUp } from "@/lib/tradeup/types";
import TradeUpCard from "./TradeUpCard";

interface SavedTradeUpsProps {
  items: SavedTradeUp[];
  onRemove: (id: string) => void;
  onUpdate: (item: SavedTradeUp) => void;
}

export default function SavedTradeUps({
  items,
  onRemove,
  onUpdate,
}: SavedTradeUpsProps) {
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const handleRefresh = async (item: SavedTradeUp) => {
    setRefreshingId(item.id);
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeUp: item }),
      });
      const data = await res.json();
      if (res.ok && data.tradeUp) {
        onUpdate({
          ...data.tradeUp,
          insight: data.tradeUp.insight ?? item.insight,
          savedAt: item.savedAt,
          note: item.note,
        });
      }
    } catch {
      /* ignore */
    } finally {
      setRefreshingId(null);
    }
  };

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-md border border-[var(--border)] flex items-center justify-center mb-4">
          <svg
            className="w-5 h-5 text-[var(--text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
            />
          </svg>
        </div>
        <h3 className="text-sm font-medium mb-1">No saved contracts</h3>
        <p className="text-[11px] text-[var(--text-muted)] max-w-[240px] leading-relaxed">
          Save trade-ups from scan results to track contracts you want to
          execute.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full max-w-3xl mx-auto">
      <p className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
        {items.length} saved
      </p>
      {items.map((item) => (
        <TradeUpCard
          key={item.id}
          tradeUp={item}
          saved
          savedAt={item.savedAt}
          onRefresh={() => handleRefresh(item)}
          refreshing={refreshingId === item.id}
          onRemove={() => onRemove(item.id)}
          onInsight={(insight) => onUpdate({ ...item, insight })}
          showShare
        />
      ))}
    </div>
  );
}
