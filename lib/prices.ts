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
  /** SteamApis feed outcome — quota means monthly API limit hit */
  steamApisStatus?:
    | "ok"
    | "missing_key"
    | "quota"
    | "timeout"
    | "error"
    | "skipped";
  skinportStatus?: "ok" | "timeout" | "error";
  /** True when serving last-known-good prices after a failed refresh */
  staleFallback?: boolean;
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
 * Pick Steam Market price from SteamApis data.
 * Prefer `min` (Steam "Starting at" / lowest listing) when the market is liquid —
 * that is what users see on steamcommunity.com/market.
 * Fall back to recent sale averages when min is missing or absurd.
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
  const listingMin = p.min || 0;
  const liquid = sold7 > 0 || sold30 > 0;

  let priceUSD = 0;
  let corrected = false;

  // Steam Market "Starting at" — primary when liquid and not a ghost stub
  if (listingMin > 0 && liquid) {
    const anchor = last7 || last30 || safe || latest || last90;
    // Reject absurd undercuts (<40% of recent market) — keep min otherwise
    if (!anchor || listingMin >= anchor * 0.4) {
      return {
        price: r2(listingMin),
        corrected: Boolean(anchor && listingMin < anchor * 0.95),
      };
    }
  }

  // Thin / unstable markets: trust longer windows over a spiked 7d print
  if (p.unstable || (sold7 > 0 && sold30 > 0 && sold7 < 3 && sold30 >= 10)) {
    priceUSD = last30 || last90 || safe || last7 || latest || listingMin;
    corrected = Boolean(last7 && priceUSD !== last7);
  } else if (last7 > 0 && last30 > 0) {
    const ratio = last7 / last30;
    if (ratio >= 0.55 && ratio <= 1.8) {
      priceUSD = last7;
    } else {
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
  } else if (latest > 0) {
    priceUSD = latest;
  } else {
    priceUSD = listingMin;
  }

  if (last30 > 0 && last90 > 0 && last30 / last90 > 2.5) {
    priceUSD = last90;
    corrected = true;
  }
  if (safe > 0 && priceUSD > safe * 3) {
    priceUSD = safe;
    corrected = true;
  }
  if (last90 > 0 && priceUSD > last90 * 3) {
    priceUSD = last90;
    corrected = true;
  }

  if (priceUSD <= 0) return { price: 0, corrected: false };

  return { price: r2(priceUSD), corrected };
}

/**
 * Real Skinport book only. Never use `suggested_price` — Skinport invents
 * it with quantity=0 (e.g. Negev | CaliCamo WW suggested $529.56).
 *
 * When median/mean are inflated by a lone sale spike but listings are still
 * cheap (P90 Blind Spot), prefer the live min listing.
 */
export function resolveSkinportPrice(item: SkinportItem): number {
  const qty = item.quantity || 0;
  const min = item.min_price && item.min_price > 0 && qty > 0 ? item.min_price : 0;
  const med = item.median_price && item.median_price > 0 ? item.median_price : 0;
  const mean = item.mean_price && item.mean_price > 0 ? item.mean_price : 0;

  // Median/mean dragged up by outlier sales → trust the live book.
  // 2× catches AXIA-style spikes (~$105 med vs ~$35–40 live BS min)
  // that the old 3× threshold left in place.
  if (min > 0 && med > min * 2) return r2(min);
  if (min > 0 && mean > min * 2) return r2(min);

  if (med > 0) return r2(med);
  if (mean > 0) return r2(mean);
  if (min > 0) return r2(min);
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
 * Steam Market is the source of truth — prefer SteamApis whenever liquid.
 * Skinport only wins when Steam is a clear solo spike vs its own wear ladder,
 * or when Steam's whole ladder is stuck far below a consistent Skinport book
 * (First Class underpricing).
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

  const saMid = median(steamApisSiblings.filter((p) => p > 0));
  const spMid = median(skinportSiblings.filter((p) => p > 0));

  // Solo Steam spike vs siblings → Skinport (rare)
  if (sa === hi && saMid > 0 && sa > saMid * 2.5) {
    return { price: sp, corrected: true };
  }

  // Steam ladder stuck far below Skinport → Skinport (First Class)
  if (saMid > 0 && spMid > 0 && spMid / saMid >= 2.5) {
    return { price: sp, corrected: true };
  }

  // Extreme Skinport ghost vs Steam → Steam
  if (hi / lo >= 5 && sa > 0) {
    return { price: sa, corrected: true };
  }

  // Default: Steam Market price
  return { price: sa, corrected: sa !== sp };
}

