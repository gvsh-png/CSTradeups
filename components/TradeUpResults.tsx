"use client";

import type { TradeUpResult } from "@/lib/tradeup/types";
import { useSimulatedProgress } from "@/hooks/useSimulatedProgress";
import LoadingProgress from "./LoadingProgress";
import TradeUpCard from "./TradeUpCard";

interface TradeUpResultsProps {
  results: TradeUpResult[];
  loading: boolean;
  onSave: (
    tradeUp: TradeUpResult
  ) => boolean | void | Promise<boolean | void>;
  onUnsave: (id: string) => void | Promise<void>;
  onInsight: (id: string, insight: string | undefined) => void;
  isSaved: (id: string) => boolean;
  /** Highlight / rank label when hunting a specific outcome */
  targetOutcomeName?: string | null;
}

export default function TradeUpResults({
  results,
  loading,
  onSave,
  onUnsave,
  onInsight,
  isSaved,
  targetOutcomeName,
}: TradeUpResultsProps) {
  const progress = useSimulatedProgress(loading, "generate");

  if (loading) {
    return (
      <div
        id="scan-loading"
        className="scroll-mt-20 sm:scroll-mt-24"
        aria-busy="true"
        aria-live="polite"
      >
        <LoadingProgress
          progress={progress}
          title="Computing Outcomes"
        />
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="flex flex-col items-center justify-center py-14 sm:py-20 text-center panel panel-desktop">
        <div className="w-12 h-12 rounded border border-[var(--border)] flex items-center justify-center mb-4 text-accent/70">
          <svg
            className="w-5 h-5"
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
        <p className="text-[11px] text-[var(--text-muted)] max-w-[260px] leading-relaxed">
          Set parameters above and generate analysis to list viable trade-up
          blueprints.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {results.map((tradeUp, i) => (
        <div
          key={tradeUp.id}
          id={i === 0 ? "first-tradeup" : undefined}
          className={`animate-fade-up ${i === 0 ? "scroll-mt-20 sm:scroll-mt-24" : ""}`}
          style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
        >
          <TradeUpCard
            tradeUp={tradeUp}
            onSave={onSave}
            onUnsave={() => onUnsave(tradeUp.id)}
            onInsight={(insight) => onInsight(tradeUp.id, insight)}
            saved={isSaved(tradeUp.id)}
            targetOutcomeName={targetOutcomeName || undefined}
            showShare
          />
        </div>
      ))}
    </div>
  );
}
