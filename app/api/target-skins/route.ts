import { NextResponse } from "next/server";
import {
  discoverNewCollections,
  getUnstableCollectionKeySet,
  loadDiscoveries,
  NEW_COLLECTION_MAX_AGE_DAYS,
} from "@/lib/collections";
import { buildSkinDatabase, fetchSchema, groupByCollectionRarity } from "@/lib/schema";
import {
  listTargetableOutcomes,
  searchTargetableOutcomes,
} from "@/lib/tradeup/targets";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * GET /api/target-skins?q=axia
 * Search Standard-mode targetable outcomes (Industrial → Covert).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.max(
      1,
      Math.min(40, Number(searchParams.get("limit")) || 25)
    );

    // Empty query with short responses — require 2+ chars to avoid huge lists
    if (q.length > 0 && q.length < 2) {
      return NextResponse.json({ skins: [], count: 0 });
    }

    const schema = await fetchSchema();
    await loadDiscoveries();
    const discoveries = discoverNewCollections(schema);
    const excludedKeys = getUnstableCollectionKeySet(
      schema,
      new Date(),
      NEW_COLLECTION_MAX_AGE_DAYS,
      discoveries,
      []
    );

    const skinDB = buildSkinDatabase(schema, excludedKeys);
    const byCR = groupByCollectionRarity(skinDB);
    const all = listTargetableOutcomes(skinDB, byCR);
    const skins = searchTargetableOutcomes(all, q, limit);

    return NextResponse.json({
      skins: skins.map((s) => ({
        name: s.name,
        rarity: s.rarity,
        image: s.image,
        maxHitPct: s.maxHitPct,
        collections: s.collections.slice(0, 4).map((c) => ({
          id: c.id,
          name: c.name,
          poolSize: c.poolSize,
        })),
      })),
      count: skins.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to search skins",
      },
      { status: 500 }
    );
  }
}
