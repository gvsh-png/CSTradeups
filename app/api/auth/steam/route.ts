import { NextResponse } from "next/server";
import { authConfigured, appBaseUrl } from "@/lib/auth/config";
import {
  createSteamOpenIdState,
  steamCallbackUrl,
  steamLoginUrl,
  steamOpenIdStateCookieOptions,
} from "@/lib/auth/steam";

export const dynamic = "force-dynamic";

/** Start Steam OpenID login — bind a one-time state cookie into return_to. */
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

  const state = createSteamOpenIdState();
  const returnTo = steamCallbackUrl(state);
  const res = NextResponse.redirect(steamLoginUrl(returnTo));
  const cookie = steamOpenIdStateCookieOptions(state);
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
