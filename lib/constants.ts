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

export const WEAR_RANGES = [
  { name: "Factory New", min: 0, max: 0.07 },
  { name: "Minimal Wear", min: 0.07, max: 0.15 },
  { name: "Field-Tested", min: 0.15, max: 0.38 },
  { name: "Well-Worn", min: 0.38, max: 0.45 },
  { name: "Battle-Scarred", min: 0.45, max: 1.0 },
] as const;

export const STEAM_FEE = 0.13;
export const CSFLOAT_FEE = 0.02;

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

export type Complexity = "simple" | "moderate" | "precise";

export const COMPLEXITY_OPTIONS: {
  value: Complexity;
  label: string;
  description: string;
}[] = [
  {
    value: "simple",
    label: "Simple",
    description: "Wear tier only (e.g. Field-Tested). No specific float targets.",
  },
  {
    value: "moderate",
    label: "Moderate",
    description: "Max float cap per input. Good balance of ease and control.",
  },
  {
    value: "precise",
    label: "Precise",
    description: "Exact float ranges per skin. Harder to source inputs.",
  },
];
