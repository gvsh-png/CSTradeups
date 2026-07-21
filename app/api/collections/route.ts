import { NextResponse } from "next/server";
import { getUnstableCollections } from "@/lib/collections";
import { fetchSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export async function GET() {
  try {
    const schema = await fetchSchema();
    const unstable = getUnstableCollections(schema);
    return NextResponse.json({ unstable, count: unstable.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load collections" },
      { status: 500 }
    );
  }
}
