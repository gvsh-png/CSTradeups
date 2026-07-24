import { NextResponse } from "next/server";
import {
  applyLiveRepriceToTradeUps,
  collectTradeUpMarketNames,
  fetchSteamStartingAtPrices,
} from "@/lib/steamLive";
import { repriceTradeUp } from "@/lib/tradeup/generator";
import type { TradeUpResult } from "@/lib/tradeup/types";

export const dynamic = "force-dynamic";
/** Live Steam lookups for a result set — keep under client wait */
export const maxDuration = 60;

/**
 * Reprice an existing scan result set with live Steam Starting-at.
 * Called after /api/generate so the scan itself stays fast.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tradeUps = body.results as TradeUpResult[] | undefined;
    if (!Array.isArray(tradeUps) || !tradeUps.length) {
      return NextResponse.json({ error: "No results to reprice" }, { status: 400 });
    }

    const liveNames = collectTradeUpMarketNames(tradeUps);
    if (!liveNames.length) {
      return NextResponse.json({
        results: tradeUps,
        steamLiveFetched: 0,
        steamLiveStrict: false,
        priceSource: "unchanged",
      });
    }

    const live = await fetchSteamStartingAtPrices(liveNames, { maxMs: 28_000 });
    if (live.fetched <= 0) {
      return NextResponse.json({
        results: tradeUps,
        steamLiveFetched: 0,
        steamLiveStrict: false,
        priceSource: "unchanged",
      });
    }

    // Build a price map from each trade-up's current quotes, then overlay live
    const bulk: Record<string, number> = {};
    for (const tu of tradeUps) {
      for (const input of tu.inputs || []) {
        const key = `${input.name} (${input.wear})`;
        if (input.price > 0) bulk[key] = input.price;
      }
      for (const out of tu.outcomes || []) {
        const key = `${out.name} (${out.wear})`;
        if (out.price > 0) bulk[key] = out.price;
      }
    }

    // Only reprice fully live-covered contracts; keep the rest at bulk prices.
    // Never drop results when the live pass is capped / partial.
    const { results: repriced, fullLiveCount, steamLiveStrict } =
      applyLiveRepriceToTradeUps(tradeUps, bulk, live.prices, repriceTradeUp);

    const results = [...repriced].sort(
      (a, b) => b.expectedProfit - a.expectedProfit
    );

    return NextResponse.json({
      results,
      steamLiveFetched: live.fetched,
      steamLiveStrict,
      priceSource:
        fullLiveCount === 0
          ? "unchanged"
          : steamLiveStrict
            ? "steam-live"
            : "steam-live-partial",
      missing: live.missing,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Live Steam reprice failed",
      },
      { status: 500 }
    );
  }
}
