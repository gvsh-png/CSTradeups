import { NextResponse } from "next/server";
import { authConfigured, appBaseUrl } from "@/lib/auth/config";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { fetchSteamProfile, verifySteamOpenId } from "@/lib/auth/steam";
import { upsertUser } from "@/lib/usage/store";

export const dynamic = "force-dynamic";

/** Steam OpenID callback — verify, upsert user, set session cookie */
export async function GET(request: Request) {
  if (!authConfigured()) {
    return NextResponse.redirect(`${appBaseUrl()}/profile?auth=not_configured`);
  }

  try {
    const url = new URL(request.url);
    const steamId = await verifySteamOpenId(url.searchParams);
    const profile = await fetchSteamProfile(steamId);
    const user = await upsertUser(profile);
    const token = await createSessionToken({
      steamId: user.steamId,
      name: user.name,
      avatar: user.avatar,
      plan: user.plan,
    });

    const res = NextResponse.redirect(`${appBaseUrl()}/profile?auth=ok`);
    const cookie = sessionCookieOptions(token);
    res.cookies.set(cookie.name, cookie.value, cookie);
    return res;
  } catch (err) {
    console.error("Steam auth callback failed:", err);
    return NextResponse.redirect(`${appBaseUrl()}/profile?auth=failed`);
  }
}
