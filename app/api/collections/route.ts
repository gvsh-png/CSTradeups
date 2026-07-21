import { NextResponse } from "next/server";
import {
  discoverNewCollections,
  getUnstableCollections,
  loadDiscoveries,
  NEW_COLLECTION_MAX_AGE_DAYS,
  resolveReleaseDateWithAI,
} from "@/lib/collections";
import { fetchSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export async function GET() {
  try {
    const schema = await fetchSchema();
    await loadDiscoveries();
    const discoveries = discoverNewCollections(schema);

    // For newly discovered collections, try OpenRouter once to refine dates
    for (const [key, firstSeen] of Object.entries(discoveries)) {
      const col = schema.collections?.find((c) => c.key === key);
      if (!col) continue;
      // Only attempt AI lookup if first seen today (avoid repeat calls)
      const today = new Date().toISOString().split("T")[0];
      if (firstSeen !== today) continue;

      const aiDate = await resolveReleaseDateWithAI(col.name, key);
      if (aiDate) {
        discoveries[key] = aiDate;
      }
    }

    const unstable = getUnstableCollections(schema, new Date(), NEW_COLLECTION_MAX_AGE_DAYS, discoveries);
    const allCollections = (schema.collections || [])
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
