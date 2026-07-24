import { r2 } from "./tradeup/float";
import type { PriceMap, TradeUpResult } from "./tradeup/types";

/** Steam Market priceoverview — live "Starting at" (lowest listing) */
const STEAM_PRICE_URL =
  "https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=";

/** Cap live lookups so generate stays inside the route budget */
export const STEAM_LIVE_MAX_NAMES = 64;
const STEAM_LIVE_CONCURRENCY = 2;
const STEAM_LIVE_GAP_MS = 200;
const STEAM_LIVE_RETRIES = 3;
const STEAM_LIVE_CACHE_MS = 45_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse Steam USD strings like `$0.77` or `$1,234.56` */
export function parseSteamUsdPrice(raw: string | undefined | null): number {
  if (!raw || typeof raw !== "string") return 0;
  const cleaned = raw.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  return n > 0 ? r2(n) : 0;
}

export function marketHashFromParts(name: string, wear: string): string {
  if (name.startsWith("★ ") && !name.includes(" | ")) return name;
  return `${name} (${wear})`;
}

/** Unique market hash names used by one or more blueprints */
export function collectTradeUpMarketNames(
  tradeUps: TradeUpResult[],
  limit = STEAM_LIVE_MAX_NAMES
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const tu of tradeUps) {
    for (const input of tu.inputs || []) {
      const key = marketHashFromParts(input.name, input.wear);
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(key);
      if (names.length >= limit) return names;
    }
    for (const out of tu.outcomes || []) {
      const key = marketHashFromParts(out.name, out.wear);
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(key);
      if (names.length >= limit) return names;
    }
  }
  return names;
}

type SteamOverview = {
  success?: boolean;
  lowest_price?: string;
  median_price?: string;
  volume?: string;
};

type CacheEntry = { price: number; at: number };
const liveCache = new Map<string, CacheEntry>();

function cacheGet(name: string): number {
  const hit = liveCache.get(name);
  if (!hit) return 0;
  if (Date.now() - hit.at > STEAM_LIVE_CACHE_MS) {
    liveCache.delete(name);
    return 0;
  }
  return hit.price;
}

function cacheSet(name: string, price: number): void {
  if (!(price > 0)) return;
  liveCache.set(name, { price, at: Date.now() });
}

/**
 * One Steam Starting-at lookup. Only `lowest_price` — never median
 * (median ≠ what Steam shows as Starting at).
 */
async function fetchOneSteamStartingAt(
  marketHashName: string
): Promise<number> {
  const cached = cacheGet(marketHashName);
  if (cached > 0) return cached;

  for (let attempt = 0; attempt < STEAM_LIVE_RETRIES; attempt++) {
    try {
      const res = await fetch(
        STEAM_PRICE_URL + encodeURIComponent(marketHashName),
        {
          cache: "no-store",
          headers: {
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": "Mozilla/5.0 (compatible; tradeupcsgo.net/1.0)",
          },
          signal: AbortSignal.timeout(10_000),
        }
      );
      if (res.status === 429) {
        await sleep(400 * (attempt + 1) * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        await sleep(200 * (attempt + 1));
        continue;
      }
      const data = (await res.json()) as SteamOverview;
      if (!data?.success) return 0;
      const lowest = parseSteamUsdPrice(data.lowest_price);
      if (lowest > 0) {
        cacheSet(marketHashName, lowest);
        return lowest;
      }
      // No listing → not Starting at; don't invent from median
      return 0;
    } catch {
      await sleep(250 * (attempt + 1));
    }
  }
  return 0;
}

export type SteamLiveResult = {
  prices: PriceMap;
  fetched: number;
  failed: number;
  missing: string[];
};

/**
 * Live Steam Market Starting-at for blueprint skins only.
 * Optional maxMs hard budget so callers never hang the scan.
 */
export async function fetchSteamStartingAtPrices(
  marketHashNames: string[],
  opts?: { maxMs?: number }
): Promise<SteamLiveResult> {
  const budgetMs = opts?.maxMs ?? 25_000;
  const started = Date.now();
  const timeLeft = () => budgetMs - (Date.now() - started);

  const unique = [...new Set(marketHashNames.filter(Boolean))].slice(
    0,
    STEAM_LIVE_MAX_NAMES
  );
  const prices: PriceMap = {};
  const missing: string[] = [];
  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < unique.length; i += STEAM_LIVE_CONCURRENCY) {
    if (timeLeft() < 1_500) {
      for (const name of unique.slice(i)) {
        if (!(prices[name] > 0)) missing.push(name);
      }
      break;
    }
    const batch = unique.slice(i, i + STEAM_LIVE_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (name) => {
        try {
          const price = await fetchOneSteamStartingAt(name);
          return { name, price };
        } catch {
          return { name, price: 0 };
        }
      })
    );
    for (const row of results) {
      if (row.price > 0) {
        prices[row.name] = row.price;
        fetched++;
      } else {
        failed++;
        missing.push(row.name);
      }
    }
    if (i + STEAM_LIVE_CONCURRENCY < unique.length) {
      await sleep(Math.min(STEAM_LIVE_GAP_MS, Math.max(0, timeLeft() - 500)));
    }
  }

  // Second pass on misses only if budget remains
  if (missing.length && timeLeft() > 3_000) {
    const retry = [...missing];
    missing.length = 0;
    await sleep(Math.min(400, timeLeft() / 4));
    for (let i = 0; i < retry.length; i += STEAM_LIVE_CONCURRENCY) {
      if (timeLeft() < 1_500) {
        missing.push(...retry.slice(i));
        break;
      }
      const batch = retry.slice(i, i + STEAM_LIVE_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (name) => {
          try {
            const price = await fetchOneSteamStartingAt(name);
            return { name, price };
          } catch {
            return { name, price: 0 };
          }
        })
      );
      for (const row of results) {
        if (row.price > 0) {
          prices[row.name] = row.price;
          fetched++;
          failed = Math.max(0, failed - 1);
        } else {
          missing.push(row.name);
        }
      }
      if (i + STEAM_LIVE_CONCURRENCY < retry.length) {
        await sleep(Math.min(STEAM_LIVE_GAP_MS, Math.max(0, timeLeft() - 500)));
      }
    }
  } else if (missing.length && timeLeft() <= 3_000) {
    /* keep missing as-is */
  }

  return { prices, fetched, failed: missing.length, missing };
}

