"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CURRENCY_STORAGE_KEY,
  DEFAULT_CURRENCY,
  formatMoney,
  fromUsd,
  getCurrency,
  toUsd,
  type CurrencyCode,
  type CurrencyDef,
} from "@/lib/currency";

type Rates = Partial<Record<CurrencyCode, number>>;

type CurrencyContextValue = {
  code: CurrencyCode;
  currency: CurrencyDef;
  setCode: (code: CurrencyCode) => void;
  /** Format a USD amount in the active currency */
  money: (amountUsd: number, opts?: { signed?: boolean; digits?: number }) => string;
  /** Convert USD → display */
  fromUsd: (amountUsd: number) => number;
  /** Convert display → USD */
  toUsd: (amountDisplay: number) => number;
  symbol: string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCodeState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<Rates | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (raw) {
        const c = getCurrency(raw);
        setCodeState(c.code);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  // Live FX so €/kr match Steam wallet display (not a stale static table)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/fx")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.rates || typeof d.rates !== "object") return;
        setRates(d.rates as Rates);
      })
      .catch(() => {
        /* keep static fallbacks */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setCode = useCallback((next: CurrencyCode) => {
    setCodeState(next);
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const currency = useMemo(() => getCurrency(code), [code]);
  const rateOpts = rates || undefined;

  const value = useMemo<CurrencyContextValue>(
    () => ({
      code,
      currency,
      setCode,
      money: (amountUsd, opts) =>
        formatMoney(amountUsd, code, { ...opts, rates: rateOpts }),
      fromUsd: (n) => fromUsd(n, code, rateOpts),
      toUsd: (n) => toUsd(n, code, rateOpts),
      symbol: currency.symbol,
    }),
    [code, currency, setCode, rateOpts]
  );

  // Avoid hydration mismatch flashing wrong currency
  if (!ready) {
    return (
      <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
    );
  }

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
