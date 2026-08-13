/**
 * Steam OpenID op_endpoint pinning — block newline-stuffed endpoint takeover.
 * Run: node scripts/verify-steam-openid-endpoint.mjs
 */

const STEAM_OPENID = "https://steamcommunity.com/openid/login";

/** Mirror of lib/auth/steam.ts assertSteamOpenIdShape */
function assertSteamOpenIdShape(query) {
  const opEndpoint = query.get("openid.op_endpoint") || "";
  if (opEndpoint !== STEAM_OPENID) {
    throw new Error("Invalid Steam OpenID op_endpoint");
  }

  if (query.has("openid.invalidate_handle")) {
    throw new Error("Unexpected OpenID invalidate_handle");
  }

  for (const [key, value] of query.entries()) {
    if (!key.startsWith("openid.")) continue;
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

const VICTIM = "https://steamcommunity.com/openid/id/76561198000000001";
const ATTACKER = "https://steamcommunity.com/openid/id/76561198000000002";
const CALLBACK = "https://example.com/api/auth/steam/callback";

function baseAssertion(claimedId) {
  const q = new URLSearchParams();
  q.set("openid.ns", "http://specs.openid.net/auth/2.0");
  q.set("openid.mode", "id_res");
  q.set("openid.op_endpoint", STEAM_OPENID);
  q.set("openid.claimed_id", claimedId);
  q.set("openid.identity", claimedId);
  q.set("openid.return_to", CALLBACK);
  q.set("openid.response_nonce", "2026-08-13T00:00:00Zunique");
  q.set("openid.assoc_handle", "1234567890");
  q.set(
    "openid.signed",
    "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle"
  );
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
      throw new Error(
        `${label}: expected error containing ${includes}, got: ${msg}`
      );
    }
  }
  if (!threw) throw new Error(`${label}: expected throw`);
}

// Happy path
{
  const steamId = assertSteamOpenIdShape(baseAssertion(ATTACKER));
  if (steamId !== "76561198000000002") {
    throw new Error(`happy path steamId: ${steamId}`);
  }
}

// Known takeover PoC: real attacker fields stuffed into op_endpoint via newlines,
// while top-level claimed_id/identity name the victim.
{
  const q = baseAssertion(VICTIM);
  const stuffed = `${STEAM_OPENID}
claimed_id:${ATTACKER}
identity:${ATTACKER}
return_to:${CALLBACK}
response_nonce:2026-08-13T00:00:00Zreal
assoc_handle:1234567890
invalidate_handle:test`;
  q.set("openid.op_endpoint", stuffed);
  q.set("openid.invalidate_handle", "test");
  assertThrows(
    "newline-stuffed op_endpoint",
    () => assertSteamOpenIdShape(q),
    "op_endpoint"
  );
}

// Control characters alone (even with otherwise-valid endpoint key present first)
{
  const q = baseAssertion(ATTACKER);
  q.set("openid.response_nonce", "2026-08-13T00:00:00Z\nsmuggled");
  assertThrows(
    "control chars in nonce",
    () => assertSteamOpenIdShape(q),
    "Invalid characters"
  );
}

// Wrong / attacker-controlled endpoint host
{
  const q = baseAssertion(ATTACKER);
  q.set("openid.op_endpoint", "https://evil.example/openid/login");
  assertThrows(
    "foreign op_endpoint",
    () => assertSteamOpenIdShape(q),
    "op_endpoint"
  );
}

// invalidate_handle rejected even with pinned endpoint
{
  const q = baseAssertion(ATTACKER);
  q.set("openid.invalidate_handle", "test");
  assertThrows(
    "invalidate_handle",
    () => assertSteamOpenIdShape(q),
    "invalidate_handle"
  );
}

// identity must match claimed_id when present
{
  const q = baseAssertion(VICTIM);
  q.set("openid.identity", ATTACKER);
  assertThrows(
    "identity mismatch",
    () => assertSteamOpenIdShape(q),
    "identity mismatch"
  );
}

console.log("verify-steam-openid-endpoint: ok");
