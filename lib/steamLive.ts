import { r2 } from "./tradeup/float";
import type { PriceMap } from "./tradeup/types";
import type { TradeUpResult } from "./tradeup/types";

/** Steam Market priceoverview — live "Starting at" for a few names only */
const STEAM_PRICE_URL =
  "https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=";

/** Cap live lookups so generate stays inside the route budget */
export const STEAM_LIVE_MAX_NAMES = 48;
const STEAM_LIVE_CONCURRENCY = 3;
const STEAM_LIVE_GAP_MS = 120;

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

async function fetchOneSteamStartingAt(
  marketHashName: string
): Promise<number> {
  const res = await fetch(
    STEAM_PRICE_URL + encodeURIComponent(marketHashName),
    {
      cache: "no-store",
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "tradeupcsgo.net/1.0",
      },
      signal: AbortSignal.timeout(8_000),
    }
  );
  if (res.status === 429) return 0;
  if (!res.ok) return 0;
  const data = (await res.json()) as SteamOverview;
  if (!data?.success) return 0;
  // Prefer live Starting at; fall back to median when Steam omits lowest
  return (
    parseSteamUsdPrice(data.lowest_price) ||
    parseSteamUsdPrice(data.median_price) ||
    0
  );
}

export type SteamLiveResult = {
  prices: PriceMap;
  fetched: number;
  failed: number;
};

/**
 * Live Steam Market Starting-at for a small set of names (user blueprint only).
 * Bulk SteamApis stays for scanning; this corrects visible quotes.
 */
export async function fetchSteamStartingAtPrices(
  marketHashNames: string[]
): Promise<SteamLiveResult> {
  const unique = [...new Set(marketHashNames.filter(Boolean))].slice(
    0,
    STEAM_LIVE_MAX_NAMES
  );
  const prices: PriceMap = {};
  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < unique.length; i += STEAM_LIVE_CONCURRENCY) {
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
      }
    }
    if (i + STEAM_LIVE_CONCURRENCY < unique.length) {
      await sleep(STEAM_LIVE_GAP_MS);
    }
  }

  return { prices, fetched, failed };
}

/** Overlay live Starting-at onto a bulk book (live wins when present) */
export function mergeLiveSteamPrices(
  bulk: PriceMap,
  live: PriceMap
): PriceMap {
  if (!live || !Object.keys(live).length) return bulk;
  return { ...bulk, ...live };
}
