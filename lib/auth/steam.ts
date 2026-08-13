import { appBaseUrl } from "./config";

const STEAM_OPENID = "https://steamcommunity.com/openid/login";
const STEAM_API = "https://api.steampowered.com";

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
 * Validate OpenID assertion shape before calling Steam check_authentication.
 * Pins op_endpoint and rejects control characters so newline-stuffed
 * op_endpoint values cannot confuse Steam's parser into validating an
 * attacker assertion while claimed_id names a victim (account takeover).
 */
export function assertSteamOpenIdShape(query: URLSearchParams): string {
  const opEndpoint = query.get("openid.op_endpoint") || "";
  if (opEndpoint !== STEAM_OPENID) {
    throw new Error("Invalid Steam OpenID op_endpoint");
  }

  // Steam never sends invalidate_handle on a normal login; the known
  // op_endpoint stuffing PoC injects it. Reject early.
  if (query.has("openid.invalidate_handle")) {
    throw new Error("Unexpected OpenID invalidate_handle");
  }

  for (const [key, value] of query.entries()) {
    if (!key.startsWith("openid.")) continue;
    // Newlines / other controls enable parameter stuffing inside values
    if (/[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error(`Invalid characters in OpenID parameter: ${key}`);
    }
  }

  const claimedId = query.get("openid.claimed_id") || "";
  const match = claimedId.match(
    /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/
  );
  if (!match) throw new Error("Invalid Steam OpenID claimed_id");

  const identity = query.get("openid.identity") || "";
  if (identity && identity !== claimedId) {
    throw new Error("OpenID identity mismatch");
  }

  return match[1];
}

/** Verify OpenID assertion with Steam and extract SteamID64 */
export async function verifySteamOpenId(
  query: URLSearchParams
): Promise<string> {
  const steamId = assertSteamOpenIdShape(query);

  const body = new URLSearchParams();
  for (const [key, value] of query.entries()) {
    if (key.startsWith("openid.")) body.set(key, value);
  }
  body.set("openid.mode", "check_authentication");

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
