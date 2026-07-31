/**
 * Steam OpenID assertion hardening — reject duplicate claimed_id injection.
 * Run: node scripts/verify-steam-openid.mjs
 */

function parseSteamIdFromClaimedId(claimedId) {
  const match = claimedId.match(
    /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/
  );
  if (!match) throw new Error("Invalid Steam OpenID claimed_id");
  return match[1];
}

/** Mirror of lib/auth/steam.ts steamOpenIdAssertion */
function steamOpenIdAssertion(query, expectedReturnTo) {
  const seen = new Set();
  const body = new URLSearchParams();
  for (const [key, value] of query.entries()) {
    if (!key.startsWith("openid.")) continue;
    if (seen.has(key)) {
      throw new Error(`Duplicate OpenID parameter: ${key}`);
    }
    seen.add(key);
    body.set(key, value);
  }

  const returnTo = body.get("openid.return_to") || "";
  if (!returnTo || returnTo !== expectedReturnTo) {
    throw new Error("OpenID return_to mismatch");
  }

  const claimedId = body.get("openid.claimed_id") || "";
  const steamId = parseSteamIdFromClaimedId(claimedId);

  const identity = body.get("openid.identity") || "";
  if (identity && identity !== claimedId) {
    throw new Error("OpenID identity mismatch");
  }

  body.set("openid.mode", "check_authentication");
  return { steamId, body };
}

const CALLBACK = "https://example.com/api/auth/steam/callback";
const VICTIM = "https://steamcommunity.com/openid/id/76561198000000001";
const ATTACKER = "https://steamcommunity.com/openid/id/76561198000000002";

function baseAssertion(claimedId) {
  const q = new URLSearchParams();
  q.set("openid.ns", "http://specs.openid.net/auth/2.0");
  q.set("openid.mode", "id_res");
  q.set("openid.op_endpoint", "https://steamcommunity.com/openid/login");
  q.set("openid.claimed_id", claimedId);
  q.set("openid.identity", claimedId);
  q.set("openid.return_to", CALLBACK);
  q.set("openid.response_nonce", "2026-07-31T00:00:00Zunique");
  q.set("openid.assoc_handle", "1234567890");
  q.set("openid.signed", "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle");
  q.set("openid.sig", "fakesig");
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
      throw new Error(`${label}: expected error containing ${includes}, got: ${msg}`);
    }
  }
  if (!threw) throw new Error(`${label}: expected throw`);
}

// Happy path
{
  const { steamId, body } = steamOpenIdAssertion(baseAssertion(ATTACKER), CALLBACK);
  if (steamId !== "76561198000000002") {
    throw new Error(`happy path steamId: ${steamId}`);
  }
  if (body.get("openid.mode") !== "check_authentication") {
    throw new Error("mode not rewritten for check_authentication");
  }
  if (body.get("openid.claimed_id") !== ATTACKER) {
    throw new Error("claimed_id rewritten unexpectedly");
  }
}

// Classic attack: victim first (session), attacker last (Steam validates)
{
  const q = baseAssertion(VICTIM);
  q.append("openid.claimed_id", ATTACKER);
  // Legacy bug: get() → victim, set-loop → attacker
  if (q.get("openid.claimed_id") !== VICTIM) {
    throw new Error("fixture: get() should return first claimed_id");
  }
  const legacyBody = new URLSearchParams();
  for (const [key, value] of q.entries()) {
    if (key.startsWith("openid.")) legacyBody.set(key, value);
  }
  if (legacyBody.get("openid.claimed_id") !== ATTACKER) {
    throw new Error("fixture: legacy set-loop should keep last claimed_id");
  }
  assertThrows(
    "duplicate claimed_id",
    () => steamOpenIdAssertion(q, CALLBACK),
    "Duplicate OpenID parameter"
  );
}

assertThrows(
  "return_to mismatch",
  () => {
    const q = baseAssertion(ATTACKER);
    q.set("openid.return_to", "https://evil.example/callback");
    steamOpenIdAssertion(q, CALLBACK);
  },
  "return_to mismatch"
);

assertThrows(
  "identity mismatch",
  () => {
    const q = baseAssertion(ATTACKER);
    q.set("openid.identity", VICTIM);
    steamOpenIdAssertion(q, CALLBACK);
  },
  "identity mismatch"
);

assertThrows(
  "invalid claimed_id",
  () => {
    const q = baseAssertion("https://evil.example/id/1");
    steamOpenIdAssertion(q, CALLBACK);
  },
  "Invalid Steam OpenID claimed_id"
);

console.log("verify-steam-openid: ok");
