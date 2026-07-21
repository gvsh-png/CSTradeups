import { unstable_cache } from "next/cache";
import { parsePrice, r2 } from "./tradeup/float";
import type { PriceMap } from "./tradeup/types";

/** Shared price cache TTL — one bulk scan per day for all users */
export const PRICE_CACHE_TTL = 86_400; // 24 hours in seconds

export interface PriceMeta {
  source: "steamapis" | "skinport" | "steam" | "merged";
  fetchedAt: string;
  cachedUntil: string;
  fromCache: boolean;
  steamApisCount: number;
  skinportCount: number;
  corrections: number;
}

interface SteamApisItem {
  market_hash_name?: string;
  prices?: {
    safe?: number;
    latest?: number;
    min?: number;
    safe_ts?: {
      last_7d?: number;
      last_30d?: number;
      last_90d?: number;
    };
    unstable?: boolean;
    sold?: {
      last_7d?: number;
      last_30d?: number;
    };
  };
}

interface SkinportItem {
  market_hash_name: string;
  min_price: number | null;
  median_price: number | null;
  mean_price: number | null;
  suggested_price: number | null;
  quantity: number;
}

export interface BulkPriceResult {
  prices: PriceMap;
  meta: PriceMeta;
}

/**
 * Pick the best price from SteamApis data, rejecting outlier sales.
 * Uses recent average sale prices, NOT lowest listings.
 */
export function resolveSteamApisPrice(item: SteamApisItem): {
  price: number;
  corrected: boolean;
} {
  const p = item.prices;
  if (!p) return { price: 0, corrected: false };

  const ts = p.safe_ts || {};
  const last7 = ts.last_7d || 0;
  const last30 = ts.last_30d || 0;
  const last90 = ts.last_90d || p.safe || 0;
  const latest = p.latest || 0;
  const safe = p.safe || 0;

  let priceUSD = 0;
  let corrected = false;

  if (last7 > 0 && last30 > 0) {
    const ratio = last7 / last30;
    if (ratio >= 0.5 && ratio <= 2.0) {
      priceUSD = last7;
    } else {
      priceUSD = last30;
      corrected = true;
    }
  } else if (last7 > 0) {
    if (last90 > 0 && (last7 / last90 < 0.3 || last7 / last90 > 3.0)) {
      priceUSD = last90;
      corrected = true;
    } else if (last30 > 0 && (last7 / last30 < 0.3 || last7 / last30 > 3.0)) {
      priceUSD = last30;
      corrected = true;
    } else {
      priceUSD = last7;
    }
  } else if (last30 > 0) {
    priceUSD = last30;
  } else if (safe > 0) {
    priceUSD = safe;
  } else if (last90 > 0) {
    priceUSD = last90;
  } else {
    priceUSD = latest;
  }

  if (priceUSD <= 0) return { price: 0, corrected: false };

  return { price: r2(priceUSD), corrected };
}

function resolveSkinportPrice(item: SkinportItem): number {
  if (item.median_price && item.median_price > 0) return r2(item.median_price);
  if (item.mean_price && item.mean_price > 0) return r2(item.mean_price);
  if (item.suggested_price && item.suggested_price > 0)
    return r2(item.suggested_price);
  if (item.min_price && item.min_price > 0) return r2(item.min_price);
  return 0;
}

/**
 * Merge multiple price candidates, rejecting outliers.
 * Uses median of valid candidates (not minimum).
 */
export function mergePriceCandidates(candidates: number[]): number {
  const valid = candidates.filter((p) => p > 0);
  if (!valid.length) return 0;
  if (valid.length === 1) return valid[0];

  const sorted = [...valid].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];

  const filtered = sorted.filter((p) => p >= mid * 0.2 && p <= mid * 5);
  if (!filtered.length) return mid;

  filtered.sort((a, b) => a - b);
  return r2(filtered[Math.floor(filtered.length / 2)]);
}

