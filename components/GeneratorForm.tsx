"use client";

import { useState } from "react";
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
  }) => void;
  loading: boolean;
}

export default function GeneratorForm({ onGenerate, loading }: GeneratorFormProps) {
  const [minPrice, setMinPrice] = useState(5);
  const [maxPrice, setMaxPrice] = useState(200);
  const [targetRoi, setTargetRoi] = useState(5);
  const [complexity, setComplexity] = useState<Complexity>("simple");
  const [feeType, setFeeType] = useState<"steam" | "csfloat">("csfloat");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({ minPrice, maxPrice, targetRoi, complexity, feeType });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-raised border border-surface-border rounded-xl p-4 sm:p-5 space-y-5 lg:sticky lg:top-20"
    >
      <div>
        <h2 className="text-sm font-semibold mb-1">Generate Trade-Up</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Set your parameters and find profitable contracts
        </p>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-[var(--text-muted)]">
            Price Range ($)
          </span>
          <div className="flex items-center gap-2 mt-1.5">
            <input
              type="number"
              min={0}
              step={1}
              value={minPrice}
              onChange={(e) => setMinPrice(Number(e.target.value))}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="Min"
            />
            <span className="text-[var(--text-muted)] text-xs">to</span>
            <input
              type="number"
              min={1}
              step={1}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="Max"
            />
          </div>
        </label>

        <label className="block">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              Target ROI
            </span>
            <span className="text-sm font-mono text-accent">{targetRoi}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={targetRoi}
            onChange={(e) => setTargetRoi(Number(e.target.value))}
            className="w-full mt-2"
          />
        </label>

        <fieldset>
          <legend className="text-xs font-medium text-[var(--text-muted)] mb-2">
            Complexity
          </legend>
          <div className="space-y-2">
            {COMPLEXITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  complexity === opt.value
                    ? "border-accent bg-accent/5"
                    : "border-surface-border hover:border-surface-border/80"
                }`}
              >
                <input
                  type="radio"
                  name="complexity"
                  value={opt.value}
                  checked={complexity === opt.value}
                  onChange={() => setComplexity(opt.value)}
                  className="mt-0.5 accent-accent"
                />
                <div className="min-w-0">
                  <span className="text-sm font-medium">{opt.label}</span>
                  <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5">
                    {opt.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium text-[var(--text-muted)] mb-2">
            Sell On
          </legend>
          <div className="flex gap-2">
            {(["csfloat", "steam"] as const).map((fee) => (
              <button
                key={fee}
                type="button"
                onClick={() => setFeeType(fee)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  feeType === fee
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-surface-border text-[var(--text-muted)] hover:text-white"
                }`}
              >
                {fee === "csfloat" ? "CSFloat (2%)" : "Steam (13%)"}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Scanning markets...
          </span>
        ) : (
          "Find Trade-Ups"
        )}
      </button>
    </form>
  );
}