/** Overlay live Starting-at onto a bulk book (live wins when present) */
export function mergeLiveSteamPrices(
  bulk: PriceMap,
  live: PriceMap
): PriceMap {
  if (!live || !Object.keys(live).length) return bulk;
  return { ...bulk, ...live };
}

/**
 * Strict Steam book for required names: live Starting-at only.
 * Clears bulk quotes for required names so we never display SteamApis as Steam.
 */
export function applySteamLiveStrict(
  bulk: PriceMap,
  live: PriceMap,
  requiredNames: string[]
): { prices: PriceMap; missing: string[] } {
  const prices: PriceMap = { ...bulk };
  const missing: string[] = [];
  for (const name of requiredNames) {
    const livePrice = live[name] || 0;
    if (livePrice > 0) {
      prices[name] = livePrice;
    } else {
      delete prices[name];
      missing.push(name);
    }
  }
  return { prices, missing };
}

/** True when every input/outcome has a live Starting-at quote */
export function tradeUpHasFullSteamLive(
  tradeUp: TradeUpResult,
  live: PriceMap
): boolean {
  for (const input of tradeUp.inputs || []) {
    const key = marketHashFromParts(input.name, input.wear);
    if (!(live[key] > 0)) return false;
  }
  for (const out of tradeUp.outcomes || []) {
    const key = marketHashFromParts(out.name, out.wear);
    if (!(live[key] > 0)) return false;
  }
  return true;
}

/**
 * Apply live Starting-at only to contracts fully covered by `live`.
 * Uncovered contracts keep their bulk quotes — never drop them.
 * (Name caps, Steam 429s, and timeouts commonly leave a partial live set.)
 */
export function applyLiveRepriceToTradeUps(
  tradeUps: TradeUpResult[],
  bulk: PriceMap,
  live: PriceMap,
  reprice: (t: TradeUpResult, prices: PriceMap) => TradeUpResult
): {
  results: TradeUpResult[];
  fullLiveCount: number;
  steamLiveStrict: boolean;
} {
  const overlay = mergeLiveSteamPrices(bulk, live);
  let fullLiveCount = 0;
  const results = tradeUps.map((t) => {
    if (tradeUpHasFullSteamLive(t, live)) {
      fullLiveCount++;
      return reprice(t, overlay);
    }
    return t;
  });
  return {
    results,
    fullLiveCount,
    steamLiveStrict: fullLiveCount > 0 && fullLiveCount === results.length,
  };
}
