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

export const CURRENCIES: CurrencyDef[] = [
  { code: "USD", label: "US Dollar", symbol: "$", perUsd: 1, prefix: true },
  { code: "EUR", label: "Euro", symbol: "€", perUsd: 0.92, prefix: true },
  { code: "GBP", label: "British Pound", symbol: "£", perUsd: 0.79, prefix: true },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$", perUsd: 1.36, prefix: true },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", perUsd: 1.53, prefix: true },
  { code: "PLN", label: "Polish Złoty", symbol: "zł", perUsd: 3.95, prefix: false },
  { code: "BRL", label: "Brazilian Real", symbol: "R$", perUsd: 5.1, prefix: true },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥", perUsd: 7.25, prefix: true },
  { code: "TRY", label: "Turkish Lira", symbol: "₺", perUsd: 34.5, prefix: true },
  { code: "SEK", label: "Swedish Krona", symbol: "kr", perUsd: 10.5, prefix: false },
];

export const CURRENCY_STORAGE_KEY = "tradeup-gen-currency";
export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export function getCurrency(code: string | null | undefined): CurrencyDef {
  return (
    CURRENCIES.find((c) => c.code === code) ||
    CURRENCIES.find((c) => c.code === DEFAULT_CURRENCY)!
  );
}

/** Convert a USD market price into the selected display currency */
export function fromUsd(amountUsd: number, code: CurrencyCode): number {
  const c = getCurrency(code);
  return amountUsd * c.perUsd;
}

/** Convert a user-entered display amount back to USD for API filters */
export function toUsd(amountDisplay: number, code: CurrencyCode): number {
  const c = getCurrency(code);
  if (c.perUsd === 0) return amountDisplay;
  return amountDisplay / c.perUsd;
}

export function formatMoney(
  amountUsd: number,
  code: CurrencyCode,
  opts?: { signed?: boolean; digits?: number }
): string {
  const digits = opts?.digits ?? 2;
  const converted = fromUsd(amountUsd, code);
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
