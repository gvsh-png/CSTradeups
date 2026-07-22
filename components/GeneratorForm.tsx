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
    targetWinChance: number;
    complexity: Complexity;
    feeType: "steam" | "csfloat";
    excludeUnstableCollections: boolean;
    customExcludedCollections: string[];
  }) => void;
  loading: boolean;
  settings: AppSettings;
  onOpenSettings: () => void;
  /** Centered hero layout (desktop Stitch) vs compact aside */
  variant?: "hero" | "compact";
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
        className={`input-field tabular-nums font-mono ${prefix ? "pl-7" : "pr-8"}`}
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
  variant = "compact",
}: GeneratorFormProps) {
  const progress = useSimulatedProgress(loading, "generate");
  const { toUsd, code } = useCurrency();
  const [minPrice, setMinPrice] = useState(5);
  const [maxPrice, setMaxPrice] = useState(200);
  const [targetWinChance, setTargetWinChance] = useState(60);
  const [complexity, setComplexity] = useState<Complexity>("standard");
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
    onGenerate({
      minPrice: toUsd(min),
      maxPrice: toUsd(Math.min(max, MAX_PRICE_DISPLAY)),
      targetWinChance,
      complexity,
      feeType,
      excludeUnstableCollections: excludeUnstable,
      customExcludedCollections: settings.customExcludedCollections,
    });
  };

  const customCount = settings.customExcludedCollections.length;
  const hero = variant === "hero";

  return (
    <form
      onSubmit={handleSubmit}
      className={`panel panel-desktop panel-glow relative overflow-hidden ${
        hero
          ? "scanner-hero flex flex-col p-3.5 sm:p-4 md:p-4 lg:p-5 md:min-h-full md:flex-1"
          : "p-4 lg:p-5"
      } ${hero ? "" : "lg:sticky lg:top-16"}`}
    >
      <div className="absolute top-0 inset-x-0 h-0.5 bg-secondary pointer-events-none" />

      <div
        className={`flex items-start justify-between gap-3 ${
          hero
            ? "mb-3 md:mb-3.5 text-center sm:text-left flex-col sm:flex-row sm:items-end"
            : "mb-5"
        }`}
      >
        <div className={`min-w-0 ${hero ? "w-full sm:flex-1" : ""}`}>
          {hero ? (
            <>
              <h1 className="text-xl sm:text-2xl lg:text-[1.75rem] font-bold tracking-tight text-[var(--text)]">
                Configure Scanner
              </h1>
              <p className="scanner-hero-sub text-xs sm:text-sm text-[var(--text-muted)] mt-1">
                Set parameters to calculate high-probability trade-ups
                {code !== "USD" && (
                  <span className="text-accent"> · shown in {code}</span>
                )}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight uppercase font-mono text-accent">
                  Configure Scanner
                </h2>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Scan filters
                {code !== "USD" && (
                  <span className="text-accent"> · {code}</span>
                )}
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="shrink-0 h-8 px-2.5 rounded border border-[var(--border)] text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] hover:text-accent hover:border-accent/30 transition-colors duration-150 self-end sm:self-auto"
          title="Settings"
        >
          settings{customCount > 0 ? ` (${customCount})` : ""}
        </button>
      </div>

      {/* Hero: 2-col then sell+exclude row; button pinned to bottom on md+ */}
      <div
        className={
          hero
            ? "flex flex-col flex-1 min-h-0 gap-3 md:gap-3.5"
            : "contents"
        }
      >
      <div
        className={
          hero
            ? "grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 flex-1 min-h-0"
            : "space-y-5"
        }
      >
        <div className={hero ? "space-y-3" : "space-y-4"}>
          <div className="space-y-2">
            <span className="label flex items-center gap-1.5">
              Financial targets
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border border-[var(--border)] bg-[var(--bg-deep)] p-2 sm:p-2.5 space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  Min price
                </label>
                <PriceInput
                  value={minPrice}
                  onChange={setMinPrice}
                  ariaLabel="Min price"
                  min={MIN_PRICE_DISPLAY}
                  max={MAX_PRICE_DISPLAY}
                />
              </div>
              <div className="rounded border border-[var(--border)] bg-[var(--bg-deep)] p-2 sm:p-2.5 space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  Max price
                </label>
                <PriceInput
                  value={maxPrice}
                  onChange={setMaxPrice}
                  ariaLabel="Max price"
                  min={MIN_PRICE_DISPLAY}
                  max={MAX_PRICE_DISPLAY}
                />
              </div>
            </div>
          </div>

          <div className="rounded border border-[var(--border)] bg-[var(--bg-deep)] p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
            <div className="flex justify-between items-end gap-2">
              <span className="label mb-0">Risk chance</span>
              <span className="text-base sm:text-lg font-mono text-accent tabular-nums leading-none">
                {targetWinChance}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={targetWinChance}
              onChange={(e) => setTargetWinChance(Number(e.target.value))}
              className="w-full"
              aria-label="Risk chance"
            />
            <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
              <span>Riskier</span>
              <span>Safer</span>
            </div>
          </div>
        </div>

        <div className={hero ? "space-y-3" : "space-y-4"}>
          <fieldset className="space-y-1.5 sm:space-y-2">
            <legend className="label mb-1">Contract type</legend>
            {COMPLEXITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-2.5 rounded border cursor-pointer transition-colors duration-150 ${
                  hero ? "p-1.5 sm:p-2" : "p-2.5"
                } ${
                  complexity === opt.value
                    ? "border-accent/45 bg-accent/5"
                    : "border-[var(--border)] hover:border-[var(--surface-highest)]"
                }`}
              >
                <input
                  type="radio"
                  name="complexity"
                  value={opt.value}
                  checked={complexity === opt.value}
                  onChange={() => setComplexity(opt.value)}
                  className="mt-0.5 shrink-0 accent-[var(--accent)]"
                />
                <div className="min-w-0">
                  <span className="text-sm font-medium">{opt.label}</span>
                  <p
                    className={`text-[11px] text-[var(--text-muted)] leading-snug mt-0.5 ${
                      hero ? "line-clamp-1" : ""
                    }`}
                  >
                    {opt.description}
                  </p>
                </div>
              </label>
            ))}
          </fieldset>

          {!hero && (
            <>
              <fieldset>
                <legend className="label mb-2">Sell on</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["csfloat", "steam"] as const).map((fee) => (
                    <button
                      key={fee}
                      type="button"
                      onClick={() => setFeeType(fee)}
                      className={`h-9 rounded text-xs font-medium border transition-colors duration-150 ${
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

              <div className="rounded border border-[var(--border)] bg-[var(--bg-deep)] p-3 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeUnstable}
                    onChange={(e) => setExcludeUnstable(e.target.checked)}
                    className="mt-0.5 shrink-0 accent-[var(--accent)]"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">
                      Exclude new collections
                    </span>
                    <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5">
                      Skip last {maxAgeDays} days
                      {unstableCount > 0 && (
                        <span className="text-accent">
                          {" "}
                          · {unstableCount} active
                        </span>
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
                    {showCollections ? "▾ hide list" : "▸ show excluded"}
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
                        <span className="opacity-60"> · {c.ageDays}d</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {hero && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <fieldset>
            <legend className="label mb-1.5">Sell on</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["csfloat", "steam"] as const).map((fee) => (
                <button
                  key={fee}
                  type="button"
                  onClick={() => setFeeType(fee)}
                  className={`h-8 rounded text-xs font-medium border transition-colors duration-150 ${
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

          <div className="rounded border border-[var(--border)] bg-[var(--bg-deep)] p-2 sm:p-2.5 space-y-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeUnstable}
                onChange={(e) => setExcludeUnstable(e.target.checked)}
                className="mt-0.5 shrink-0 accent-[var(--accent)]"
              />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium leading-tight">
                  Exclude new collections
                </span>
                <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5">
                  Skip last {maxAgeDays} days
                  {unstableCount > 0 && (
                    <span className="text-accent">
                      {" "}
                      · {unstableCount} active
                    </span>
                  )}
                  {unstableList.length > 0 && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowCollections(!showCollections);
                        }}
                        className="text-[10px] text-[var(--text-muted)] hover:text-accent transition-colors duration-150 font-mono"
                      >
                        {showCollections ? "hide" : "show excluded"}
                      </button>
                    </>
                  )}
                </p>
              </div>
            </label>
            {showCollections && (
              <ul className="max-h-16 overflow-y-auto scrollbar-thin space-y-1 pt-1.5 border-t border-[var(--border)]">
                {unstableList.map((c) => (
                  <li
                    key={c.key}
                    className="text-[10px] text-[var(--text-muted)] font-mono truncate"
                  >
                    {c.name}
                    <span className="opacity-60"> · {c.ageDays}d</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div
        className={`border-t border-[var(--border)] ${
          hero ? "mt-auto pt-3 md:pt-3.5" : "pt-5 mt-5"
        }`}
      >
        <button
          type="submit"
          disabled={loading}
          className={`tracking-wide ${
            hero
              ? "btn-secondary h-11 text-[13px] sm:text-[14px]"
              : "btn-primary h-12 text-[14px]"
          }`}
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
                <span className="tabular-nums font-mono">
                  Scanning · {progress.percent}%
                </span>
              </span>
              <span className="h-1 w-full max-w-[200px] overflow-hidden rounded-full bg-black/25">
                <span
                  className="block h-full rounded-full bg-current transition-[width] duration-150 ease-out"
                  style={{ width: `${Math.max(4, progress.percent)}%` }}
                />
              </span>
            </span>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="M20 20l-3-3" />
              </svg>
              Generate analysis
            </>
          )}
        </button>
      </div>
      </div>
    </form>
  );
}
