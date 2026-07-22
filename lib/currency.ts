/** Display currencies — market prices are sourced in USD and converted for UI */

export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "CAD"
  | "AUD"
  | "PLN"
  | "BRL"
  | "CNY"
  | "TRY"
  | "SEK";

export type CurrencyDef = {
  code: CurrencyCode;
  label: string;
  /** Symbol shown next to amounts */
  symbol: string;
  /** Approx. units of this currency per 1 USD (display conversion) */
  perUsd: number;
  /** Symbol before the number (false → after, e.g. zł) */
  prefix?: boolean;
};

/** Static fallbacks — live rates from /api/fx override these when available */
export const CURRENCIES: CurrencyDef[] = [
  { code: "USD", label: "US Dollar", symbol: "$", perUsd: 1, prefix: true },
  { code: "EUR", label: "Euro", symbol: "€", perUsd: 0.88, prefix: true },
  { code: "GBP", label: "British Pound", symbol: "£", perUsd: 0.75, prefix: true },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$", perUsd: 1.37, prefix: true },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", perUsd: 1.52, prefix: true },
  { code: "PLN", label: "Polish Złoty", symbol: "zł", perUsd: 3.65, prefix: false },
  { code: "BRL", label: "Brazilian Real", symbol: "R$", perUsd: 5.5, prefix: true },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥", perUsd: 7.2, prefix: true },
  { code: "TRY", label: "Turkish Lira", symbol: "₺", perUsd: 40, prefix: true },
  { code: "SEK", label: "Swedish Krona", symbol: "kr", perUsd: 9.7, prefix: false },
];

export const CURRENCY_STORAGE_KEY = "tradeup-gen-currency";
export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export function getCurrency(code: string | null | undefined): CurrencyDef {
  return (
    CURRENCIES.find((c) => c.code === code) ||
    CURRENCIES.find((c) => c.code === DEFAULT_CURRENCY)!
  );
}

/** Units of `code` per 1 USD — live FX override or static table */
export function perUsdFor(
  code: CurrencyCode,
  rates?: Partial<Record<CurrencyCode, number>>
): number {
  const live = rates?.[code];
  if (typeof live === "number" && live > 0) return live;
  return getCurrency(code).perUsd;
}

/** Convert a USD market price into the selected display currency */
export function fromUsd(
  amountUsd: number,
  code: CurrencyCode,
  rates?: Partial<Record<CurrencyCode, number>>
): number {
  return amountUsd * perUsdFor(code, rates);
}

/** Convert a user-entered display amount back to USD for API filters */
export function toUsd(
  amountDisplay: number,
  code: CurrencyCode,
  rates?: Partial<Record<CurrencyCode, number>>
): number {
  const per = perUsdFor(code, rates);
  if (per === 0) return amountDisplay;
  return amountDisplay / per;
}

export function formatMoney(
  amountUsd: number,
  code: CurrencyCode,
  opts?: {
    signed?: boolean;
    digits?: number;
    rates?: Partial<Record<CurrencyCode, number>>;
  }
): string {
  const digits = opts?.digits ?? 2;
  const converted = fromUsd(amountUsd, code, opts?.rates);
  const c = getCurrency(code);
  const abs = Math.abs(converted).toFixed(digits);
  const sign =
    opts?.signed && converted > 0 ? "+" : converted < 0 ? "-" : "";

  if (c.prefix !== false) {
    return `${sign}${c.symbol}${abs}`;
  }
  return `${sign}${abs} ${c.symbol}`;
}

/** Format an amount already in the display currency (e.g. form inputs) */
export function formatDisplayAmount(
  amount: number,
  code: CurrencyCode,
  digits = 2
): string {
  const c = getCurrency(code);
  const abs = Math.abs(amount).toFixed(digits);
  const neg = amount < 0 ? "-" : "";
  if (c.prefix !== false) return `${neg}${c.symbol}${abs}`;
  return `${neg}${abs} ${c.symbol}`;
}

export const MIN_PRICE_DISPLAY = 0.1;
export const MAX_PRICE_DISPLAY = 1_000_000;
