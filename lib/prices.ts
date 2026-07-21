import { parsePrice } from "./tradeup/float";
import type { PriceMap } from "./tradeup/types";

const priceCache = new Map<string, { price: number; fetchedAt: number }>();
const CACHE_TTL = 15 * 60 * 1000;

async function fetchCSFloatPrice(marketHashName: string): Promise<number> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": "TradeUpGen/1.0",
    };
    const apiKey = process.env.CSFLOAT_API_KEY;
    if (apiKey) headers.Authorization = apiKey;

    const url = `https://csfloat.com/api/v1/listings?market_hash_name=${encodeURIComponent(marketHashName)}&limit=1&sort_by=lowest_price&type=buy_now`;
    const res = await fetch(url, { headers, next: { revalidate: 900 } });
    if (!res.ok) return 0;

    const listings = await res.json();
    if (!Array.isArray(listings) || !listings.length) return 0;

    const listing = listings[0];
    const priceCents = listing.price || listing.item?.scm?.price || 0;
    return priceCents > 0 ? Math.round((priceCents / 100) * 100) / 100 : 0;
  } catch {
    return 0;
  }
}

async function fetchSteamPrice(marketHashName: string): Promise<number> {
  const cached = priceCache.get(marketHashName);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.price;
  }

  const csfloatPrice = await fetchCSFloatPrice(marketHashName);
  if (csfloatPrice > 0) {
    priceCache.set(marketHashName, { price: csfloatPrice, fetchedAt: Date.now() });
    return csfloatPrice;
  }

  try {
    const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(marketHashName)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TradeUpGen/1.0" },
      next: { revalidate: 900 },
    });

    if (!res.ok) return cached?.price ?? 0;
    const data = await res.json();

    if (!data.success) return cached?.price ?? 0;

    const price = parsePrice(data.lowest_price || data.median_price || "0");
    priceCache.set(marketHashName, { price, fetchedAt: Date.now() });
    return price;
  } catch {
    return cached?.price ?? 0;
  }
}

async function fetchSteamApisPrices(): Promise<PriceMap | null> {
  const apiKey = process.env.STEAMAPIS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.steamapis.com/market/items/730?api_key=${apiKey}`,
      { next: { revalidate: 900 } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.data) return null;

    const prices: PriceMap = {};
    for (const item of data.data) {
      const name = item.market_hash_name;
      if (!name || !item.prices) continue;

      const ts = item.prices.safe_ts || {};
      const priceUSD =
        ts.last_7d || ts.last_30d || item.prices.safe || item.prices.latest || 0;
      if (priceUSD > 0) prices[name] = Math.round(priceUSD * 100) / 100;
    }
    return prices;
  } catch {
    return null;
  }
}

let bulkPriceCache: { prices: PriceMap; fetchedAt: number } | null = null;

export async function getBulkPrices(): Promise<PriceMap> {
  if (bulkPriceCache && Date.now() - bulkPriceCache.fetchedAt < CACHE_TTL) {
    return bulkPriceCache.prices;
  }

  const steamApisPrices = await fetchSteamApisPrices();
  if (steamApisPrices && Object.keys(steamApisPrices).length > 1000) {
    bulkPriceCache = { prices: steamApisPrices, fetchedAt: Date.now() };
    return steamApisPrices;
  }

  return bulkPriceCache?.prices ?? {};
}

export async function fetchPricesForItems(
  marketHashNames: string[],
  maxFetches = 250
): Promise<PriceMap> {
  const bulk = await getBulkPrices();
  const prices: PriceMap = { ...bulk };
  const missing = marketHashNames
    .filter((n) => !prices[n] || prices[n] <= 0)
    .slice(0, maxFetches);

  const batchSize = 5;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (name) => {
        const price = await fetchSteamPrice(name);
        return { name, price };
      })
    );
    for (const { name, price } of results) {
      if (price > 0) prices[name] = price;
    }
    if (i + batchSize < missing.length) {
      await new Promise((r) => setTimeout(r, 250));
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
