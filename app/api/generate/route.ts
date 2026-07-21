import { NextResponse } from "next/server";
import {
  discoverNewCollections,
  getUnstableCollectionKeySet,
  loadDiscoveries,
  NEW_COLLECTION_MAX_AGE_DAYS,
} from "@/lib/collections";
import { authConfigured, authRequired } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";
import { getBulkPrices } from "@/lib/prices";
import { buildSkinDatabase, fetchSchema, groupByCollectionRarity } from "@/lib/schema";
import {
  generateTradeUps,
  repriceTradeUp,
  sanitizePrices,
} from "@/lib/tradeup/generator";
import { consumeScan } from "@/lib/usage/store";
import type { Complexity } from "@/lib/constants";
import type { GenerateParams } from "@/lib/tradeup/types";
import {
  clampTargetWin,
  winChanceBandFromTarget,
} from "@/lib/tradeup/risk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    let quotaMeta: Record<string, unknown> | null = null;

    if (authConfigured()) {
      const session = await getSession();
      if (!session) {
        if (authRequired()) {
          return NextResponse.json(
            {
              error: "Sign in with Steam to run scans.",
              code: "AUTH_REQUIRED",
            },
            { status: 401 }
          );
        }
      } else {
        const consumed = await consumeScan(session.steamId);
        if (!consumed.ok) {
          return NextResponse.json(
            {
              error: consumed.reason,
              code: "SCAN_LIMIT",
              quota: consumed.quota,
            },
            { status: 403 }
          );
        }
        quotaMeta = consumed.quota as unknown as Record<string, unknown>;
      }
    }

    const body = await request.json();

    const customExcluded: string[] = Array.isArray(body.customExcludedCollections)
      ? body.customExcludedCollections
      : [];

    // Slider is target win % (60 → ~60% win). Legacy `risk` was inverted.
    const targetWinChance = clampTargetWin(
      body.targetWinChance != null
        ? Number(body.targetWinChance)
        : body.minWinChance != null
          ? Number(body.minWinChance)
          : body.risk != null
            ? 100 - Number(body.risk)
            : 60
    );
    const band = winChanceBandFromTarget(targetWinChance);

    const params: GenerateParams = {
      minPrice: Number(body.minPrice) ?? 1,
      maxPrice: Number(body.maxPrice) ?? 500,
      targetWinChance: band.target,
      minWinChance: band.minWinChance,
      maxWinChance: band.maxWinChance,
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
        quota: quotaMeta,
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
