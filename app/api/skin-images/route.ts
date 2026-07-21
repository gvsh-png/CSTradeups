import { NextResponse } from "next/server";
import { fetchSchema, getSkinImage } from "@/lib/schema";

export const dynamic = "force-dynamic";

/** Resolve skin image URLs by market name (for share links without embedded images) */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const names: string[] = Array.isArray(body.names) ? body.names : [];
    if (!names.length) {
      return NextResponse.json({ images: {} });
    }

    const schema = await fetchSchema();
    const images: Record<string, string> = {};
    for (const name of names.slice(0, 40)) {
      if (typeof name !== "string" || !name) continue;
      const img = getSkinImage(schema, name);
      if (img) images[name] = img;
    }

    return NextResponse.json({ images });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lookup failed" },
      { status: 500 }
    );
  }
}
