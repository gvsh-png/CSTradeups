import { NextResponse } from "next/server";
import { getBulkPrices } from "@/lib/prices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const warmOnly = searchParams.get("warm") === "1";

    const { prices, meta } = await getBulkPrices();
    const count = Object.keys(prices).length;

    // Prefetch from /generate — don't ship the full book to the browser
    if (warmOnly) {
      return NextResponse.json({ ok: count >= 50, count, meta });
    }

    return NextResponse.json({
      prices,
      count,
      meta,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Price fetch failed" },
      { status: 500 }
    );
  }
}