type FeedStatus =
  | "ok"
  | "missing_key"
  | "quota"
  | "timeout"
  | "error"
  | "skipped";

type SteamApisFetch = {
  prices: PriceMap | null;
  sold: Record<string, { sold7: number; sold30: number }> | null;
  corrections: number;
  status: FeedStatus;
};

type SkinportFetch = {
  prices: PriceMap | null;
  quantity: Record<string, number> | null;
  status: "ok" | "timeout" | "error";
};

/** Skip SteamApis for a while after quota / auth failures (per warm instance) */
let steamApisCooldownUntil = 0;

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "TimeoutError" ||
      err.name === "AbortError" ||
      /aborted|timeout/i.test(err.message))
  );
}

/**
 * Compact Steam book — much smaller/faster than the full catalog.
 *
 * IMPORTANT: SteamApis `min` is the historical *lowest sale*, NOT the Steam
 * Market "Starting at" listing. Using `min` made prices wildly wrong.
 * `safe` is SteamApis' outlier-filtered market price (what TradeUpSpy-style
 * tools use). We blend with `latest` when they're close for freshness.
 */
const STEAMAPIS_COMPACT_MS = 45_000;
const REDIS_STEAM_PRICES_KEY = "prices:steam-safe:v18";

async function fetchSteamApisCompact(
  compactValue: string
): Promise<Record<string, number> | null> {
  const apiKey = process.env.STEAMAPIS_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://api.steamapis.com/market/items/730?api_key=${apiKey}&format=compact&compact_value=${encodeURIComponent(compactValue)}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(STEAMAPIS_COMPACT_MS),
    }
  );

  if ([401, 402, 403, 429].includes(res.status)) {
    steamApisCooldownUntil = Date.now() + 60 * 60 * 1000;
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as Record<string, number | null>;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const out: Record<string, number> = {};
  for (const [name, raw] of Object.entries(data)) {
    if (!name || typeof raw !== "number" || !(raw > 0)) continue;
    out[name] = r2(raw);
  }
  return Object.keys(out).length >= 50 ? out : null;
}

async function fetchSteamApisPrices(): Promise<SteamApisFetch> {
  const apiKey = process.env.STEAMAPIS_API_KEY;
  if (!apiKey) {
    return { prices: null, sold: null, corrections: 0, status: "missing_key" };
  }
  if (Date.now() < steamApisCooldownUntil) {
    return { prices: null, sold: null, corrections: 0, status: "skipped" };
  }

  try {
    // `safe` = outlier-filtered Steam market price (NOT historical min sale)
    const safeMap = await fetchSteamApisCompact("safe");

    if (!safeMap) {
      return {
        prices: null,
        sold: null,
        corrections: 0,
        status: Date.now() < steamApisCooldownUntil ? "quota" : "error",
      };
    }

    const prices: PriceMap = {};
    const sold: Record<string, { sold7: number; sold30: number }> = {};

    for (const [name, price] of Object.entries(safeMap)) {
      prices[name] = price;
      sold[name] = { sold7: 1, sold30: 1 };
    }

    return { prices, sold, corrections: 0, status: "ok" };
  } catch (err) {
    return {
      prices: null,
      sold: null,
      corrections: 0,
      status: isAbortError(err) ? "timeout" : "error",
    };
  }
}

function redisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

async function loadSteamPricesFromRedis(): Promise<BulkPriceResult | null> {
  if (!redisConfigured()) return null;
  try {
    const { Redis } = await import("@upstash/redis");
    const raw = await Redis.fromEnv().get<BulkPriceResult>(REDIS_STEAM_PRICES_KEY);
    if (!raw?.prices || priceCount(raw.prices) < 50) return null;
    return {
      prices: raw.prices,
      meta: { ...raw.meta, fromCache: true },
    };
  } catch {
    return null;
  }
}

async function saveSteamPricesToRedis(result: BulkPriceResult): Promise<void> {
  if (!redisConfigured()) return;
  if (priceCount(result.prices) < 50) return;
  try {
    const { Redis } = await import("@upstash/redis");
    await Redis.fromEnv().set(REDIS_STEAM_PRICES_KEY, result, {
      ex: PRICE_CACHE_TTL,
    });
  } catch {
    /* value may exceed Upstash size limits — ignore */
  }
}

