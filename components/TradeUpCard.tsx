"use client";

import { useRef, useState } from "react";
import type { TradeUpResult } from "@/lib/tradeup/types";

interface TradeUpCardProps {
  tradeUp: TradeUpResult;
  onSave?: () => void;
  saved?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  onRemove?: () => void;
  showShare?: boolean;
  savedAt?: string;
  compact?: boolean;
}

function IconBtn({
  onClick,
  disabled,
  title,
  active,
  danger,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title: string;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors duration-150 disabled:opacity-40 ${
        danger
          ? "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--loss)] hover:border-[var(--loss)]/40"
          : active
            ? "border-[var(--profit)]/30 text-[var(--profit)]"
            : "border-[var(--border)] text-[var(--text-muted)] hover:text-accent hover:border-accent/30"
      }`}
    >
      {children}
    </button>
  );
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
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1 truncate">
        {label}
      </p>
      <p
        className="text-sm font-semibold font-mono tabular-nums truncate"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function SkinThumb({ src, alt }: { src?: string; alt: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="w-10 h-10 shrink-0 object-contain rounded border border-[var(--border)] bg-[var(--surface)]"
    />
  ) : (
    <div className="w-10 h-10 shrink-0 rounded border border-[var(--border)] bg-[var(--surface)]" />
  );
}

export default function TradeUpCard({
  tradeUp,
  onSave,
  saved = false,
  onRefresh,
  refreshing = false,
  onRemove,
  showShare = true,
  savedAt,
  compact = false,
}: TradeUpCardProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pngLoading, setPngLoading] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  const profitColor =
    tradeUp.expectedProfit >= 0 ? "var(--profit)" : "var(--loss)";

  const handleShare = async () => {
    const { buildShareUrl } = await import("@/lib/share");
    const url = buildShareUrl(tradeUp);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handlePng = async () => {
    if (!cardRef.current) return;
    setPngLoading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#030304",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `tradeup-${tradeUp.id}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      alert("Could not generate PNG. Try again.");
    } finally {
      setPngLoading(false);
    }
  };

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

  const dateLabel = savedAt
    ? `Saved ${new Date(savedAt).toLocaleString()}`
    : tradeUp.generatedAt
      ? `Created ${new Date(tradeUp.generatedAt).toLocaleString()}`
      : null;

  return (
    <article ref={cardRef} className="panel overflow-hidden">
      {/* Header */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">
                {tradeUp.inputRarity
                  .replace(" Grade", "")
                  .replace("Mil-Spec", "Mil")}
              </span>
              <span className="text-[var(--text-muted)] text-[10px]">→</span>
              <span className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">
                {tradeUp.outputRarity
                  .replace(" Grade", "")
                  .replace("Mil-Spec", "Mil")}
              </span>
              {tradeUp.type === "mixed" && (
                <span className="text-[9px] font-mono text-[var(--text-muted)] border border-[var(--border)] px-1.5 py-0.5 rounded">
                  MIX
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-mono leading-snug break-words">
              {tradeUp.description}
            </p>
            {dateLabel && (
              <p className="text-[10px] text-[var(--text-muted)] font-mono opacity-70">
                {dateLabel}
              </p>
            )}
          </div>
        </div>

        {/* Action toolbar — always its own row so it never overlaps text */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onRefresh && (
            <IconBtn
              onClick={onRefresh}
              disabled={refreshing}
              title="Refresh prices"
            >
              <svg
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </IconBtn>
          )}
          {showShare && (
            <>
              <IconBtn
                onClick={handleShare}
                title={copied ? "Copied!" : "Copy share link"}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.29a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.54"
                  />
                </svg>
              </IconBtn>
              <IconBtn
                onClick={handlePng}
                disabled={pngLoading}
                title="Download PNG"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
              </IconBtn>
            </>
          )}
          {onSave && (
            <IconBtn
              onClick={onSave}
              disabled={saved}
              active={saved}
              title={saved ? "Saved" : "Save"}
            >
              <svg
                className="w-3.5 h-3.5"
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
            </IconBtn>
          )}
          {onRemove && (
            <IconBtn onClick={onRemove} title="Remove" danger>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </IconBtn>
          )}
          {copied && (
            <span className="text-[10px] font-mono text-accent ml-1">
              Link copied
            </span>
          )}
        </div>
      </div>

      {/* Inputs */}
      <div className="px-4 pb-4">
        <p className="label mb-2">Inputs</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {tradeUp.inputs.map((input, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 bg-[var(--surface)] rounded-md border border-[var(--border)] p-2 min-w-0"
            >
              <SkinThumb src={input.image} alt={input.name} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium truncate">
                  {input.count > 1 && (
                    <span className="text-accent font-mono">{input.count}× </span>
                  )}
                  {input.name}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 truncate">
                  {input.wear} · ${input.price.toFixed(2)}
                  {tradeUp.complexity !== "simple" &&
                    input.maxFloat != null && (
                      <span> · ≤{input.maxFloat.toFixed(4)}</span>
                    )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 p-3 bg-[var(--surface)] rounded-md border border-[var(--border)]">
          <Stat
            label="Win chance"
            value={`${tradeUp.winPct}%`}
            color={tradeUp.winPct >= 50 ? "var(--profit)" : undefined}
          />
          <Stat
            label="Avg profit"
            value={`$${tradeUp.expectedProfit.toFixed(2)}`}
            color={profitColor}
          />
          <Stat
            label="ROI"
            value={`${tradeUp.roi}%`}
            color={profitColor}
          />
          <Stat label="Cost" value={`$${tradeUp.totalCost.toFixed(2)}`} />
        </div>
      </div>

      {/* Outcomes */}
      <div className="border-t border-[var(--border)]">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-150"
        >
          <span>OUTCOMES · {tradeUp.outcomes.length}</span>
          <span className="text-accent w-4 text-center">
            {expanded ? "−" : "+"}
          </span>
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-2">
            {tradeUp.outcomes.map((outcome, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] min-w-0"
              >
                <SkinThumb src={outcome.image} alt={outcome.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">
                    {outcome.name}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 truncate">
                    {outcome.wear} · {outcome.float.toFixed(4)}
                  </p>
                </div>
                <div className="text-right shrink-0 font-mono w-[4.5rem]">
                  <p className="text-[11px] tabular-nums">{outcome.prob}%</p>
                  <p
                    className="text-[10px] tabular-nums"
                    style={{
                      color:
                        outcome.profit >= 0 ? "var(--profit)" : "var(--loss)",
                    }}
                  >
                    {outcome.profit >= 0 ? "+" : ""}$
                    {outcome.profit.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] tabular-nums">
                    ${outcome.price.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={fetchInsight}
              disabled={insightLoading}
              className="w-full mt-1 py-2.5 text-[11px] font-mono text-accent hover:text-accent-dim transition-colors duration-150 disabled:opacity-40 border border-[var(--border)] rounded-md"
            >
              {insightLoading
                ? "Loading…"
                : insight
                  ? "AI analysis"
                  : "Get AI analysis"}
            </button>
            {insight && (
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed p-3 bg-[var(--surface)] rounded-md border border-[var(--border)]">
                {insight}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
