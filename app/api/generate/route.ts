import { NextResponse } from "next/server";
import { fetchPricesForItems, getBulkPrices } from "@/lib/prices";
import { buildSkinDatabase, fetchSchema, groupByCollectionRarity } from "@/lib/schema";
import {
  collectNeededMarketHashNames,
  generateTradeUps,
  sanitizePrices,
} from "@/lib/tradeup/generator";
import type { Complexity } from "@/lib/constants";
import type { GenerateParams } from "@/lib/tradeup/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const params: GenerateParams = {
      minPrice: Number(body.minPrice) ?? 1,
      maxPrice: Number(body.maxPrice) ?? 500,
      targetRoi: body.targetRoi != null ? Number(body.targetRoi) : 5,
      complexity: (body.complexity as Complexity) || "simple",
      feeType: body.feeType === "steam" ? "steam" : "csfloat",
      limit: Number(body.limit) || 15,
    };

    const schema = await fetchSchema();
    const skinDB = buildSkinDatabase(schema);
    const byCR = groupByCollectionRarity(skinDB);

    const neededNames = collectNeededMarketHashNames(skinDB, byCR, params);
    const { prices: bulk, meta: priceMeta } = await getBulkPrices();
    const missing = neededNames.filter((n) => !bulk[n] || bulk[n] <= 0);
    const fetched = missing.length > 0 ? await fetchPricesForItems(missing) : {};
    const rawPrices = { ...bulk, ...fetched };
    const prices = sanitizePrices(rawPrices, skinDB);

    const priceCount = Object.values(prices).filter((p) => p > 0).length;

    const results = await generateTradeUps(
      skinDB,
      byCR,
      prices,
      schema,
      params
    );

    return NextResponse.json({
      results,
      meta: {
        skinsLoaded: skinDB.length,
        pricesLoaded: priceCount,
        pricesFetched: missing.length,
        priceSource: priceMeta.source,
        priceCorrections: priceMeta.corrections,
        steamApisPrices: priceMeta.steamApisCount,
        skinportPrices: priceMeta.skinportCount,
        params,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Trade-up generation failed",
      },
      { status: 500 }
    );
  }
}
