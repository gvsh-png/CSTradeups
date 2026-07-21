"use client";

import { useEffect, useState } from "react";
import {
  COMPLEXITY_OPTIONS,
  type Complexity,
} from "@/lib/constants";

interface GeneratorFormProps {
  onGenerate: (params: {
    minPrice: number;
    maxPrice: number;
    targetRoi: number;
    complexity: Complexity;
    feeType: "steam" | "csfloat";
    excludeUnstableCollections: boolean;
  }) => void;
  loading: boolean;
}

export default function GeneratorForm({ onGenerate, loading }: GeneratorFormProps) {
  const [minPrice, setMinPrice] = useState(5);
  const [maxPrice, setMaxPrice] = useState(200);
  const [targetRoi, setTargetRoi] = useState(5);
  const [complexity, setComplexity] = useState<Complexity>("simple");
  const [feeType, setFeeType] = useState<"steam" | "csfloat">("csfloat");
  const [excludeUnstable, setExcludeUnstable] = useState(true);
  const [unstableCount, setUnstableCount] = useState(0);
  const [showCollections, setShowCollections] = useState(false);
  const [unstableList, setUnstableList] = useState<
    { key: string; name: string; releaseDate: string; ageDays: number }[]
  >([]);
  const [maxAgeDays, setMaxAgeDays] = useState(90);

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
    onGenerate({
      minPrice,
      maxPrice,
      targetRoi,
      complexity,
      feeType,
      excludeUnstableCollections: excludeUnstable,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="panel p-4 sm:p-5 space-y-5 lg:sticky lg:top-[4.5rem] relative z-10"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Parameters</h2>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Configure scan filters
          </p>
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
      </div>

      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="label">Price range</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={1}
              value={minPrice}
              onChange={(e) => setMinPrice(Number(e.target.value))}
              className="input-field"
              placeholder="Min"
            />
            <span className="text-[var(--text-muted)] text-xs font-mono">—</span>
            <input
              type="number"
              min={1}
              step={1}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="input-field"
              placeholder="Max"
            />
          </div>
        </label>

        <label className="block space-y-2">
          <div className="flex justify-between items-center">
            <span className="label">Target ROI</span>
            <span className="text-sm font-mono text-accent tabular-nums">{targetRoi}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={targetRoi}
            onChange={(e) => setTargetRoi(Number(e.target.value))}
            className="w-full"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="label mb-2">Complexity</legend>
          {COMPLEXITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-2.5 rounded-md border cursor-pointer transition-colors duration-150 ${
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
                className="mt-0.5"
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

        <fieldset className="space-y-2">
          <legend className="label mb-2">Sell on</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["csfloat", "steam"] as const).map((fee) => (
              <button
                key={fee}
                type="button"
                onClick={() => setFeeType(fee)}
                className={`py-2 rounded-md text-xs font-medium border transition-colors duration-150 ${
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
              className="mt-0.5"
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
            <ul className="max-h-28 overflow-y-auto scrollbar-thin space-y-1 pt-1 border-t border-[var(--border-subtle)]">
              {unstableList.map((c) => (
                <li key={c.key} className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                  {c.name}
                  <span className="text-[var(--text-muted)]/60">
                    {" "}
                    · {c.ageDays}d old · expires in {maxAgeDays - c.ageDays}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Scanning
          </span>
        ) : (
          "Run scan"
        )}
      </button>
    </form>
  );
}
