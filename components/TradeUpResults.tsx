"use client";

import type { TradeUpResult } from "@/lib/tradeup/types";
import { useSimulatedProgress } from "@/hooks/useSimulatedProgress";
import LoadingProgress from "./LoadingProgress";
import TradeUpCard from "./TradeUpCard";

interface TradeUpResultsProps {
  results: TradeUpResult[];
  loading: boolean;
  onSave: (tradeUp: TradeUpResult) => void | Promise<void>;
  onInsight: (id: string, insight: string | undefined) => void;
  isSaved: (id: string) => boolean;
}

export default function TradeUpResults({
  results,
  loading,
  onSave,
  onInsight,
  isSaved,
}: TradeUpResultsProps) {
  const progress = useSimulatedProgress(loading, "generate");

  if (loading) {
    return (
      <div aria-busy="true" aria-live="polite">
        <LoadingProgress
          progress={progress}
          title="Scanning trade-ups"
        />
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
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
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>
        <h3 className="text-sm font-medium mb-1">Awaiting scan</h3>
        <p className="text-[11px] text-[var(--text-muted)] max-w-[240px] leading-relaxed">
          Set parameters and run a scan to find trade-up contracts from live
          market data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
        {results.length} result{results.length !== 1 ? "s" : ""}
      </p>
      {results.map((tradeUp) => (
        <TradeUpCard
          key={tradeUp.id}
          tradeUp={tradeUp}
          onSave={onSave}
          onInsight={(insight) => onInsight(tradeUp.id, insight)}
          saved={isSaved(tradeUp.id)}
          showShare
        />
      ))}
    </div>
  );
}
