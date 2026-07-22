import type { SchemaData, SchemaWeapon } from "./tradeup/types";

/** CSFloat /schema omits some live collections (Ascent as of Jul 2026). */
export const ASCENT_COLLECTION = {
  key: "set_ascent",
  name: "The Ascent Collection",
} as const;

type SupplementEntry = {
  defIndex: string;
  weapon: string;
  type: string;
  paintKey: string;
  paint: string;
  /** CSFloat rarity id (1=Consumer … 6=Covert) */
  rarity: number;
  min?: number;
  max?: number;
};

/** Full Ascent tier list — CSFloat schema gap fill. */
const ASCENT_ENTRIES: SupplementEntry[] = [
  // Classified
  {
    defIndex: "60",
    weapon: "M4A1-S",
    type: "Rifles",
    paintKey: "ascent_stratosphere",
    paint: "Stratosphere",
    rarity: 5,
    min: 0,
    max: 0.85,
  },
  // Restricted
  {
    defIndex: "7",
    weapon: "AK-47",
    type: "Rifles",
    paintKey: "ascent_midnight_laminate",
    paint: "Midnight Laminate",
    rarity: 4,
    min: 0,
    max: 0.75,
  },
  {
    defIndex: "61",
    weapon: "USP-S",
    type: "Pistols",
    paintKey: "ascent_royal_guard",
    paint: "Royal Guard",
    rarity: 4,
    min: 0,
    max: 0.8,
  },
  // Mil-Spec
  {
    defIndex: "1",
    weapon: "Desert Eagle",
    type: "Pistols",
    paintKey: "ascent_mint_fan",
    paint: "Mint Fan",
    rarity: 3,
  },
  {
    defIndex: "10",
    weapon: "FAMAS",
    type: "Rifles",
    paintKey: "ascent_yeti_camo",
    paint: "Yeti Camo",
    rarity: 3,
  },
  {
    defIndex: "32",
    weapon: "P2000",
    type: "Pistols",
    paintKey: "ascent_royal_baroque",
    paint: "Royal Baroque",
    rarity: 3,
  },
  {
    defIndex: "34",
    weapon: "MP9",
    type: "SMGs",
    paintKey: "ascent_cobalt_paisley",
    paint: "Cobalt Paisley",
    rarity: 3,
  },
  {
    defIndex: "19",
    weapon: "P90",
    type: "SMGs",
    paintKey: "ascent_reef_grief",
    paint: "Reef Grief",
    rarity: 3,
  },
  // Industrial
  {
    defIndex: "31",
    weapon: "Zeus x27",
    type: "Equipment",
    paintKey: "ascent_electric_blue",
    paint: "Electric Blue",
    rarity: 2,
  },
  {
    defIndex: "35",
    weapon: "Nova",
    type: "Shotguns",
    paintKey: "ascent_turquoise_pour",
    paint: "Turquoise Pour",
    rarity: 2,
  },
  {
    defIndex: "16",
    weapon: "M4A4",
    type: "Rifles",
    paintKey: "ascent_naval_shred_camo",
    paint: "Naval Shred Camo",
    rarity: 2,
  },
  {
    defIndex: "13",
    weapon: "Galil AR",
    type: "Rifles",
    paintKey: "ascent_robins_egg",
    paint: "Robin's Egg",
    rarity: 2,
  },
  {
    defIndex: "4",
    weapon: "Glock-18",
    type: "Pistols",
    paintKey: "ascent_ocean_topo",
    paint: "Ocean Topo",
    rarity: 2,
  },
  {
    defIndex: "2",
    weapon: "Dual Berettas",
    type: "Pistols",
    paintKey: "ascent_rose_nacre",
    paint: "Rose Nacre",
    rarity: 2,
  },
  {
    defIndex: "3",
    weapon: "Five-SeveN",
    type: "Pistols",
    paintKey: "ascent_sky_blue",
    paint: "Sky Blue",
    rarity: 2,
  },
  {
    defIndex: "25",
    weapon: "XM1014",
    type: "Shotguns",
    paintKey: "ascent_gum_wall_camo",
    paint: "Gum Wall Camo",
    rarity: 2,
  },
  {
    defIndex: "28",
    weapon: "Negev",
    type: "Machine Guns",
    paintKey: "ascent_sour_grapes",
    paint: "Sour Grapes",
    rarity: 2,
  },
  // Consumer
  {
    defIndex: "30",
    weapon: "Tec-9",
    type: "Pistols",
    paintKey: "ascent_blue_blast",
    paint: "Blue Blast",
    rarity: 1,
  },
  {
    defIndex: "34",
    weapon: "MP9",
    type: "SMGs",
    paintKey: "ascent_buff_blue",
    paint: "Buff Blue",
    rarity: 1,
  },
  {
    defIndex: "19",
    weapon: "P90",
    type: "SMGs",
    paintKey: "ascent_blue_tac",
    paint: "Blue Tac",
    rarity: 1,
  },
  {
    defIndex: "36",
    weapon: "P250",
    type: "Pistols",
    paintKey: "ascent_plum_netting",
    paint: "Plum Netting",
    rarity: 1,
  },
  {
    defIndex: "39",
    weapon: "SG 553",
    type: "Rifles",
    paintKey: "ascent_night_camo",
    paint: "Night Camo",
    rarity: 1,
  },
  {
    defIndex: "29",
    weapon: "Sawed-Off",
    type: "Shotguns",
    paintKey: "ascent_runoff",
    paint: "Runoff",
    rarity: 1,
  },
  {
    defIndex: "64",
    weapon: "R8 Revolver",
    type: "Pistols",
    paintKey: "ascent_cobalt_grip",
    paint: "Cobalt Grip",
    rarity: 1,
  },
  {
    defIndex: "13",
    weapon: "Galil AR",
    type: "Rifles",
    paintKey: "ascent_grey_smoke",
    paint: "Grey Smoke",
    rarity: 1,
  },
  {
    defIndex: "40",
    weapon: "SSG 08",
    type: "Sniper Rifles",
    paintKey: "ascent_grey_smoke",
    paint: "Grey Smoke",
    rarity: 1,
  },
  {
    defIndex: "23",
    weapon: "MP5-SD",
    type: "SMGs",
    paintKey: "ascent_lime_hex",
    paint: "Lime Hex",
    rarity: 1,
  },
  {
    defIndex: "17",
    weapon: "MAC-10",
    type: "SMGs",
    paintKey: "ascent_storm_camo",
    paint: "Storm Camo",
    rarity: 1,
  },
];

function entryToPaint(entry: SupplementEntry) {
  return {
    name: entry.paint,
    rarity: entry.rarity,
    min: entry.min ?? 0,
    max: entry.max ?? 1,
    collections: [ASCENT_COLLECTION.key],
  };
}

/** Merge skins for collections missing from the live CSFloat schema payload. */
export function mergeSchemaSupplement(schema: SchemaData): SchemaData {
  const collections = [...(schema.collections || [])];
  if (!collections.some((c) => c.key === ASCENT_COLLECTION.key)) {
    collections.push({ ...ASCENT_COLLECTION });
  }

  const weapons: Record<string, SchemaWeapon> = {
    ...(schema.weapons || {}),
  };

  for (const entry of ASCENT_ENTRIES) {
    const paint = entryToPaint(entry);
    const existing = weapons[entry.defIndex];
    if (!existing) {
      weapons[entry.defIndex] = {
        name: entry.weapon,
        type: entry.type,
        paints: { [entry.paintKey]: paint },
      };
      continue;
    }
    weapons[entry.defIndex] = {
      ...existing,
      paints: {
        ...(existing.paints || {}),
        [entry.paintKey]: paint,
      },
    };
  }

  return { ...schema, collections, weapons };
}
