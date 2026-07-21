"use client";

import type { TradeUpResult } from "@/lib/tradeup/types";
import TradeUpCard from "./TradeUpCard";

interface TradeUpResultsProps {
  results: TradeUpResult[];
  loading: boolean;
  onSave: (tradeUp: TradeUpResult) => void;
  isSaved: (id: string) => boolean;
}

export default function TradeUpResults({
  results,
  loading,
  onSave,
  isSaved,
}: TradeUpResultsProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-surface-raised border border-surface-border rounded-xl p-5 animate-pulse"
          >
            <div className="h-4 bg-surface-border rounded w-1/3 mb-4" />
            <div className="flex gap-3 mb-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="w-14 h-14 bg-surface-border rounded-md" />
              ))}
            </div>
            <div className="h-3 bg-surface-border rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-raised border border-surface-border flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-[var(--text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>
        <h3 className="text-sm font-medium mb-1">No results yet</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-xs">
          Configure your parameters and hit Find Trade-Ups to scan live market
          data for profitable contracts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">
        {results.length} trade-up{results.length !== 1 ? "s" : ""} found
      </p>
      {results.map((tradeUp) => (
        <TradeUpCard
          key={tradeUp.id}
          tradeUp={tradeUp}
          onSave={() => onSave(tradeUp)}
          saved={isSaved(tradeUp.id)}
        />
      ))}
    </div>
  );
}
