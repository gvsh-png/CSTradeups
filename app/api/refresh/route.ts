import { NextResponse } from "next/server";
import { CSFLOAT_FEE, STEAM_FEE } from "@/lib/constants";
import { getBulkPrices } from "@/lib/prices";
import { repriceTradeUp, sanitizePrices } from "@/lib/tradeup/generator";
import { buildSkinDatabase, fetchSchema } from "@/lib/schema";
import type { TradeUpResult } from "@/lib/tradeup/types";

export const dynamic = "force-dynamic";

/** Refresh prices on an existing trade-up and recalculate EV / profit */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tradeUp = body.tradeUp as TradeUpResult | undefined;
    if (!tradeUp?.inputs?.length || !tradeUp?.outcomes?.length) {
      return NextResponse.json({ error: "Invalid trade-up" }, { status: 400 });
    }

    const { prices: bulk, meta } = await getBulkPrices();

    // Same light sanitize as /api/generate so both paths stay in sync
    let prices = bulk;
    try {
      const schema = await fetchSchema();
      const skinDB = buildSkinDatabase(schema);
      prices = sanitizePrices(bulk, skinDB);
    } catch {
      prices = bulk;
    }

    const fee = tradeUp.fee ?? CSFLOAT_FEE;
    const refreshed = repriceTradeUp({ ...tradeUp, fee }, prices);
    refreshed.generatedAt = new Date().toISOString();

    return NextResponse.json({
      tradeUp: refreshed,
      refreshedAt: new Date().toISOString(),
      feeType: fee === STEAM_FEE ? "steam" : "csfloat",
      priceSource: meta.source,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 500 }
    );
  }
}
