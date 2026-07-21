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
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
        {label}
      </p>
      <p className="stat-value" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

function RarityTag({ rarity }: { rarity: string }) {
  const color = RARITY_COLORS[rarity] || "#6e6e80";
  return (
    <span
      className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border"
      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}10` }}
    >
      {rarity.replace(" Grade", "").replace("Mil-Spec", "Mil")}
    </span>
  );
}

export default function TradeUpCard({ tradeUp, onSave, saved }: TradeUpCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const profitColor = tradeUp.expectedProfit >= 0 ? "var(--profit)" : "var(--loss)";

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
      else setInsight("AI unavailable — add OPENROUTER_API_KEY.");
    } catch {
      setInsight("Could not load insight.");
    } finally {
      setInsightLoading(false);
    }
  };

  return (
    <article className="panel overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <RarityTag rarity={tradeUp.inputRarity} />
            <span className="text-[var(--text-muted)] text-[10px]">→</span>
            <RarityTag rarity={tradeUp.outputRarity} />
            {tradeUp.type === "mixed" && (
              <span className="text-[9px] font-mono text-[var(--text-muted)] border border-[var(--border)] px-1 rounded">
                MIX
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] truncate font-mono">
            {tradeUp.description}
          </p>
        </div>

        <button
          onClick={onSave}
          disabled={saved}
          className={`shrink-0 p-1.5 rounded border transition-colors duration-150 ${
            saved
              ? "border-[var(--profit)]/30 text-[var(--profit)]"
              : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-accent/30"
          }`}
          title={saved ? "Saved" : "Save"}
        >
          <svg className="w-3.5 h-3.5" fill={saved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
        </button>
      </div>

      <div className="px-4 pb-3">
        <p className="label mb-2">Inputs</p>
        <div className="flex flex-wrap gap-1.5">
          {tradeUp.inputs.map((input, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-[var(--surface)] rounded border border-[var(--border)] p-1.5 min-w-0 max-w-full"
            >
              <SkinImage src={input.image} name={input.name} size="sm" rarity={tradeUp.inputRarity} />
              <div className="min-w-0">
                <p className="text-[11px] font-medium truncate max-w-[130px] sm:max-w-[180px]">
                  {input.count > 1 && <span className="text-accent font-mono">{input.count}× </span>}
                  {input.name}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] font-mono">
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

      <div className="mx-4 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[var(--surface)] rounded border border-[var(--border-subtle)]">
        <Stat
          label="Win chance"
          value={`${tradeUp.winPct}%`}
          color={tradeUp.winPct >= 50 ? "var(--profit)" : undefined}
        />
        <Stat label="Avg profit" value={`$${tradeUp.expectedProfit.toFixed(2)}`} color={profitColor} />
        <Stat label="ROI" value={`${tradeUp.roi}%`} color={profitColor} />
        <Stat label="Cost" value={`$${tradeUp.totalCost.toFixed(2)}`} />
      </div>

      <div className="border-t border-[var(--border)]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-150"
        >
          <span>OUTCOMES · {tradeUp.outcomes.length}</span>
          <span className="text-accent">{expanded ? "−" : "+"}</span>
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-1.5">
            {tradeUp.outcomes.map((outcome, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 p-2 rounded bg-[var(--surface)] border border-[var(--border-subtle)]"
              >
                <SkinImage src={outcome.image} name={outcome.name} size="sm" rarity={tradeUp.outputRarity} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{outcome.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">
                    {outcome.wear} · {outcome.float.toFixed(4)}
                  </p>
                </div>
                <div className="text-right shrink-0 font-mono">
                  <p className="text-[11px]">{outcome.prob}%</p>
                  <p className="text-[10px]" style={{ color: outcome.profit >= 0 ? "var(--profit)" : "var(--loss)" }}>
                    {outcome.profit >= 0 ? "+" : ""}${outcome.profit.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">${outcome.price.toFixed(2)}</p>
                </div>
              </div>
            ))}

            <button
              onClick={fetchInsight}
              disabled={insightLoading}
              className="w-full mt-1 py-2 text-[11px] font-mono text-accent hover:text-accent-dim transition-colors duration-150 disabled:opacity-40"
            >
              {insightLoading ? "Loading…" : insight ? "AI analysis" : "Get AI analysis"}
            </button>
            {insight && (
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed p-3 bg-[var(--surface)] rounded border border-[var(--border-subtle)]">
                {insight}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
