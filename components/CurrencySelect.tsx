"use client";

import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { useCurrency } from "./CurrencyProvider";

/** Compact currency picker — sits left of auth/profile in the header */
export default function CurrencySelect() {
  const { code, setCode, symbol } = useCurrency();

  return (
    <label className="relative inline-flex h-8 items-center gap-1 rounded border border-[var(--border)] bg-[var(--bg-deep)] pl-2 pr-1 text-[11px] font-mono text-[var(--text-muted)] hover:border-accent/35 hover:text-[var(--text)] transition-colors duration-150">
      <span className="text-accent tabular-nums shrink-0" aria-hidden>
        {symbol}
      </span>
      <select
        value={code}
        onChange={(e) => setCode(e.target.value as CurrencyCode)}
        className="h-full max-w-[4.5rem] sm:max-w-[5.5rem] appearance-none bg-transparent pr-4 text-[11px] font-mono text-[var(--text)] outline-none cursor-pointer"
        aria-label="Display currency"
        title="Display currency (Steam USD prices, live FX conversion)"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code} className="bg-[var(--surface)]">
            {c.code}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-1.5 text-[9px] opacity-60"
        aria-hidden
      >
        ▾
      </span>
    </label>
  );
}
