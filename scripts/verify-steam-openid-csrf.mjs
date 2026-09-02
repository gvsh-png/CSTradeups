/**
 * Steam OpenID login CSRF — state cookie must match return_to state.
 * Run: node scripts/verify-steam-openid-csrf.mjs
 */

import { timingSafeEqual } from "crypto";

function steamCallbackUrl(baseUrl, state) {
  const base = `${baseUrl.replace(/\/$/, "")}/api/auth/steam/callback`;
  return `${base}?state=${encodeURIComponent(state)}`;
}

function assertSteamOpenIdState(cookieState, queryState) {
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

function steamOpenIdAssertion(query, expectedReturnTo) {
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

  const identity = body.get("openid.identity") || "";
  if (identity && identity !== claimedId) {
    throw new Error("OpenID identity mismatch");
  }

  body.set("openid.mode", "check_authentication");
  return { steamId: match[1], body };
}

const APP = "https://example.com";
const ATTACKER = "https://steamcommunity.com/openid/id/76561198000000002";

function baseAssertion(returnTo) {
  const q = new URLSearchParams();
  q.set("openid.ns", "http://specs.openid.net/auth/2.0");
  q.set("openid.mode", "id_res");
  q.set("openid.op_endpoint", "https://steamcommunity.com/openid/login");
  q.set("openid.claimed_id", ATTACKER);
  q.set("openid.identity", ATTACKER);
  q.set("openid.return_to", returnTo);
  q.set("openid.response_nonce", "2026-09-02T00:00:00Zunique");
  q.set("openid.assoc_handle", "1234567890");
  q.set(
    "openid.signed",
    "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle"
  );
  q.set("openid.sig", "fakesig");
  // Steam appends openid.* onto return_to; state stays on the request URL
  const state = new URL(returnTo).searchParams.get("state");
  if (state) q.set("state", state);
  return q;
}

function assertThrows(label, fn, includes) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    const msg = err instanceof Error ? err.message : String(err);
    if (includes && !msg.includes(includes)) {
      throw new Error(
        `${label}: expected error containing ${includes}, got: ${msg}`
      );
    }
  }
  if (!threw) throw new Error(`${label}: expected throw`);
}

// Happy path: cookie state matches return_to state
{
  const state = "good-state-token_abc123XYZ";
  const returnTo = steamCallbackUrl(APP, state);
  assertSteamOpenIdState(state, state);
  const { steamId } = steamOpenIdAssertion(baseAssertion(returnTo), returnTo);
  if (steamId !== "76561198000000002") {
    throw new Error(`happy path steamId: ${steamId}`);
  }
}

// Login CSRF: attacker assertion delivered to victim browser (no/wrong cookie)
{
  const attackerState = "attacker-state-aaaaaaaa";
  const victimCookie = "victim-state-bbbbbbbb";
  const returnTo = steamCallbackUrl(APP, attackerState);
  const q = baseAssertion(returnTo);

  assertThrows(
    "missing cookie",
    () => assertSteamOpenIdState(undefined, q.get("state")),
    "Missing"
  );
  assertThrows(
    "mismatched cookie (login CSRF)",
    () => assertSteamOpenIdState(victimCookie, q.get("state")),
    "mismatch"
  );
}

// return_to without state / stripped state rejected
{
  const state = "bound-state";
  const expected = steamCallbackUrl(APP, state);
  const stripped = `${APP}/api/auth/steam/callback`;
  assertThrows(
    "stripped return_to",
    () => steamOpenIdAssertion(baseAssertion(stripped), expected),
    "return_to mismatch"
  );
}

// Attacker reuses their assertion but swaps expected return_to to victim's state
{
  const attackerState = "attacker-state";
  const victimState = "victim-state";
  const attackerReturnTo = steamCallbackUrl(APP, attackerState);
  const victimExpected = steamCallbackUrl(APP, victimState);
  assertThrows(
    "cross-state return_to",
    () =>
      steamOpenIdAssertion(baseAssertion(attackerReturnTo), victimExpected),
    "return_to mismatch"
  );
}

console.log("verify-steam-openid-csrf: ok");
