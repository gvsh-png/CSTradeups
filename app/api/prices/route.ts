import { NextResponse } from "next/server";
import { getBulkPrices, fetchPricesForItems } from "@/lib/prices";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const items = searchParams.get("items");

    if (items) {
      const names = items.split(",").filter(Boolean);
      const prices = await fetchPricesForItems(names);
      return NextResponse.json({
        prices,
        count: Object.keys(prices).length,
        fetchedAt: new Date().toISOString(),
      });
    }

    const { prices, meta } = await getBulkPrices();
    return NextResponse.json({
      prices,
      count: Object.keys(prices).length,
      meta,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Price fetch failed" },
      { status: 500 }
    );
  }
}
