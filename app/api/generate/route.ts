import { NextResponse } from "next/server";
import {
  discoverNewCollections,
  getUnstableCollectionKeySet,
  loadDiscoveries,
  NEW_COLLECTION_MAX_AGE_DAYS,
} from "@/lib/collections";
import { getBulkPrices } from "@/lib/prices";
import { buildSkinDatabase, fetchSchema, groupByCollectionRarity } from "@/lib/schema";
import {
  generateTradeUps,
  repriceTradeUp,
  sanitizePrices,
} from "@/lib/tradeup/generator";
import type { Complexity } from "@/lib/constants";
import type { GenerateParams } from "@/lib/tradeup/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const customExcluded: string[] = Array.isArray(body.customExcludedCollections)
      ? body.customExcludedCollections
      : [];

    const params: GenerateParams = {
      minPrice: Number(body.minPrice) ?? 1,
      maxPrice: Number(body.maxPrice) ?? 500,
      targetRoi: body.targetRoi != null ? Number(body.targetRoi) : 5,
      complexity: (body.complexity as Complexity) || "simple",
      feeType: body.feeType === "steam" ? "steam" : "csfloat",
      excludeUnstableCollections: body.excludeUnstableCollections !== false,
      limit: Number(body.limit) || 15,
    };

    const schema = await fetchSchema();
    await loadDiscoveries();
    const discoveries = discoverNewCollections(schema);

    const excludedKeys = params.excludeUnstableCollections
      ? getUnstableCollectionKeySet(
          schema,
          new Date(),
          NEW_COLLECTION_MAX_AGE_DAYS,
          discoveries,
          customExcluded
        )
      : new Set(customExcluded);

    const skinDB = buildSkinDatabase(schema, excludedKeys);
    const byCR = groupByCollectionRarity(skinDB);

    const { prices: bulk, meta: priceMeta } = await getBulkPrices();
    const prices = sanitizePrices(bulk, skinDB);

    const priceCount = Object.values(prices).filter((p) => p > 0).length;

    const rawResults = await generateTradeUps(
      skinDB,
      byCR,
      prices,
      schema,
      params
    );

    // Final reprice with the same map refresh uses — keeps scan results
    // accurate without needing a manual refresh after save.
    const results = rawResults.map((t) => repriceTradeUp(t, prices));

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
        excludedCollections: excludedKeys.size,
        newCollectionMaxAgeDays: params.excludeUnstableCollections
          ? NEW_COLLECTION_MAX_AGE_DAYS
          : 0,
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
