import { NextResponse } from "next/server";
import { authConfigured, appBaseUrl } from "@/lib/auth/config";
import { steamLoginUrl } from "@/lib/auth/steam";

export const dynamic = "force-dynamic";

/** Start Steam OpenID login */
export async function GET() {
  if (!authConfigured()) {
    return NextResponse.json(
      {
        error:
          "Steam login is not configured yet. Set STEAM_API_KEY, AUTH_SECRET, and Upstash Redis env vars.",
      },
      { status: 503 }
    );
  }

  const returnTo = `${appBaseUrl()}/api/auth/steam/callback`;
  return NextResponse.redirect(steamLoginUrl(returnTo));
}
