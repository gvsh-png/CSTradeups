import { parsePrice, r2 } from "./tradeup/float";
import type { PriceMap } from "./tradeup/types";

export interface PriceMeta {
  source: "steamapis" | "skinport" | "steam" | "merged";
  fetchedAt: string;
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

const priceCache = new Map<string, { price: number; fetchedAt: number }>();
const CACHE_TTL = 10 * 60 * 1000;

let bulkCache: {
  prices: PriceMap;
  meta: PriceMeta;
  fetchedAt: number;
} | null = null;

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
      { next: { revalidate: 600 } }
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
        next: { revalidate: 300 },
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

async function fetchSteamMedianPrice(
  marketHashName: string
): Promise<number> {
  const cached = priceCache.get(marketHashName);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.price;
  }

  try {
    const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(marketHashName)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TradeUpGen/1.0)" },
      next: { revalidate: 600 },
    });

    if (!res.ok) return cached?.price ?? 0;
    const data = await res.json();
    if (!data.success) return cached?.price ?? 0;

    const median = parsePrice(data.median_price || "0");
    const lowest = parsePrice(data.lowest_price || "0");

    const price = mergePriceCandidates(
      median > 0 ? [median, lowest] : lowest > 0 ? [lowest] : []
    );

    if (price > 0) {
      priceCache.set(marketHashName, { price, fetchedAt: Date.now() });
    }
    return price;
  } catch {
    return cached?.price ?? 0;
  }
}

function mergeBulkSources(
  steamApis: PriceMap | null,
  skinport: PriceMap | null
): { prices: PriceMap; meta: PriceMeta } {
  const prices: PriceMap = {};
  const allKeys = new Set([
    ...Object.keys(steamApis || {}),
    ...Object.keys(skinport || {}),
  ]);

  let corrections = 0;

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
        corrections++;
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

  return {
    prices,
    meta: {
      source,
      fetchedAt: new Date().toISOString(),
      steamApisCount: Object.keys(steamApis || {}).length,
      skinportCount: Object.keys(skinport || {}).length,
      corrections,
    },
  };
}

export async function getBulkPrices(): Promise<{
  prices: PriceMap;
  meta: PriceMeta;
}> {
  if (bulkCache && Date.now() - bulkCache.fetchedAt < CACHE_TTL) {
    return { prices: bulkCache.prices, meta: bulkCache.meta };
  }

  const [steamApisResult, skinport] = await Promise.all([
    fetchSteamApisPrices(),
    fetchSkinportPrices(),
  ]);

  const steamApis = steamApisResult?.prices ?? null;
  const { prices, meta } = mergeBulkSources(steamApis, skinport);

  if (steamApisResult) {
    meta.corrections += steamApisResult.corrections;
  }

  if (Object.keys(prices).length > 0) {
    bulkCache = {
      prices,
      meta,
      fetchedAt: Date.now(),
    };
  }

  return {
    prices: bulkCache?.prices ?? prices,
    meta: bulkCache?.meta ?? meta,
  };
}

export async function fetchPricesForItems(
  marketHashNames: string[],
  maxFetches = 100
): Promise<PriceMap> {
  const { prices: bulk } = await getBulkPrices();
  const prices: PriceMap = { ...bulk };

  const missing = marketHashNames
    .filter((n) => !prices[n] || prices[n] <= 0)
    .slice(0, maxFetches);

  const batchSize = 4;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (name) => {
        const price = await fetchSteamMedianPrice(name);
        return { name, price };
      })
    );
    for (const { name, price } of results) {
      if (price > 0) prices[name] = price;
    }
    if (i + batchSize < missing.length) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return prices;
}

export function getPrice(
  prices: PriceMap,
  skinName: string,
  wear: string
): number {
  return prices[`${skinName} (${wear})`] || 0;
}
