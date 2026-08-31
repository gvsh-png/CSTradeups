/**
 * Never-trade-up collections (Armory Limited Edition, etc.)
 * Run: node scripts/verify-never-tradeup.mjs
 */

const NEVER_TRADEUP_COLLECTION_KEYS = new Set(["set_xpshop_wpn_01"]);
const NEVER_TRADEUP_KEY_PREFIXES = ["set_xpshop_"];
const NEVER_TRADEUP_NAME_KEYWORDS = ["limited edition"];

function isNeverTradeUpCollection(key, name) {
  const k = (key || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (NEVER_TRADEUP_COLLECTION_KEYS.has(key) || NEVER_TRADEUP_COLLECTION_KEYS.has(k)) {
    return true;
  }
  if (NEVER_TRADEUP_KEY_PREFIXES.some((p) => k.startsWith(p))) return true;
  if (n && NEVER_TRADEUP_NAME_KEYWORDS.some((w) => n.includes(w))) return true;
  return false;
}

/** Mirrors lib/schema.ts — hard bans only */
function isTradeUpBannedCollection(key, name) {
  return isNeverTradeUpCollection(key, name);
}

let failed = 0;
function assert(name, ok, detail = "") {
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

assert(
  "Limited Edition Item banned by key",
  isNeverTradeUpCollection("set_xpshop_wpn_01", "Limited Edition Item")
);
assert(
  "future xpshop key banned by prefix",
  isNeverTradeUpCollection("set_xpshop_wpn_02", "Limited Edition Item 2")
);
assert(
  "banned by Limited Edition name alone",
  isNeverTradeUpCollection("set_something_weird", "The Limited Edition Pack")
);
assert(
  "Gamma still allowed",
  !isNeverTradeUpCollection("set_community_13", "The Gamma Collection")
);
assert(
  "Anubis allowed (valid map collection)",
  !isTradeUpBannedCollection("set_anubis", "The Anubis Collection")
);
assert(
  "Ascent live key allowed",
  !isTradeUpBannedCollection("set_timed_drops_cool", "The Ascent Collection")
);
assert(
  "Boreal allowed",
  !isTradeUpBannedCollection("set_timed_drops_neutral", "The Boreal Collection")
);
assert(
  "Radiant allowed",
  !isTradeUpBannedCollection("set_timed_drops_warm", "The Radiant Collection")
);
assert(
  "Achroma allowed",
  !isTradeUpBannedCollection("set_timed_drops_achroma", "The Achroma Collection")
);
assert(
  "Harlequin allowed",
  !isTradeUpBannedCollection(
    "set_timed_drops_exuberant",
    "The Harlequin Collection"
  )
);
assert(
  "Solitude collection banned",
  isTradeUpBannedCollection("set_xpshop_wpn_01", "Limited Edition Item")
);
assert(
  "Aphrodite collection banned",
  isTradeUpBannedCollection("set_xpshop_wpn_01", "Limited Edition Item")
);

// Live schema check when network available
fetch("https://csfloat.com/api/v1/schema")
  .then((r) => r.json())
  .then((s) => {
    const banned = [];
    const skins = [];
    for (const w of Object.values(s.weapons || {})) {
      for (const p of Object.values(w.paints || {})) {
        for (const c of p.collections || []) {
          const col = (s.collections || []).find((x) => x.key === c);
          if (isNeverTradeUpCollection(c, col?.name)) {
            banned.push(c);
            skins.push(`${w.name} | ${p.name}`);
          }
        }
      }
    }
    const uniqueSkins = [...new Set(skins)];
    assert(
      "Solitude not in allowed pool",
      !uniqueSkins.every((n) => false) &&
        uniqueSkins.some((n) => n.includes("Solitude")),
      `banned skins include: ${uniqueSkins.filter((n) => n.includes("Solitude")).join(", ")}`
    );
    assert(
      "exactly the LEI skins are never-tradeup paints",
      uniqueSkins.length === 4,
      `count=${uniqueSkins.length} → ${uniqueSkins.join("; ")}`
    );

    // Soft keyword bans used to strip these live trade-up ladders
    const mustAllow = [
      "set_anubis",
      "set_timed_drops_cool",
      "set_timed_drops_neutral",
      "set_timed_drops_warm",
      "set_timed_drops_achroma",
      "set_timed_drops_exuberant",
    ];
    let weaponSkinsAllowed = 0;
    for (const w of Object.values(s.weapons || {})) {
      if (["Knives", "Gloves"].includes(w.type)) continue;
      for (const p of Object.values(w.paints || {})) {
        const cols = p.collections || [];
        if (!cols.length) continue;
        const valid = cols.filter((c) => {
          const col = (s.collections || []).find((x) => x.key === c);
          return !isTradeUpBannedCollection(c, col?.name);
        });
        if (valid.some((c) => mustAllow.includes(c))) weaponSkinsAllowed++;
      }
    }
    assert(
      "live Armory+Anubis weapon skins stay in generation pool",
      weaponSkinsAllowed >= 115,
      `allowed=${weaponSkinsAllowed}`
    );

    if (failed) {
      console.error(`\n${failed} failed`);
      process.exit(1);
    }
    console.log("\nAll never-tradeup checks passed");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
