import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authConfigured, appBaseUrl } from "@/lib/auth/config";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import {
  assertSteamOpenIdState,
  clearSteamOpenIdStateCookieOptions,
  fetchSteamProfile,
  STEAM_OPENID_STATE_COOKIE,
  steamCallbackUrl,
  verifySteamOpenId,
} from "@/lib/auth/steam";
import { upsertUser } from "@/lib/usage/store";

export const dynamic = "force-dynamic";

function redirectAuth(result: "ok" | "failed" | "not_configured") {
  const res = NextResponse.redirect(
    `${appBaseUrl()}/profile?auth=${result}`
  );
  const clear = clearSteamOpenIdStateCookieOptions();
  res.cookies.set(clear.name, clear.value, clear);
  return res;
}

/** Steam OpenID callback — verify state + assertion, upsert user, set session */
export async function GET(request: Request) {
  if (!authConfigured()) {
    return redirectAuth("not_configured");
  }

  try {
    const url = new URL(request.url);
    const jar = await cookies();
    const cookieState = jar.get(STEAM_OPENID_STATE_COOKIE)?.value;
    const state = assertSteamOpenIdState(
      cookieState,
      url.searchParams.get("state")
    );
    const expectedReturnTo = steamCallbackUrl(state);
    const steamId = await verifySteamOpenId(url.searchParams, expectedReturnTo);
    const profile = await fetchSteamProfile(steamId);
    const user = await upsertUser(profile);
    const token = await createSessionToken({
      steamId: user.steamId,
      name: user.name,
      avatar: user.avatar,
      plan: user.plan,
    });

    const res = NextResponse.redirect(`${appBaseUrl()}/profile?auth=ok`);
    const session = sessionCookieOptions(token);
    res.cookies.set(session.name, session.value, session);
    const clear = clearSteamOpenIdStateCookieOptions();
    res.cookies.set(clear.name, clear.value, clear);
    return res;
  } catch (err) {
    console.error("Steam auth callback failed:", err);
    return redirectAuth("failed");
  }
}
