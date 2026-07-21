import { NextResponse } from "next/server";
import { getBulkPrices } from "@/lib/prices";
import { buildSkinDatabase, fetchSchema, groupByCollectionRarity } from "@/lib/schema";
import {
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

    const { prices: bulk, meta: priceMeta } = await getBulkPrices();
    const prices = sanitizePrices(bulk, skinDB);

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
        priceSource: priceMeta.source,
        priceCorrections: priceMeta.corrections,
        steamApisPrices: priceMeta.steamApisCount,
        skinportPrices: priceMeta.skinportCount,
        pricesCachedAt: priceMeta.fetchedAt,
        pricesCachedUntil: priceMeta.cachedUntil,
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
