"use client";

import { useEffect, useState } from "react";
import {
  COMPLEXITY_OPTIONS,
  type Complexity,
} from "@/lib/constants";
import type { AppSettings } from "@/lib/settings";
import {
  MAX_PRICE_DISPLAY,
  MIN_PRICE_DISPLAY,
} from "@/lib/currency";
import { useSimulatedProgress } from "@/hooks/useSimulatedProgress";
import { useCurrency } from "./CurrencyProvider";

interface GeneratorFormProps {
  onGenerate: (params: {
    minPrice: number;
    maxPrice: number;
    risk: number;
    complexity: Complexity;
    feeType: "steam" | "csfloat";
    excludeUnstableCollections: boolean;
    customExcludedCollections: string[];
  }) => void;
  loading: boolean;
  settings: AppSettings;
  onOpenSettings: () => void;
}

function PriceInput({
  value,
  onChange,
  ariaLabel,
  min,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  ariaLabel: string;
  min: number;
  max: number;
}) {
  const { symbol, currency } = useCurrency();
  const prefix = currency.prefix !== false;

  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="pointer-events-none absolute left-2.5 text-xs font-mono text-[var(--text-muted)]">
          {symbol}
        </span>
      )}
      <input
        type="number"
        min={min}
        max={max}
        step={0.1}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : min);
        }}
        className={`input-field tabular-nums ${prefix ? "pl-7" : "pr-8"}`}
        placeholder="0.0"
        aria-label={ariaLabel}
      />
      {!prefix && (
        <span className="pointer-events-none absolute right-2.5 text-xs font-mono text-[var(--text-muted)]">
          {symbol}
        </span>
      )}
    </div>
  );
}

