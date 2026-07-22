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
  /** Dropped because Steam sold=0 and Skinport quantity=0 */
  deadMarkets: number;
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

/** Per-item market depth used to drop ghost / unlistable wears */
export interface MarketLiquidity {
  steamSold7: number;
  steamSold30: number;
  skinportQty: number;
}

/**
 * True when the wear can actually be bought somewhere:
 * at least one Steam sale in 7d/30d, or ≥1 Skinport listing.
 * Stale "safe" prices with zero sold and zero listings are excluded.
 */
export function hasBuyableLiquidity(liq: MarketLiquidity): boolean {
  return (
    liq.steamSold7 > 0 || liq.steamSold30 > 0 || liq.skinportQty > 0
  );
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

/**
 * Real Skinport book only. Never use `suggested_price` — Skinport invents
 * it with quantity=0 (e.g. Negev | CaliCamo WW suggested $529.56).
 */
export function resolveSkinportPrice(item: SkinportItem): number {
  if (item.median_price && item.median_price > 0) return r2(item.median_price);
  if (item.mean_price && item.mean_price > 0) return r2(item.mean_price);
  // min_price only when something is actually listed
  if (item.min_price && item.min_price > 0 && (item.quantity || 0) > 0) {
    return r2(item.min_price);
  }
  return 0;
}

/**
 * Merge anonymous price candidates, rejecting outliers.
 * Prefer the cluster around the median — never blindly take min/max.
 */
export function mergePriceCandidates(candidates: number[]): number {
  const valid = candidates.filter((p) => p > 0).sort((a, b) => a - b);
  if (!valid.length) return 0;
  if (valid.length === 1) return valid[0];

  if (valid.length === 2) {
    const [lo, hi] = valid;
    if (hi / lo > 2) {
      // Unknown sources — defer to caller; average is misleading on spikes
      return 0;
    }
    return r2((lo + hi) / 2);
  }

  const mid = median(valid);
  const filtered = valid.filter((p) => p >= mid * 0.45 && p <= mid * 2.2);
  if (!filtered.length) return mid;
  return median(filtered);
}

/**
 * Resolve SteamApis vs Skinport when they disagree.
 *
 * Uses each source's own wear ladder so a consistently-wrong low SteamApis
 * book (e.g. First Class ~$1) cannot veto a consistent Skinport ladder (~$50+).
 *
 * Extreme gaps without ladder support prefer the LOWER quote — preferring
 * higher previously locked in Skinport suggested ghosts ($529 vs $0.05).
 */
export function resolveSourceConflict(
  steamApis: number,
  skinport: number,
  steamApisSiblings: number[] = [],
  skinportSiblings: number[] = []
): { price: number; corrected: boolean } {
  const sa = steamApis > 0 ? steamApis : 0;
  const sp = skinport > 0 ? skinport : 0;

  if (sa > 0 && sp <= 0) return { price: sa, corrected: false };
  if (sp > 0 && sa <= 0) return { price: sp, corrected: false };
  if (sa <= 0 && sp <= 0) return { price: 0, corrected: false };

  const hi = Math.max(sa, sp);
  const lo = Math.min(sa, sp);
  if (hi / lo <= 2) {
    return { price: r2((sa + sp) / 2), corrected: false };
  }

  const saMid = median(steamApisSiblings.filter((p) => p > 0));
  const spMid = median(skinportSiblings.filter((p) => p > 0));

  // Solo spike vs that source's own siblings → take the other source
  if (sa === hi && saMid > 0 && sa > saMid * 2.5) {
    return { price: sp, corrected: true };
  }
  if (sp === hi && spMid > 0 && sp > spMid * 2.5) {
    return { price: sa, corrected: true };
  }

  // Two consistent ladders far apart → trust the higher book.
  // Underpriced SteamApis ladders create fake cheap inputs (First Class).
  if (saMid > 0 && spMid > 0) {
    if (spMid / saMid >= 2.5) return { price: sp, corrected: true };
    if (saMid / spMid >= 2.5) return { price: sa, corrected: true };
  }

  // Extreme disagreement without ladder support → prefer lower (ghost reject)
  if (hi / lo >= 5) {
    return { price: lo, corrected: true };
  }

  // Mild disagreement: SteamApis (closer to Steam / TradeUpSpy)
  return { price: sa, corrected: true };
}

async function fetchSteamApisPrices(): Promise<{
  prices: PriceMap;
  sold: Record<string, { sold7: number; sold30: number }>;
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
    const sold: Record<string, { sold7: number; sold30: number }> = {};
    let corrections = 0;

    for (const item of data.data as SteamApisItem[]) {
      const name = item.market_hash_name;
      if (!name) continue;

      const sold7 = item.prices?.sold?.last_7d || 0;
      const sold30 = item.prices?.sold?.last_30d || 0;
      sold[name] = { sold7, sold30 };

      const { price, corrected } = resolveSteamApisPrice(item);
      if (price > 0) {
        prices[name] = price;
        if (corrected) corrections++;
      }
    }

    return { prices, sold, corrections };
  } catch {
    return null;
  }
}

