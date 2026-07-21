import { marketHashName } from "./tradeup/float";

/** Steam Community Market listing for a wear-specific skin */
export function steamMarketUrl(skinName: string, wear: string): string {
  const hash = marketHashName(skinName, wear);
  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(hash)}`;
}

/** CSFloat search for the same market hash name */
export function csfloatUrl(skinName: string, wear: string): string {
  const hash = marketHashName(skinName, wear);
  return `https://csfloat.com/search?market_hash_name=${encodeURIComponent(hash)}`;
}

/** Skinport search (optional third check) */
export function skinportUrl(skinName: string, wear: string): string {
  const hash = marketHashName(skinName, wear);
  return `https://skinport.com/market?search=${encodeURIComponent(hash)}`;
}
