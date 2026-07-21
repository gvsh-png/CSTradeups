"use client";

import { useEffect, useRef, useState } from "react";
import type { TradeUpResult } from "@/lib/tradeup/types";
import { rarityShort, rarityStyle } from "@/lib/constants";
import type { ProgressState } from "@/hooks/useSimulatedProgress";
import LoadingProgress from "./LoadingProgress";
import MarketLinks from "./MarketLinks";
import { useCurrency } from "./CurrencyProvider";

interface TradeUpCardProps {
  tradeUp: TradeUpResult;
  onSave?: (tradeUp: TradeUpResult) => void | Promise<void>;
  onInsight?: (insight: string | undefined) => void;
  saved?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshProgress?: ProgressState;
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

function SkinThumb({
  src,
  alt,
  rarity,
}: {
  src?: string;
  alt: string;
  rarity: string;
}) {
  const style = rarityStyle(rarity);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="w-10 h-10 shrink-0 object-contain rounded border"
      style={{
        borderColor: style.borderColor,
        backgroundColor: style.backgroundColor,
      }}
    />
  ) : (
    <div
      className="w-10 h-10 shrink-0 rounded border"
      style={{
        borderColor: style.borderColor,
        backgroundColor: style.backgroundColor,
      }}
    />
  );
}

function RarityBadge({ rarity }: { rarity: string }) {
  const style = rarityStyle(rarity);
  return (
    <span
      className="text-[9px] font-mono font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border"
      style={style}
      title={rarity}
    >
      {rarityShort(rarity)}
    </span>
  );
}

