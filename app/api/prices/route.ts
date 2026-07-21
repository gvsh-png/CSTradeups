import { NextResponse } from "next/server";
import { getBulkPrices } from "@/lib/prices";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { prices, meta } = await getBulkPrices();
    return NextResponse.json({
      prices,
      count: Object.keys(prices).length,
      meta,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Price fetch failed" },
      { status: 500 }
    );
  }
}
