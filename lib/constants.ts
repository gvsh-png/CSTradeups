export const RARITY_ORDER = [
  "Consumer Grade",
  "Industrial Grade",
  "Mil-Spec Grade",
  "Restricted",
  "Classified",
  "Covert",
] as const;

export const RARITY_MAP: Record<number, string> = {
  1: "Consumer Grade",
  2: "Industrial Grade",
  3: "Mil-Spec Grade",
  4: "Restricted",
  5: "Classified",
  6: "Covert",
  7: "Extraordinary",
};

export const RARITY_COLORS: Record<string, string> = {
  "Consumer Grade": "#b0c3d9",
  "Industrial Grade": "#5e98d9",
  "Mil-Spec Grade": "#4b69ff",
  Restricted: "#8847ff",
  Classified: "#d32ce6",
  Covert: "#eb4b4b",
  Extraordinary: "#e4ae39",
};

/** Short but clear rarity label (drops trailing "Grade") */
export function rarityShort(rarity: string): string {
  return rarity.replace(/ Grade$/, "");
}

/** Inline styles for rarity-tinted surfaces: colored border + soft fill */
export function rarityStyle(rarity: string): {
  borderColor: string;
  backgroundColor: string;
  color: string;
} {
  const color = RARITY_COLORS[rarity] || "#8b93a0";
  return {
    borderColor: `${color}66`,
    backgroundColor: `${color}18`,
    color,
  };
}

/** Souvenir accent — Steam-style gold rim on top of rarity tint */
export const SOUVENIR_BORDER = "#e4ae39";
export const SOUVENIR_BORDER_SOFT = "#e4ae3999";

export function isSouvenirSkinName(name: string): boolean {
  return name.startsWith("Souvenir ");
}

export const WEAR_RANGES = [
  { name: "Factory New", min: 0, max: 0.07 },
  { name: "Minimal Wear", min: 0.07, max: 0.15 },
  { name: "Field-Tested", min: 0.15, max: 0.38 },
  { name: "Well-Worn", min: 0.38, max: 0.45 },
  { name: "Battle-Scarred", min: 0.45, max: 1.0 },
] as const;

export const STEAM_FEE = 0.13;
export const CSFLOAT_FEE = 0.02;

/**
 * Collections that can NEVER be used in CS2 trade-up contracts.
 * Hard-banned forever — not shown in temporary / custom exclude UI.
 * Match by exact key, key prefix, or display-name keyword.
 */
export const NEVER_TRADEUP_COLLECTION_KEYS = new Set([
  "set_xpshop_wpn_01", // Limited Edition Item (Armory)
]);

/** Future Armory / XP-shop limited editions use this prefix */
export const NEVER_TRADEUP_KEY_PREFIXES = ["set_xpshop_"] as const;

export const NEVER_TRADEUP_NAME_KEYWORDS = [
  "limited edition",
] as const;

/** True if this collection is permanently ineligible for trade-ups */
export function isNeverTradeUpCollection(
  key: string,
  name?: string
): boolean {
  const k = (key || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (NEVER_TRADEUP_COLLECTION_KEYS.has(key) || NEVER_TRADEUP_COLLECTION_KEYS.has(k)) {
    return true;
  }
  if (NEVER_TRADEUP_KEY_PREFIXES.some((p) => k.startsWith(p))) return true;
  if (n && NEVER_TRADEUP_NAME_KEYWORDS.some((w) => n.includes(w))) return true;
  return false;
}

/**
 * Soft keyword bans on collection *names* (always skipped in generation).
 * Separate from NEVER_TRADEUP — these may still appear in settings UI.
 */
export const EXCLUDED_KEYWORDS = [
  "armory",
  "armoury",
  "timed_drops",
  "timed-drops",
  "anubis",
  "exuberant",
  "opulent",
];

export const KNIFE_GLOVE_TYPES = ["Knives", "Gloves"];

export const STORAGE_KEY = "tradeup-gen-saved";

/** Contract mode — replaces old float-complexity toggles */
export type Complexity = "standard" | "covert" | "souvenir";

/** Inputs required for the contract */
export function inputCountForMode(mode: Complexity): number {
  return mode === "covert" ? 5 : 10;
}

export const COMPLEXITY_OPTIONS: {
  value: Complexity;
  label: string;
  description: string;
}[] = [
  {
    value: "standard",
    label: "Standard",
    description: "Classic 10-skin trade-up to the next rarity tier.",
  },
  {
    value: "covert",
    label: "Covert",
    description:
      "5 Covert skins → knife or gloves. Mixes all risk pools automatically.",
  },
  {
    value: "souvenir",
    label: "Souvenir",
    description:
      "Mix souvenir and normal skins (10) → normal next-tier. Mixes all risk pools.",
  },
];

/** Map legacy share/API values onto current modes */
export function normalizeComplexity(raw: unknown): Complexity {
  if (raw === "covert" || raw === "souvenir" || raw === "standard") return raw;
  // Old float-complexity names → standard contracts
  if (raw === "simple" || raw === "moderate" || raw === "precise") {
    return "standard";
  }
  return "standard";
}

/** Covert / Souvenir ignore the risk slider and scan all win-chance pools */
export function usesAnyRisk(mode: Complexity): boolean {
  return mode === "covert" || mode === "souvenir";
}
