import { NextResponse } from "next/server";
import { fetchSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  try {
    const schema = await fetchSchema();
    return NextResponse.json({
      collections: schema.collections?.length ?? 0,
      weapons: Object.keys(schema.weapons || {}).length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Schema fetch failed" },
      { status: 500 }
    );
  }
}
