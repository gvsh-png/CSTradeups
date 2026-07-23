import { NextResponse } from "next/server";
import {
  getUnstableCollectionKeySet,
  NEW_COLLECTION_MAX_AGE_DAYS,
} from "@/lib/collections";
import { authConfigured, authRequired } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";
import { getBulkPrices, pricesUnavailableMessage } from "@/lib/prices";
import {
  collectTradeUpMarketNames,
  fetchSteamStartingAtPrices,
  mergeLiveSteamPrices,
} from "@/lib/steamLive";
import { buildSkinDatabaseForMode, buildSpecialOutcomesByCollection, fetchSchema, groupByCollectionRarity } from "@/lib/schema";
import {
  generateTradeUps,
  repriceTradeUp,
  sanitizePrices,
} from "@/lib/tradeup/generator";
import { consumeScan } from "@/lib/usage/store";
import { normalizeComplexity } from "@/lib/constants";
import type { GenerateParams } from "@/lib/tradeup/types";
import {
  clampTargetWin,
  winChanceBandFromTarget,
} from "@/lib/tradeup/risk";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

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

    const finite = (v: unknown, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    // Slider is target win % (60 → ~60% win). Legacy `risk` was inverted.
    const targetWinChance = clampTargetWin(
      body.targetWinChance != null
        ? finite(body.targetWinChance, 60)
        : body.minWinChance != null
          ? finite(body.minWinChance, 60)
          : body.risk != null
            ? 100 - finite(body.risk, 40)
            : 60
    );
    const band = winChanceBandFromTarget(targetWinChance);

    const params: GenerateParams = {
      minPrice: finite(body.minPrice, 1),
      maxPrice: finite(body.maxPrice, 500),
      targetWinChance: band.target,
      minWinChance: band.minWinChance,
      maxWinChance: band.maxWinChance,
      complexity: normalizeComplexity(body.complexity),
      feeType: body.feeType === "steam" ? "steam" : "csfloat",
      excludeUnstableCollections: body.excludeUnstableCollections !== false,
      limit: Math.max(1, Math.min(50, finite(body.limit, 15))),
      targetOutcomeName:
        typeof body.targetOutcomeName === "string" &&
        body.targetOutcomeName.trim()
          ? body.targetOutcomeName.trim()
          : undefined,
    };

    // Schema + prices in parallel — sequential cold path was blowing the client timeout
    const [schema, bulkResult] = await Promise.all([
      fetchSchema(),
      getBulkPrices(),
    ]);

    const excludedKeys = params.excludeUnstableCollections
      ? getUnstableCollectionKeySet(
          schema,
          new Date(),
          NEW_COLLECTION_MAX_AGE_DAYS,
          {},
          customExcluded
        )
      : new Set(customExcluded);

    const skinDB = buildSkinDatabaseForMode(
      schema,
      params.complexity,
      excludedKeys
    );
    const byCR = groupByCollectionRarity(skinDB);
    const specialByCR =
      params.complexity === "covert"
        ? buildSpecialOutcomesByCollection(schema, excludedKeys)
        : {};

    const { prices: bulk, meta: priceMeta } = bulkResult;
    const prices = sanitizePrices(bulk, skinDB);

    const priceCount = Object.values(prices).filter((p) => p > 0).length;
    if (priceCount < 50) {
      return NextResponse.json(
        {
          error: pricesUnavailableMessage(priceMeta),
          code: "PRICES_UNAVAILABLE",
          meta: {
            pricesLoaded: priceCount,
            priceSource: priceMeta.source,
            steamApisPrices: priceMeta.steamApisCount,
            skinportPrices: priceMeta.skinportCount,
            steamApisStatus: priceMeta.steamApisStatus,
            skinportStatus: priceMeta.skinportStatus,
          },
        },
        { status: 503 }
      );
    }

    const rawResults = await generateTradeUps(
      skinDB,
      byCR,
      prices,
      schema,
      params,
      specialByCR
    );

    // Live Steam Starting-at for skins that actually appear in blueprints
    let priced = prices;
    let steamLiveFetched = 0;
    try {
      const liveNames = collectTradeUpMarketNames(rawResults);
      if (liveNames.length) {
        const live = await fetchSteamStartingAtPrices(liveNames);
        steamLiveFetched = live.fetched;
        if (live.fetched > 0) {
          priced = mergeLiveSteamPrices(prices, live.prices);
        }
      }
    } catch {
      /* keep bulk book */
    }

    const results = rawResults.map((t) => repriceTradeUp(t, priced));

    return NextResponse.json({
      results,
      meta: {
        skinsLoaded: skinDB.length,
        pricesLoaded: priceCount,
        priceSource: priceMeta.source,
        priceCorrections: priceMeta.corrections,
        steamApisPrices: priceMeta.steamApisCount,
        skinportPrices: priceMeta.skinportCount,
        steamApisStatus: priceMeta.steamApisStatus,
        skinportStatus: priceMeta.skinportStatus,
        steamLiveFetched,
        pricesCachedAt: priceMeta.fetchedAt,
        pricesCachedUntil: priceMeta.cachedUntil,
        staleFallback: priceMeta.staleFallback || false,
        excludedCollections: excludedKeys.size,
        newCollectionMaxAgeDays: params.excludeUnstableCollections
          ? NEW_COLLECTION_MAX_AGE_DAYS
          : 0,
        targetOutcomeName: params.targetOutcomeName || null,
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
