import { NextResponse } from "next/server";
import { getFxRates } from "@/lib/fx";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

/** GET /api/fx — USD→display currency rates for Steam-aligned money formatting */
export async function GET() {
  try {
    const { rates, source } = await getFxRates();
    return NextResponse.json({ rates, source });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "FX failed" },
      { status: 500 }
    );
  }
}
