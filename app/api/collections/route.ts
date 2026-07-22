import { NextResponse } from "next/server";
import {
  getUnstableCollections,
  NEW_COLLECTION_MAX_AGE_DAYS,
} from "@/lib/collections";
import { isNeverTradeUpCollection } from "@/lib/constants";
import { fetchSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export async function GET() {
  try {
    const schema = await fetchSchema();

    const unstable = getUnstableCollections(
      schema,
      new Date(),
      NEW_COLLECTION_MAX_AGE_DAYS
    ).filter((c) => !isNeverTradeUpCollection(c.key, c.name));

    // Hide permanently banned collections from custom-exclude UI
    const allCollections = (schema.collections || [])
      .filter((c) => !isNeverTradeUpCollection(c.key, c.name))
      .map((c) => ({ key: c.key, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - NEW_COLLECTION_MAX_AGE_DAYS);

    return NextResponse.json({
      unstable,
      count: unstable.length,
      maxAgeDays: NEW_COLLECTION_MAX_AGE_DAYS,
      cutoffDate: cutoff.toISOString().split("T")[0],
      allCollections,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load collections" },
      { status: 500 }
    );
  }
}
