import { unstable_cache } from "next/cache";
import { r2 } from "./tradeup/float";
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

/** True arithmetic median (averages the two middle values when even). */
export function median(nums: number[]): number {
  const valid = nums.filter((n) => n > 0).sort((a, b) => a - b);
  if (!valid.length) return 0;
  const mid = Math.floor(valid.length / 2);
  if (valid.length % 2 === 0) {
    return r2((valid[mid - 1] + valid[mid]) / 2);
  }
  return valid[mid];
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
  const last90 = ts.last_90d || 0;
  const latest = p.latest || 0;
  const safe = p.safe || 0;
  const sold7 = p.sold?.last_7d || 0;
  const sold30 = p.sold?.last_30d || 0;

  let priceUSD = 0;
  let corrected = false;

  // Thin / unstable markets: trust longer windows over a spiked 7d print
  if (p.unstable || (sold7 > 0 && sold30 > 0 && sold7 < 3 && sold30 >= 10)) {
    priceUSD = last30 || last90 || safe || last7 || latest;
    corrected = Boolean(last7 && priceUSD !== last7);
  } else if (last7 > 0 && last30 > 0) {
    const ratio = last7 / last30;
    if (ratio >= 0.55 && ratio <= 1.8) {
      priceUSD = last7;
    } else {
      // Prefer the more stable 30d when 7d spiked or collapsed
      priceUSD = last30;
      corrected = true;
    }
  } else if (last7 > 0) {
    const anchor = last90 || safe || last30;
    if (anchor > 0 && (last7 / anchor < 0.4 || last7 / anchor > 2.5)) {
      priceUSD = anchor;
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
 * On large 2-way disagreement, prefers the lower (safer for trade-up EV).
 */
export function mergePriceCandidates(candidates: number[]): number {
  const valid = candidates.filter((p) => p > 0).sort((a, b) => a - b);
  if (!valid.length) return 0;
  if (valid.length === 1) return valid[0];

  if (valid.length === 2) {
    const [lo, hi] = valid;
    if (hi / lo > 2) {
      // e.g. Skinport $6 vs SteamApis $57 — keep the realistic lower print
      return lo;
    }
    return r2((lo + hi) / 2);
  }

  const mid = median(valid);
  const filtered = valid.filter((p) => p >= mid * 0.45 && p <= mid * 2.2);
  if (!filtered.length) return mid;
  return median(filtered);
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
    const sa = steamApis?.[key] || 0;
    const sp = skinport?.[key] || 0;

    if (sa > 0 && sp > 0) {
      const hi = Math.max(sa, sp);
      const lo = Math.min(sa, sp);
      if (hi / lo > 2) {
        // Skinport reflects live listings; SteamApis safe_ts can spike on thin volume
        // Prefer Skinport when present, otherwise the lower print.
        prices[key] = sp;
        mergeCorrections++;
        continue;
      }
      prices[key] = r2((sa + sp) / 2);
      continue;
    }

    const merged = mergePriceCandidates([sa, sp].filter((p) => p > 0));
    if (merged > 0) prices[key] = merged;
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
  ["tradeup-bulk-prices-v2"],
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