async function fetchSkinportPrices(): Promise<{
  prices: PriceMap;
  quantity: Record<string, number>;
} | null> {
  try {
    const res = await fetch(
      "https://api.skinport.com/v1/items?app_id=730&currency=USD&tradable=0",
      {
        headers: {
          "Accept-Encoding": "br",
          "User-Agent": "tradeupcsgo.net/1.0",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as SkinportItem[];
    if (!Array.isArray(data)) return null;

    const prices: PriceMap = {};
    const quantity: Record<string, number> = {};
    for (const item of data) {
      quantity[item.market_hash_name] = item.quantity || 0;
      const price = resolveSkinportPrice(item);
      if (price > 0) prices[item.market_hash_name] = price;
    }

    return { prices, quantity };
  } catch {
    return null;
  }
}

function skinBaseName(marketHashName: string): string {
  const idx = marketHashName.lastIndexOf(" (");
  return idx > 0 ? marketHashName.slice(0, idx) : marketHashName;
}

function mergeBulkSources(
  steamApis: PriceMap | null,
  skinport: PriceMap | null,
  steamApisCorrections: number,
  steamSold: Record<string, { sold7: number; sold30: number }> | null = null,
  skinportQty: Record<string, number> | null = null
): BulkPriceResult {
  const prices: PriceMap = {};
  const allKeys = new Set([
    ...Object.keys(steamApis || {}),
    ...Object.keys(skinport || {}),
  ]);

  let mergeCorrections = 0;
  let deadMarkets = 0;
  const deferred: string[] = [];

  const liquidityFor = (key: string): MarketLiquidity => ({
    steamSold7: steamSold?.[key]?.sold7 || 0,
    steamSold30: steamSold?.[key]?.sold30 || 0,
    skinportQty: skinportQty?.[key] || 0,
  });

  // Pass 1: agree / single-source keys — build wear context
  for (const key of allKeys) {
    const saRaw = steamApis?.[key] || 0;
    const spRaw = skinport?.[key] || 0;
    const liq = liquidityFor(key);

    // Source-specific liquidity: Steam sold unlocks Steam only;
    // Skinport quantity unlocks Skinport only. Never let Steam volume
    // validate a Skinport suggested ghost (or vice versa).
    const sa =
      saRaw > 0 && (liq.steamSold7 > 0 || liq.steamSold30 > 0) ? saRaw : 0;
    const sp = spRaw > 0 && liq.skinportQty > 0 ? spRaw : 0;

    if (sa <= 0 && sp <= 0) {
      if (saRaw > 0 || spRaw > 0) deadMarkets++;
      continue;
    }

    if (sa > 0 && sp > 0) {
      const hi = Math.max(sa, sp);
      const lo = Math.min(sa, sp);
      if (hi / lo > 2) {
        deferred.push(key);
        continue;
      }
      prices[key] = r2((sa + sp) / 2);
      continue;
    }

    if (sp > 0) {
      prices[key] = sp;
      continue;
    }

    // Steam-only: reject when liquid Skinport wears of the same skin are
    // an order of magnitude cheaper (AUG Colony BS Steam ~$2 vs Skinport FT ~$0.03).
    if (sa > 0) {
      const base = skinBaseName(key);
      const spPeers: number[] = [];
      for (const [k, p] of Object.entries(skinport || {})) {
        if (k === key || skinBaseName(k) !== base || !(p > 0)) continue;
        if ((skinportQty?.[k] || 0) <= 0) continue;
        spPeers.push(p);
      }
      const peerMid = median(spPeers);
      if (peerMid > 0 && sa > peerMid * 10) {
        deadMarkets++;
        continue;
      }
      prices[key] = sa;
    }
  }

  // Pass 2: disagreements — only liquid quotes on each side
  for (const key of deferred) {
    const liq = liquidityFor(key);
    const saRaw = steamApis?.[key] || 0;
    const spRaw = skinport?.[key] || 0;
    const sa =
      saRaw > 0 && (liq.steamSold7 > 0 || liq.steamSold30 > 0) ? saRaw : 0;
    const sp = spRaw > 0 && liq.skinportQty > 0 ? spRaw : 0;
    const base = skinBaseName(key);
    const saSiblings: number[] = [];
    const spSiblings: number[] = [];
    for (const [k, p] of Object.entries(steamApis || {})) {
      if (k !== key && skinBaseName(k) === base && p > 0) {
        const s = steamSold?.[k];
        if ((s?.sold7 || 0) > 0 || (s?.sold30 || 0) > 0) saSiblings.push(p);
      }
    }
    for (const [k, p] of Object.entries(skinport || {})) {
      if (k !== key && skinBaseName(k) === base && p > 0) {
        if ((skinportQty?.[k] || 0) > 0) spSiblings.push(p);
      }
    }
    const { price, corrected } = resolveSourceConflict(
      sa,
      sp,
      saSiblings,
      spSiblings
    );
    if (price > 0) {
      prices[key] = price;
      if (corrected) mergeCorrections++;
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
      deadMarkets,
    },
  };
}

/**
 * Internal fetch — called at most once per day via unstable_cache.
 * One SteamApis call + one Skinport call = 1 API request total (SteamApis).
 */
async function fetchFreshBulkPrices(): Promise<BulkPriceResult> {
  const [steamApisResult, skinportResult] = await Promise.all([
    fetchSteamApisPrices(),
    fetchSkinportPrices(),
  ]);

  const result = mergeBulkSources(
    steamApisResult?.prices ?? null,
    skinportResult?.prices ?? null,
    steamApisResult?.corrections ?? 0,
    steamApisResult?.sold ?? null,
    skinportResult?.quantity ?? null
  );

  return result;
}

/**
 * Daily shared price cache — all users share the same bulk price data.
 * Refreshes automatically after 24 hours on the next request.
 * v8: drop Skinport suggested ghosts; source-specific liquidity; prefer
 * lower on extreme gaps without ladder support.
 */
const getCachedBulkPrices = unstable_cache(
  async (): Promise<BulkPriceResult> => fetchFreshBulkPrices(),
  ["tradeup-bulk-prices-v8"],
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
