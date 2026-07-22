import { NextResponse } from "next/server";
import { buildSkinDatabase, fetchSchema, getSkinImage, groupByCollectionRarity } from "@/lib/schema";
import {
  findSkinsBySearch,
  getTargetBlockReason,
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
    // Target search lists all hunt-eligible outcomes — do not apply the
    // "exclude new collections" filter here (that's for generation only).
    const skinDB = buildSkinDatabase(schema);
    const byCR = groupByCollectionRarity(skinDB);
    const all = listTargetableOutcomes(skinDB, byCR);
    const skins = searchTargetableOutcomes(all, q, limit);

    let hint: string | undefined;
    let matchedName: string | undefined;
    if (q.length >= 2 && skins.length === 0) {
      const near = findSkinsBySearch(skinDB, q, 1)[0];
      if (near) {
        matchedName = near.name;
        hint = getTargetBlockReason(near, byCR) ?? undefined;
      }
    }

    return NextResponse.json({
      skins: skins.map((s) => ({
        name: s.name,
        rarity: s.rarity,
        image: s.image || getSkinImage(schema, s.name),
        maxHitPct: s.maxHitPct,
        collections: s.collections.slice(0, 4).map((c) => ({
          id: c.id,
          name: c.name,
          poolSize: c.poolSize,
        })),
      })),
      count: skins.length,
      ...(hint ? { hint, matchedName } : {}),
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
