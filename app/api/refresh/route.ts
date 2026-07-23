import { NextResponse } from "next/server";
import { CSFLOAT_FEE, STEAM_FEE } from "@/lib/constants";
import { getBulkPrices } from "@/lib/prices";
import {
  applySteamLiveStrict,
  collectTradeUpMarketNames,
  fetchSteamStartingAtPrices,
  tradeUpHasFullSteamLive,
} from "@/lib/steamLive";
import { repriceTradeUp, sanitizePrices } from "@/lib/tradeup/generator";
import { buildSkinDatabase, fetchSchema } from "@/lib/schema";
import type { TradeUpResult } from "@/lib/tradeup/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Refresh prices on an existing trade-up and recalculate EV / profit */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tradeUp = body.tradeUp as TradeUpResult | undefined;
    if (!tradeUp?.inputs?.length || !tradeUp?.outcomes?.length) {
      return NextResponse.json({ error: "Invalid trade-up" }, { status: 400 });
    }

    const { prices: bulk, meta } = await getBulkPrices();
    const priceCount = Object.values(bulk).filter((p) => p > 0).length;
    if (priceCount < 50) {
      return NextResponse.json(
        {
          error:
            "Market price feeds are unavailable right now. Try again in a minute.",
          code: "PRICES_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    // Same light sanitize as /api/generate so both paths stay in sync
    let prices = bulk;
    try {
      const schema = await fetchSchema();
      const skinDB = buildSkinDatabase(schema);
      prices = sanitizePrices(bulk, skinDB);
    } catch {
      prices = bulk;
    }

    // Live Steam Starting-at only for this blueprint
    let steamLiveFetched = 0;
    let steamLiveStrict = false;
    try {
      const liveNames = collectTradeUpMarketNames([tradeUp]);
      if (liveNames.length) {
        const live = await fetchSteamStartingAtPrices(liveNames, {
          maxMs: 25_000,
        });
        steamLiveFetched = live.fetched;
        if (live.fetched > 0) {
          const applied = applySteamLiveStrict(prices, live.prices, liveNames);
          prices = applied.prices;
          steamLiveStrict =
            applied.missing.length === 0 &&
            tradeUpHasFullSteamLive(tradeUp, live.prices);
        }
      }
    } catch {
      /* keep bulk */
    }

    const fee = tradeUp.fee ?? CSFLOAT_FEE;
    // Drop cached AI insight — prices changed, so analysis is stale.
    // Client can request a fresh one after refresh.
    const { insight: _expiredInsight, ...tradeUpWithoutInsight } = tradeUp;
    const refreshed = repriceTradeUp({ ...tradeUpWithoutInsight, fee }, prices);
    refreshed.generatedAt = new Date().toISOString();
    delete refreshed.insight;

    return NextResponse.json({
      tradeUp: refreshed,
      refreshedAt: new Date().toISOString(),
      feeType: fee === STEAM_FEE ? "steam" : "csfloat",
      priceSource: steamLiveStrict
        ? "steam-live"
        : steamLiveFetched > 0
          ? "steam-live-partial"
          : meta.source,
      steamLiveFetched,
      steamLiveStrict,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 500 }
    );
  }
}
