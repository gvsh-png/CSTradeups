"use client";

import { useState } from "react";
import type { TradeUpResult } from "@/lib/tradeup/types";
import { RARITY_COLORS } from "@/lib/constants";
import SkinImage from "./SkinImage";

interface TradeUpCardProps {
  tradeUp: TradeUpResult;
  onSave: () => void;
  saved: boolean;
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] sm:text-xs text-[var(--text-muted)] mb-0.5">
        {label}
      </p>
      <p
        className="text-sm sm:text-base font-semibold font-mono"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

export default function TradeUpCard({ tradeUp, onSave, saved }: TradeUpCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const profitColor = tradeUp.expectedProfit >= 0 ? "#3ecf8e" : "#e5534b";

  const fetchInsight = async () => {
    if (insight) return;
    setInsightLoading(true);
    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeUp }),
      });
      const data = await res.json();
      if (res.ok) setInsight(data.insight);
      else setInsight("AI insights unavailable. Add OPENROUTER_API_KEY to enable.");
    } catch {
      setInsight("Could not load insight.");
    } finally {
      setInsightLoading(false);
    }
  };

  return (
    <article className="bg-surface-raised border border-surface-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${RARITY_COLORS[tradeUp.inputRarity]}20`,
                color: RARITY_COLORS[tradeUp.inputRarity],
              }}
            >
              {tradeUp.inputRarity}
            </span>
            <svg
              className="w-3 h-3 text-[var(--text-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${RARITY_COLORS[tradeUp.outputRarity]}20`,
                color: RARITY_COLORS[tradeUp.outputRarity],
              }}
            >
              {tradeUp.outputRarity}
            </span>
            {tradeUp.type === "mixed" && (
              <span className="text-[10px] text-[var(--text-muted)]">Mixed</span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] truncate">
            {tradeUp.description}
          </p>
        </div>

        <button
          onClick={onSave}
          disabled={saved}
          className={`shrink-0 p-2 rounded-lg border transition-colors ${
            saved
              ? "border-profit/30 text-profit bg-profit/5"
              : "border-surface-border text-[var(--text-muted)] hover:text-white hover:border-accent"
          }`}
          title={saved ? "Saved" : "Save trade-up"}
        >
          <svg
            className="w-4 h-4"
            fill={saved ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
            />
          </svg>
        </button>
      </div>

      {/* Input Items */}
      <div className="px-4 sm:px-5 pb-3">
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">
          Inputs
        </p>
        <div className="flex flex-wrap gap-2">
          {tradeUp.inputs.map((input, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-surface rounded-lg p-2 border border-surface-border min-w-0 max-w-full"
            >
              <SkinImage
                src={input.image}
                name={input.name}
                size="sm"
                rarity={tradeUp.inputRarity}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate max-w-[140px] sm:max-w-[200px]">
                  {input.count > 1 && (
                    <span className="text-accent font-mono">{input.count}x </span>
                  )}
                  {input.name}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {input.wear} · ${input.price.toFixed(2)}
                  {tradeUp.complexity !== "simple" && input.maxFloat != null && (
                    <span> · ≤{input.maxFloat.toFixed(4)}</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="mx-4 sm:mx-5 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-surface rounded-lg border border-surface-border">
        <Stat
          label="Chance to Profit"
          value={`${tradeUp.winPct}%`}
          color={tradeUp.winPct >= 50 ? "#3ecf8e" : undefined}
        />
        <Stat
          label="Avg Profit"
          value={`$${tradeUp.expectedProfit.toFixed(2)}`}
          color={profitColor}
        />
        <Stat label="ROI" value={`${tradeUp.roi}%`} color={profitColor} />
        <Stat label="Total Cost" value={`$${tradeUp.totalCost.toFixed(2)}`} />
      </div>

      {/* Outcomes */}
      <div className="border-t border-surface-border">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 sm:px-5 py-3 flex items-center justify-between text-xs font-medium text-[var(--text-muted)] hover:text-white transition-colors"
        >
          <span>Possible Outcomes ({tradeUp.outcomes.length})</span>
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <div className="px-4 sm:px-5 pb-4 space-y-2">
            {tradeUp.outcomes.map((outcome, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2 rounded-lg bg-surface border border-surface-border"
              >
                <SkinImage
                  src={outcome.image}
                  name={outcome.name}
                  size="sm"
                  rarity={tradeUp.outputRarity}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{outcome.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {outcome.wear} · Float {outcome.float.toFixed(4)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono">{outcome.prob}%</p>
                  <p
                    className="text-[10px] font-mono"
                    style={{ color: outcome.profit >= 0 ? "#3ecf8e" : "#e5534b" }}
                  >
                    {outcome.profit >= 0 ? "+" : ""}${outcome.profit.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    ${outcome.price.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}

            <button
              onClick={fetchInsight}
              disabled={insightLoading}
              className="w-full mt-2 py-2 text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
            >
              {insightLoading
                ? "Loading insight..."
                : insight
                  ? "AI Insight"
                  : "Get AI Insight"}
            </button>
            {insight && (
              <p className="text-xs text-[var(--text-muted)] leading-relaxed p-3 bg-surface rounded-lg border border-surface-border">
                {insight}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
