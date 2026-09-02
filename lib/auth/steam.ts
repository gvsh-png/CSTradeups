import { randomBytes, timingSafeEqual } from "crypto";
import { appBaseUrl } from "./config";

const STEAM_OPENID = "https://steamcommunity.com/openid/login";
const STEAM_API = "https://api.steampowered.com";

/** httpOnly cookie binding Steam login start → callback (login CSRF). */
export const STEAM_OPENID_STATE_COOKIE = "steam_openid_state";
const STATE_TTL_SEC = 10 * 60;

/** Cryptographically random OpenID login state (base64url). */
export function createSteamOpenIdState(): string {
  return randomBytes(32).toString("base64url");
}

/** Callback URL with state — must match openid.return_to exactly. */
export function steamCallbackUrl(state: string): string {
  const base = `${appBaseUrl()}/api/auth/steam/callback`;
  return `${base}?state=${encodeURIComponent(state)}`;
}

export function steamOpenIdStateCookieOptions(state: string) {
  return {
    name: STEAM_OPENID_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth/steam",
    maxAge: STATE_TTL_SEC,
  };
}

export function clearSteamOpenIdStateCookieOptions() {
  return {
    name: STEAM_OPENID_STATE_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth/steam",
    maxAge: 0,
  };
}

/**
 * Require the callback's `state` query param to match the httpOnly cookie
 * set when login started. Blocks delivering an attacker OpenID assertion to
 * a victim browser (login CSRF → victim pays for attacker's plan).
 */
export function assertSteamOpenIdState(
  cookieState: string | undefined,
  queryState: string | null | undefined
): string {
  if (!cookieState || !queryState) {
    throw new Error("Missing Steam OpenID login state");
  }
  const a = Buffer.from(cookieState, "utf8");
  const b = Buffer.from(queryState, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Steam OpenID login state mismatch");
  }
  return queryState;
}

/** Build Steam OpenID login redirect URL */
export function steamLoginUrl(returnTo: string): string {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": appBaseUrl(),
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${STEAM_OPENID}?${params.toString()}`;
}

/**
 * Shape + return_to checks before Steam check_authentication.
 * `expectedReturnTo` must include the per-login state query param.
 */
export function steamOpenIdAssertion(
  query: URLSearchParams,
  expectedReturnTo: string
): { steamId: string; body: URLSearchParams } {
  const body = new URLSearchParams();
  for (const [key, value] of query.entries()) {
    if (key.startsWith("openid.")) body.set(key, value);
  }

  const returnTo = body.get("openid.return_to") || "";
  if (!returnTo || returnTo !== expectedReturnTo) {
    throw new Error("OpenID return_to mismatch");
  }

  const claimedId = body.get("openid.claimed_id") || "";
  const match = claimedId.match(
    /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/
  );
  if (!match) throw new Error("Invalid Steam OpenID claimed_id");

  const steamId = match[1];
  const identity = body.get("openid.identity") || "";
  if (identity && identity !== claimedId) {
    throw new Error("OpenID identity mismatch");
  }

  body.set("openid.mode", "check_authentication");
  return { steamId, body };
}

/** Verify OpenID assertion with Steam and extract SteamID64 */
export async function verifySteamOpenId(
  query: URLSearchParams,
  expectedReturnTo: string
): Promise<string> {
  const { steamId, body } = steamOpenIdAssertion(query, expectedReturnTo);

  const res = await fetch(STEAM_OPENID, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  if (!text.includes("is_valid:true")) {
    throw new Error("Steam OpenID verification failed");
  }

  return steamId;
}

export type SteamProfile = {
  steamId: string;
  name: string;
  avatar?: string;
};

export async function fetchSteamProfile(
  steamId: string
): Promise<SteamProfile> {
  const key = process.env.STEAM_API_KEY;
  if (!key) {
    return { steamId, name: `Steam ${steamId.slice(-4)}` };
  }

  const url = `${STEAM_API}/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(
    key
  )}&steamids=${encodeURIComponent(steamId)}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    return { steamId, name: `Steam ${steamId.slice(-4)}` };
  }

  const data = await res.json();
  const player = data?.response?.players?.[0];
  return {
    steamId,
    name: player?.personaname || `Steam ${steamId.slice(-4)}`,
    avatar: player?.avatarfull || player?.avatarmedium || player?.avatar,
  };
}