export default function TradeUpCard({
  tradeUp,
  onSave,
  onInsight,
  saved = false,
  onRefresh,
  refreshing = false,
  refreshProgress,
  onRemove,
  showShare = true,
  savedAt,
  compact = false,
}: TradeUpCardProps) {
  const { money } = useCurrency();
  const [expanded, setExpanded] = useState(!compact);
  const [insight, setInsight] = useState<string | null>(tradeUp.insight ?? null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pngLoading, setPngLoading] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const fetchedRef = useRef(Boolean(tradeUp.insight));

  useEffect(() => {
    // Sync (and clear) when parent expires insight after a price refresh
    setInsight(tradeUp.insight ?? null);
    fetchedRef.current = Boolean(tradeUp.insight);
  }, [tradeUp.insight, tradeUp.id]);

  const withInsight = (base: TradeUpResult = tradeUp): TradeUpResult => ({
    ...base,
    insight: insight ?? undefined,
  });

  const profitColor =
    tradeUp.expectedProfit >= 0 ? "var(--profit)" : "var(--loss)";

  const handleShare = async () => {
    const { buildShareUrl } = await import("@/lib/share");
    const url = buildShareUrl(withInsight());
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handlePng = async () => {
    setPngLoading(true);
    try {
      const { exportTradeUpPng } = await import("@/lib/exportPng");
      await exportTradeUpPng(withInsight());
    } catch (err) {
      console.error("PNG export failed:", err);
      alert("Could not generate PNG. Try again.");
    } finally {
      setPngLoading(false);
    }
  };

  const persistInsight = (text: string) => {
    setInsight(text);
    fetchedRef.current = true;
    onInsight?.(text);
  };

  const fetchInsight = async (force = false) => {
    if (!force && (insight || fetchedRef.current)) return;
    setInsightLoading(true);
    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeUp }),
      });
      const data = await res.json();
      if (res.ok && typeof data.insight === "string") {
        persistInsight(data.insight);
      } else if (!insight || force) {
        setInsight("AI unavailable — add OPENROUTER_API_KEY.");
        fetchedRef.current = false;
        if (force) onInsight?.(undefined);
      }
    } catch {
      if (!insight || force) {
        setInsight("Could not load insight.");
        fetchedRef.current = false;
        if (force) onInsight?.(undefined);
      }
    } finally {
      setInsightLoading(false);
    }
  };

  const dateLabel = savedAt
    ? `Saved ${new Date(savedAt).toLocaleString()}`
    : tradeUp.generatedAt
      ? `Created ${new Date(tradeUp.generatedAt).toLocaleString()}`
      : null;

  const inputStyle = rarityStyle(tradeUp.inputRarity);
  const outputStyle = rarityStyle(tradeUp.outputRarity);

  return (
    <article
      ref={cardRef}
      className="panel overflow-hidden lg:transition-shadow lg:hover:shadow-[0_12px_40px_-24px_rgba(0,0,0,0.7)]"
      aria-busy={refreshing}
    >
      {refreshing && refreshProgress && (
        <div className="px-4 pt-3 pb-2 border-b border-[var(--border)] bg-accent/5">
          <LoadingProgress
            progress={refreshProgress}
            title="Refreshing prices"
            compact
          />
          <p className="mt-1.5 text-[10px] font-mono text-[var(--text-muted)]">
            Still working · not stuck
          </p>
        </div>
      )}
      <div
        className={`p-4 space-y-3 transition-opacity duration-200 ${
          refreshing ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <RarityBadge rarity={tradeUp.inputRarity} />
              <span className="text-[var(--text-muted)] text-[10px]">→</span>
              <RarityBadge rarity={tradeUp.outputRarity} />
            </div>
            {dateLabel && (
              <p className="text-[10px] text-[var(--text-muted)] font-mono opacity-70">
                {dateLabel}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {onRefresh && (
            <IconBtn
              onClick={onRefresh}
              disabled={refreshing}
              title={
                refreshing && refreshProgress
                  ? `Refreshing · ${refreshProgress.percent}%`
                  : "Refresh prices"
              }
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
                active={copied}
              >
                {copied ? (
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
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                ) : (
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
                      d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3V15"
                    />
                  </svg>
                )}
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
              onClick={() => onSave(withInsight())}
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

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="label mb-0">Inputs</p>
          <RarityBadge rarity={tradeUp.inputRarity} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {tradeUp.inputs.map((input, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-md border p-2 min-w-0"
              style={{
                borderColor: inputStyle.borderColor,
                backgroundColor: inputStyle.backgroundColor,
              }}
            >
              <SkinThumb
                src={input.image}
                alt={input.name}
                rarity={tradeUp.inputRarity}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-medium truncate min-w-0">
                    {input.count > 1 && (
                      <span className="text-accent font-mono">
                        {input.count}×{" "}
                      </span>
                    )}
                    {input.name}
                  </p>
                  <MarketLinks skinName={input.name} wear={input.wear} />
                </div>
                <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 truncate">
                  {input.wear} · {money(input.price)}
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

      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 p-3 bg-[var(--surface)] rounded-md border border-[var(--border)]">
          <Stat
            label="Win chance"
            value={`${tradeUp.winPct}%`}
            color={tradeUp.winPct >= 50 ? "var(--profit)" : undefined}
          />
          <Stat
            label="Avg profit"
            value={money(tradeUp.expectedProfit, { signed: true })}
            color={profitColor}
          />
          <Stat label="ROI" value={`${tradeUp.roi}%`} color={profitColor} />
          <Stat label="Cost" value={money(tradeUp.totalCost)} />
        </div>
      </div>

      <div className="border-t border-[var(--border)]">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-150"
        >
          <span className="flex items-center gap-2">
            OUTCOMES · {tradeUp.outcomes.length}
            <RarityBadge rarity={tradeUp.outputRarity} />
          </span>
          <span className="text-accent w-4 text-center">
            {expanded ? "−" : "+"}
          </span>
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-2">
            {tradeUp.outcomes.map((outcome, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 p-2 rounded-md border min-w-0"
                style={{
                  borderColor: outputStyle.borderColor,
                  backgroundColor: outputStyle.backgroundColor,
                }}
              >
                <SkinThumb
                  src={outcome.image}
                  alt={outcome.name}
                  rarity={tradeUp.outputRarity}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-medium truncate min-w-0">
                      {outcome.name}
                    </p>
                    <MarketLinks skinName={outcome.name} wear={outcome.wear} />
                  </div>
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
                    {money(outcome.profit, { signed: true })}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] tabular-nums">
                    {money(outcome.price)}
                  </p>
                </div>
              </div>
            ))}

            {!insight && (
              <button
                type="button"
                onClick={() => fetchInsight(false)}
                disabled={insightLoading}
                className="w-full mt-1 py-2.5 text-[11px] font-mono text-accent hover:text-accent-dim transition-colors duration-150 disabled:opacity-40 border border-[var(--border)] rounded-md"
              >
                {insightLoading ? "Loading…" : "Get AI analysis"}
              </button>
            )}
            {insight && (
              <div className="mt-1 p-3 bg-[var(--surface)] rounded-md border border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-accent">
                    AI analysis
                  </p>
                  <button
                    type="button"
                    onClick={() => fetchInsight(true)}
                    disabled={insightLoading}
                    className="text-[10px] font-mono text-[var(--text-muted)] hover:text-accent transition-colors duration-150 disabled:opacity-40"
                  >
                    {insightLoading ? "Loading…" : "New analysis"}
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {insight}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
