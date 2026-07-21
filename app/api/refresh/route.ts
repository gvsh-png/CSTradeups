import { NextResponse } from "next/server";
import { CSFLOAT_FEE, STEAM_FEE } from "@/lib/constants";
import { getBulkPrices, getPrice } from "@/lib/prices";
import { r2 } from "@/lib/tradeup/float";
import type { TradeUpOutcome, TradeUpResult } from "@/lib/tradeup/types";

export const dynamic = "force-dynamic";

/** Refresh prices on an existing trade-up and recalculate EV / profit */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tradeUp = body.tradeUp as TradeUpResult | undefined;
    if (!tradeUp?.inputs?.length || !tradeUp?.outcomes?.length) {
      return NextResponse.json({ error: "Invalid trade-up" }, { status: 400 });
    }

    const { prices } = await getBulkPrices();
    const fee = tradeUp.fee ?? CSFLOAT_FEE;

    const refreshedInputs = tradeUp.inputs.map((input) => {
      const price = getPrice(prices, input.name, input.wear) || input.price;
      return { ...input, price };
    });

    const totalCost = r2(
      refreshedInputs.reduce((s, i) => s + i.price * i.count, 0)
    );

    const refreshedOutcomes: TradeUpOutcome[] = tradeUp.outcomes.map((o) => {
      const price = getPrice(prices, o.name, o.wear) || o.price;
      const profit = r2(price * (1 - fee) - totalCost);
      return { ...o, price, profit };
    });

    const ev = refreshedOutcomes.reduce((s, o) => {
      const prob = o.prob / 100;
      return s + prob * o.price * (1 - fee);
    }, 0);

    const expectedProfit = r2(ev - totalCost);
    const roi = totalCost > 0 ? r2((expectedProfit / totalCost) * 100) : 0;

    let winPct = 0;
    for (const o of refreshedOutcomes) {
      if (o.profit >= 0) winPct += o.prob;
    }
    winPct = r2(winPct);

    const refreshed: TradeUpResult = {
      ...tradeUp,
      inputs: refreshedInputs,
      outcomes: refreshedOutcomes.sort((a, b) => b.price - a.price),
      totalCost,
      expectedValue: r2(ev),
      expectedProfit,
      roi,
      winPct,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      tradeUp: refreshed,
      refreshedAt: new Date().toISOString(),
      feeType: fee === STEAM_FEE ? "steam" : "csfloat",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 500 }
    );
  }
}
