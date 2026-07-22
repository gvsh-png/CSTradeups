import { unstable_cache } from "next/cache";
import type { CurrencyCode } from "./currency";
import { CURRENCIES } from "./currency";

/** Units of currency per 1 USD */
export type FxRates = Partial<Record<CurrencyCode, number>>;

const FX_CODES = CURRENCIES.map((c) => c.code).filter((c) => c !== "USD");

/** Static fallbacks when live FX is unavailable */
export function staticFxRates(): Record<CurrencyCode, number> {
  const out = {} as Record<CurrencyCode, number>;
  for (const c of CURRENCIES) out[c.code] = c.perUsd;
  return out;
}

async function fetchLiveFxRates(): Promise<FxRates> {
  const symbols = FX_CODES.join(",");
  // ECB daily rates — closer to Steam wallet display than a static table
  const res = await fetch(
    `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${symbols}`,
    { signal: AbortSignal.timeout(8_000), next: { revalidate: 86_400 } }
  );
  if (!res.ok) throw new Error(`FX ${res.status}`);
  const data = (await res.json()) as { rates?: Record<string, number> };
  const rates: FxRates = { USD: 1 };
  for (const code of FX_CODES) {
    const v = data.rates?.[code];
    if (typeof v === "number" && v > 0) rates[code] = v;
  }
  return rates;
}

const getCachedFx = unstable_cache(
  async (): Promise<FxRates> => {
    try {
      return await fetchLiveFxRates();
    } catch {
      return staticFxRates();
    }
  },
  ["fx-rates-usd-v1"],
  { revalidate: 86_400, tags: ["fx"] }
);

export async function getFxRates(): Promise<{
  rates: Record<CurrencyCode, number>;
  source: "live" | "static";
}> {
  const fallback = staticFxRates();
  try {
    const live = await getCachedFx();
    const merged = { ...fallback, ...live, USD: 1 };
    const hasLive = FX_CODES.some(
      (c) => live[c] != null && live[c] !== fallback[c]
    );
    return { rates: merged, source: hasLive ? "live" : "static" };
  } catch {
    return { rates: fallback, source: "static" };
  }
}