async function fetchSkinportPricesOnce(): Promise<SkinportFetch> {
  try {
    const res = await fetch(
      "https://api.skinport.com/v1/items?app_id=730&currency=USD&tradable=0",
      {
        headers: {
          "Accept-Encoding": "br",
          "User-Agent": "tradeupcsgo.net/1.0",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!res.ok) return { prices: null, quantity: null, status: "error" };

    const data = (await res.json()) as SkinportItem[];
    if (!Array.isArray(data)) {
      return { prices: null, quantity: null, status: "error" };
    }

    const prices: PriceMap = {};
    const quantity: Record<string, number> = {};
    for (const item of data) {
      quantity[item.market_hash_name] = item.quantity || 0;
      const price = resolveSkinportPrice(item);
      if (price > 0) prices[item.market_hash_name] = price;
    }

    return { prices, quantity, status: "ok" };
  } catch (err) {
    return {
      prices: null,
      quantity: null,
      status: isAbortError(err) ? "timeout" : "error",
    };
  }
}

async function fetchSkinportPrices(): Promise<SkinportFetch> {
  const first = await fetchSkinportPricesOnce();
  if (first.status === "ok" && first.prices && Object.keys(first.prices).length > 50) {
    return first;
  }
  // One quick retry — Skinport occasionally resets mid-transfer
  await new Promise((r) => setTimeout(r, 400));
  return fetchSkinportPricesOnce();
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
  skinportQty: Record<string, number> | null = null,
  feedStatus: {
    steamApisStatus: FeedStatus;
    skinportStatus: "ok" | "timeout" | "error";
  } = { steamApisStatus: "error", skinportStatus: "error" }
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
      // Steam-aligned: prefer SteamApis over Skinport when close
      prices[key] = sa;
      continue;
    }

    if (sp > 0) {
      prices[key] = sp;
      continue;
    }

    // Steam-only: reject when liquid Skinport wears of the same skin are
    // an order of magnitude cheaper (AUG Colony BS Steam ~$2 vs Skinport FT ~$0.03).
    // Skip this veto for Souvenir / ★ items — thin high-value books get false
    // kills from sparse Skinport stubs.
    if (sa > 0) {
      const base = skinBaseName(key);
      const isSpecialName =
        base.startsWith("Souvenir ") || base.startsWith("★ ");
      if (!isSpecialName) {
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
      steamApisStatus: feedStatus.steamApisStatus,
      skinportStatus: feedStatus.skinportStatus,
    },
  };
}

function priceCount(prices: PriceMap): number {
  return Object.values(prices).filter((p) => p > 0).length;
}

/**
 * Cold path must finish in a few seconds — never wait on Steam during a scan.
 * Skinport-first for scans; Steam compact enrich via warm + Redis.
 */
async function fetchFreshBulkPrices(opts?: {
  preferSteam?: boolean;
}): Promise<BulkPriceResult> {
  const preferSteam = Boolean(opts?.preferSteam);
  const skinportResult = await fetchSkinportPrices();
  const skinCount = Object.keys(skinportResult.prices || {}).length;

  if (
    !preferSteam &&
    skinportResult.status === "ok" &&
    skinCount >= 100
  ) {
    return mergeBulkSources(
      null,
      skinportResult.prices,
      0,
      null,
      skinportResult.quantity,
      {
        steamApisStatus: "skipped",
        skinportStatus: skinportResult.status,
      }
    );
  }

  // Steam compact "Starting at" + Skinport liquidity
  const steamApisResult = await fetchSteamApisPrices();
  const merged = mergeBulkSources(
    steamApisResult.prices,
    skinportResult.prices,
    steamApisResult.corrections,
    steamApisResult.sold,
    skinportResult.quantity,
    {
      steamApisStatus: steamApisResult.status,
      skinportStatus: skinportResult.status,
    }
  );

  if (
    priceCount(merged.prices) < 50 &&
    skinportResult.prices &&
    skinCount >= 50
  ) {
    return mergeBulkSources(
      null,
      skinportResult.prices,
      0,
      null,
      skinportResult.quantity,
      {
        steamApisStatus: steamApisResult.status,
        skinportStatus: skinportResult.status,
      }
    );
  }

  return merged;
}

/** Skinport-first shared cache — scan fallback only */
const getCachedBulkPrices = unstable_cache(
  async (): Promise<BulkPriceResult> => fetchFreshBulkPrices(),
  ["tradeup-bulk-prices-v18"],
  {
    revalidate: PRICE_CACHE_TTL,
    tags: ["prices"],
  }
);

/** Steam safe+latest enrich — warm prefetch / Redis fill */
const getCachedSteamPrices = unstable_cache(
  async (): Promise<BulkPriceResult> =>
    fetchFreshBulkPrices({ preferSteam: true }),
  ["tradeup-bulk-prices-steam-v18"],
  {
    revalidate: PRICE_CACHE_TTL,
    tags: ["prices"],
  }
);

/** Last successful book kept in memory for this warm serverless instance */
let lastGoodPrices: BulkPriceResult | null = null;

function isSteamSourced(meta: PriceMeta): boolean {
  return (
    meta.source === "steamapis" ||
    meta.source === "merged" ||
    meta.steamApisStatus === "ok"
  );
}

export async function getBulkPrices(opts?: {
  /** Prefer Steam-enriched cache (warm prefetch — compact SteamApis) */
  preferSteam?: boolean;
}): Promise<BulkPriceResult> {
  try {
    // Warm prefetch: fill Steam book + persist to Redis (await — must stick)
    if (opts?.preferSteam) {
      const steam = await getCachedSteamPrices();
      if (priceCount(steam.prices) >= 50 && isSteamSourced(steam.meta)) {
        lastGoodPrices = steam;
        await saveSteamPricesToRedis(steam);
        return {
          prices: steam.prices,
          meta: { ...steam.meta, fromCache: true },
        };
      }
    }

    // Redis Steam book FIRST — never let a Skinport memory stick forever
    const fromRedis = await loadSteamPricesFromRedis();
    if (fromRedis && isSteamSourced(fromRedis.meta)) {
      lastGoodPrices = fromRedis;
      return fromRedis;
    }

    // Memory only if it's already Steam-sourced
    if (
      lastGoodPrices &&
      priceCount(lastGoodPrices.prices) >= 50 &&
      isSteamSourced(lastGoodPrices.meta)
    ) {
      return {
        prices: lastGoodPrices.prices,
        meta: { ...lastGoodPrices.meta, fromCache: true },
      };
    }

    // Fallback: Skinport-first (fast) so scans still work
    const result = await getCachedBulkPrices();
    if (priceCount(result.prices) >= 50) {
      // Don't overwrite a Steam memory book with Skinport
      if (!lastGoodPrices || !isSteamSourced(lastGoodPrices.meta)) {
        lastGoodPrices = result;
      }
      return {
        prices: result.prices,
        meta: { ...result.meta, fromCache: true },
      };
    }
    if (lastGoodPrices && priceCount(lastGoodPrices.prices) >= 50) {
      return {
        prices: lastGoodPrices.prices,
        meta: {
          ...lastGoodPrices.meta,
          fromCache: true,
          staleFallback: true,
          steamApisStatus: result.meta.steamApisStatus,
          skinportStatus: result.meta.skinportStatus,
        },
      };
    }
    return {
      prices: result.prices,
      meta: { ...result.meta, fromCache: true },
    };
  } catch {
    if (lastGoodPrices && priceCount(lastGoodPrices.prices) >= 50) {
      return {
        prices: lastGoodPrices.prices,
        meta: {
          ...lastGoodPrices.meta,
          fromCache: true,
          staleFallback: true,
        },
      };
    }
    throw new Error("Price feeds unavailable");
  }
}

/** Human-readable reason when price book is too thin to scan */
export function pricesUnavailableMessage(meta: PriceMeta): string {
  if (meta.skinportStatus === "timeout" || meta.steamApisStatus === "timeout") {
    return "Price feeds timed out before enough market data loaded. Try again in a moment.";
  }
  if (meta.steamApisStatus === "quota" && meta.skinportStatus !== "ok") {
    return "SteamApis rejected the request and Skinport also failed. Check your SteamApis key, then retry.";
  }
  if (meta.steamApisStatus === "missing_key" && meta.skinportStatus !== "ok") {
    return "Skinport prices failed and no STEAMAPIS_API_KEY is set. Retry in a minute.";
  }
  return "Market price feeds are unavailable right now. Try again in a minute.";
}

export function getPrice(
  prices: PriceMap,
  skinName: string,
  wear: string
): number {
  const withWear = prices[`${skinName} (${wear})`] || 0;
  if (withWear > 0) return withWear;
  // Vanilla knives/gloves list on Steam without an exterior suffix
  if (skinName.startsWith("★ ") && !skinName.includes(" | ")) {
    return prices[skinName] || 0;
  }
  return 0;
}