async function fetchSteamApisPrices(): Promise<{
  prices: PriceMap;
  corrections: number;
} | null> {
  const apiKey = process.env.STEAMAPIS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.steamapis.com/market/items/730?api_key=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.data) return null;

    const prices: PriceMap = {};
    let corrections = 0;

    for (const item of data.data as SteamApisItem[]) {
      const name = item.market_hash_name;
      if (!name) continue;

      const { price, corrected } = resolveSteamApisPrice(item);
      if (price > 0) {
        prices[name] = price;
        if (corrected) corrections++;
      }
    }

    return { prices, corrections };
  } catch {
    return null;
  }
}

async function fetchSkinportPrices(): Promise<PriceMap | null> {
  try {
    const res = await fetch(
      "https://api.skinport.com/v1/items?app_id=730&currency=USD&tradable=0",
      {
        headers: {
          "Accept-Encoding": "br",
          "User-Agent": "TradeUpGen/1.0",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as SkinportItem[];
    if (!Array.isArray(data)) return null;

    const prices: PriceMap = {};
    for (const item of data) {
      const price = resolveSkinportPrice(item);
      if (price > 0) prices[item.market_hash_name] = price;
    }

    return prices;
  } catch {
    return null;
  }
}

function mergeBulkSources(
  steamApis: PriceMap | null,
  skinport: PriceMap | null,
  steamApisCorrections: number
): BulkPriceResult {
  const prices: PriceMap = {};
  const allKeys = new Set([
    ...Object.keys(steamApis || {}),
    ...Object.keys(skinport || {}),
  ]);

  let mergeCorrections = 0;

  for (const key of allKeys) {
    const candidates: number[] = [];
    if (steamApis?.[key]) candidates.push(steamApis[key]);
    if (skinport?.[key]) candidates.push(skinport[key]);

    const merged = mergePriceCandidates(candidates);
    if (merged > 0) {
      if (
        candidates.length > 1 &&
        Math.max(...candidates) / Math.min(...candidates) > 2
      ) {
        mergeCorrections++;
      }
      prices[key] = merged;
    }
  }

  const source: PriceMeta["source"] =
    steamApis && skinport
      ? "merged"
      : steamApis
        ? "steamapis"
        : skinport
          ? "skinport"
          : "steam";

  const fetchedAt = new Date();
  const cachedUntil = new Date(fetchedAt.getTime() + PRICE_CACHE_TTL * 1000);

  return {
    prices,
    meta: {
      source,
      fetchedAt: fetchedAt.toISOString(),
      cachedUntil: cachedUntil.toISOString(),
      fromCache: false,
      steamApisCount: Object.keys(steamApis || {}).length,
      skinportCount: Object.keys(skinport || {}).length,
      corrections: steamApisCorrections + mergeCorrections,
    },
  };
}

/**
 * Internal fetch — called at most once per day via unstable_cache.
 * One SteamApis call + one Skinport call = 1 API request total (SteamApis).
 */
async function fetchFreshBulkPrices(): Promise<BulkPriceResult> {
  const [steamApisResult, skinport] = await Promise.all([
    fetchSteamApisPrices(),
    fetchSkinportPrices(),
  ]);

  const result = mergeBulkSources(
    steamApisResult?.prices ?? null,
    skinport,
    steamApisResult?.corrections ?? 0
  );

  return result;
}

/**
 * Daily shared price cache — all users share the same bulk price data.
 * Refreshes automatically after 24 hours on the next request.
 */
const getCachedBulkPrices = unstable_cache(
  async (): Promise<BulkPriceResult> => fetchFreshBulkPrices(),
  ["tradeup-bulk-prices"],
  {
    revalidate: PRICE_CACHE_TTL,
    tags: ["prices"],
  }
);

export async function getBulkPrices(): Promise<BulkPriceResult> {
  const result = await getCachedBulkPrices();
  return {
    prices: result.prices,
    meta: {
      ...result.meta,
      fromCache: true,
    },
  };
}

export function getPrice(
  prices: PriceMap,
  skinName: string,
  wear: string
): number {
  return prices[`${skinName} (${wear})`] || 0;
}