export default function GeneratorForm({
  onGenerate,
  loading,
  settings,
  onOpenSettings,
}: GeneratorFormProps) {
  const progress = useSimulatedProgress(loading, "generate");
  const { toUsd, code } = useCurrency();
  const [minPrice, setMinPrice] = useState(5);
  const [maxPrice, setMaxPrice] = useState(200);
  const [risk, setRisk] = useState(60);
  const [complexity, setComplexity] = useState<Complexity>("simple");
  const [feeType, setFeeType] = useState<"steam" | "csfloat">("csfloat");
  const [excludeUnstable, setExcludeUnstable] = useState(true);
  const [unstableCount, setUnstableCount] = useState(0);
  const [showCollections, setShowCollections] = useState(false);
  const [unstableList, setUnstableList] = useState<
    { key: string; name: string; releaseDate: string; ageDays: number }[]
  >([]);
  const [maxAgeDays, setMaxAgeDays] = useState(30);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then((d) => {
        if (d.unstable) {
          setUnstableList(d.unstable);
          setUnstableCount(d.count);
          if (d.maxAgeDays) setMaxAgeDays(d.maxAgeDays);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const min = Math.max(MIN_PRICE_DISPLAY, minPrice || MIN_PRICE_DISPLAY);
    const max = Math.max(min, maxPrice || min);
    // API / market data are USD — convert display currency → USD
    onGenerate({
      minPrice: toUsd(min),
      maxPrice: toUsd(Math.min(max, MAX_PRICE_DISPLAY)),
      risk,
      complexity,
      feeType,
      excludeUnstableCollections: excludeUnstable,
      customExcludedCollections: settings.customExcludedCollections,
    });
  };

  const customCount = settings.customExcludedCollections.length;

  return (
    <form
      onSubmit={handleSubmit}
      className="panel panel-desktop p-4 lg:p-5 space-y-5 lg:sticky lg:top-[4.75rem]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight lg:text-[15px]">
            Parameters
          </h2>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Configure scan filters
            {code !== "USD" && (
              <span className="text-accent"> · shown in {code}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="shrink-0 h-8 px-2.5 rounded-md border border-[var(--border)] text-[10px] font-mono text-[var(--text-muted)] hover:text-accent hover:border-accent/30 transition-colors"
          title="Settings"
        >
          settings
          {customCount > 0 ? ` (${customCount})` : ""}
        </button>
      </div>

      <div className="space-y-4 lg:space-y-5">
        <div className="space-y-1.5">
          <span className="label">Price range</span>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <PriceInput
              value={minPrice}
              onChange={setMinPrice}
              ariaLabel="Min price"
              min={MIN_PRICE_DISPLAY}
              max={MAX_PRICE_DISPLAY}
            />
            <span className="text-[var(--text-muted)] text-xs font-mono">—</span>
            <PriceInput
              value={maxPrice}
              onChange={setMaxPrice}
              ariaLabel="Max price"
              min={MIN_PRICE_DISPLAY}
              max={MAX_PRICE_DISPLAY}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-baseline gap-2">
            <span className="label">Risk</span>
            <span className="text-sm font-mono text-accent tabular-nums">
              {risk}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={risk}
            onChange={(e) => setRisk(Number(e.target.value))}
            className="w-full"
            aria-label="Risk tolerance"
          />
          <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)]">
            <span>Safer</span>
            <span>Riskier</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] leading-snug">
            Targets ~{100 - risk}% win chance — higher risk shows lottery-style
            contracts, not only sure things
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="label mb-1">Complexity</legend>
          {COMPLEXITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-2.5 lg:p-3 rounded-md border cursor-pointer transition-colors duration-150 ${
                complexity === opt.value
                  ? "border-accent/40 bg-accent/5"
                  : "border-[var(--border)] hover:border-[var(--border)]/80"
              }`}
            >
              <input
                type="radio"
                name="complexity"
                value={opt.value}
                checked={complexity === opt.value}
                onChange={() => setComplexity(opt.value)}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0">
                <span className="text-sm font-medium">{opt.label}</span>
                <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5">
                  {opt.description}
                </p>
              </div>
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend className="label mb-2">Sell on</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["csfloat", "steam"] as const).map((fee) => (
              <button
                key={fee}
                type="button"
                onClick={() => setFeeType(fee)}
                className={`h-9 rounded-md text-xs font-medium border transition-colors duration-150 ${
                  feeType === fee
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {fee === "csfloat" ? "CSFloat · 2%" : "Steam · 13%"}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="border border-[var(--border)] rounded-md p-3 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeUnstable}
              onChange={(e) => setExcludeUnstable(e.target.checked)}
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium">Exclude new collections</span>
              <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5">
                Skip collections released in the last {maxAgeDays} days
                {unstableCount > 0 && (
                  <span className="text-accent"> · {unstableCount} active</span>
                )}
              </p>
            </div>
          </label>
          {unstableList.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCollections(!showCollections)}
              className="text-[10px] text-[var(--text-muted)] hover:text-accent transition-colors duration-150 font-mono"
            >
              {showCollections ? "▾ hide list" : "▸ show excluded collections"}
            </button>
          )}
          {showCollections && (
            <ul className="max-h-28 overflow-y-auto scrollbar-thin space-y-1 pt-2 border-t border-[var(--border)]">
              {unstableList.map((c) => (
                <li
                  key={c.key}
                  className="text-[10px] text-[var(--text-muted)] font-mono truncate"
                >
                  {c.name}
                  <span className="opacity-60">
                    {" "}
                    · {c.ageDays}d · +{maxAgeDays - c.ageDays}d left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary lg:py-3 lg:text-[13px] lg:tracking-wide"
        aria-busy={loading}
      >
        {loading ? (
          <span className="flex flex-col items-center justify-center gap-1.5 w-full py-0.5">
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="tabular-nums">
                Scanning · {progress.percent}%
              </span>
            </span>
            <span className="text-[10px] font-mono opacity-80 tabular-nums">
              {progress.remainingLabel}
            </span>
            <span className="h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-black/25">
              <span
                className="block h-full rounded-full bg-current transition-[width] duration-200 ease-out"
                style={{ width: `${Math.max(4, progress.percent)}%` }}
              />
            </span>
          </span>
        ) : (
          "Run scan"
        )}
      </button>
    </form>
  );
}
