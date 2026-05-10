import type { PassiveCombatTotals } from "./passives";

/** Runtime behaviour tag resolved by {@link WeaponSystem}. */
export type WeaponLoopKind =
  | "whip_arc"
  | "magic_barrage"
  | "knife_stream"
  | "axe_lob"
  | "cross_quartet"
  | "bible_orbit"
  | "fire_fan"
  | "garlic_aura"
  | "santa_pools"
  | "rune_piercing"
  | "lightning_bolt"
  | "pentagram_shock";

/**
 * Canonical authored weapon blueprint — aligns with Vampire Survivors style scaling.
 */
export interface WeaponData {
  id: string;
  name: string;
  maxLevel: number;
  baseDamage: number;
  baseCooldownMs: number;
  /** Optional active window before a cooldown starts, used by orbiting / stance-like weapons. */
  activeDurationMs?: number;
  baseArea: number;
  baseSpeed: number;
  baseCount: number;
  loopKind: WeaponLoopKind;
  evolutionId?: string;
  passiveRequirement?: string;
  /** Evolved counterparts reference which base weapon they replace. */
  evolvesFromWeaponId?: string;
  projectileTtlMs?: number;
  projectileRadiusPx?: number;
  /** Extra pierce stacks beyond merged `count`. */
  pierceBias?: number;
  levelBonuses: Partial<
    Pick<
      WeaponData,
      "baseDamage" | "baseCooldownMs" | "baseArea" | "baseSpeed" | "baseCount"
    >
  >[];
}

function dmgCdPattern(
  damageTick: number,
  cooldownTick: number,
): WeaponData["levelBonuses"] {
  return Array.from({ length: 7 }, (_, index) =>
    index % 2 === 0
      ? { baseDamage: damageTick }
      : { baseCooldownMs: cooldownTick },
  );
}

function dmgAreaPattern(dmg: number, area: number): WeaponData["levelBonuses"] {
  return Array.from({ length: 7 }, (_, index) =>
    index % 2 === 0 ? { baseDamage: dmg } : { baseArea: area },
  );
}

export const WEAPON_DATABASE = {
  whip: {
    id: "whip",
    name: "Lash",
    maxLevel: 8,
    baseDamage: 20,
    baseCooldownMs: 1350,
    baseArea: 1,
    baseSpeed: 1,
    baseCount: 1,
    loopKind: "whip_arc",
    evolutionId: "bloody_tear",
    passiveRequirement: "hollow_heart",
    levelBonuses: dmgCdPattern(5, -170),
  },
  bloody_tear: {
    id: "bloody_tear",
    name: "Crimson Lash",
    maxLevel: 8,
    baseDamage: 40,
    baseCooldownMs: 900,
    baseArea: 1.2,
    baseSpeed: 1.1,
    baseCount: 1,
    loopKind: "whip_arc",
    evolvesFromWeaponId: "whip",
    levelBonuses: dmgCdPattern(8, -120),
  },
  magic_wand: {
    id: "magic_wand",
    name: "Arcane Bolt",
    maxLevel: 8,
    baseDamage: 10,
    baseCooldownMs: 350,
    baseArea: 1,
    baseSpeed: 1.25,
    baseCount: 1,
    loopKind: "magic_barrage",
    evolutionId: "holy_wand",
    passiveRequirement: "empty_tome",
    levelBonuses: dmgCdPattern(2, -44),
  },
  holy_wand: {
    id: "holy_wand",
    name: "Sanctified Bolt",
    maxLevel: 8,
    baseDamage: 18,
    baseCooldownMs: 280,
    baseArea: 1.1,
    baseSpeed: 1.35,
    baseCount: 2,
    loopKind: "magic_barrage",
    evolvesFromWeaponId: "magic_wand",
    levelBonuses: dmgCdPattern(3, -35),
  },
  knife: {
    id: "knife",
    name: "Shard Blade",
    maxLevel: 8,
    baseDamage: 12,
    baseCooldownMs: 420,
    baseArea: 0.95,
    baseSpeed: 1.85,
    baseCount: 2,
    loopKind: "knife_stream",
    evolutionId: "thousand_edge",
    passiveRequirement: "bracer",
    levelBonuses: dmgCdPattern(3, -40),
  },
  thousand_edge: {
    id: "thousand_edge",
    name: "Thousand Shards",
    maxLevel: 8,
    baseDamage: 18,
    baseCooldownMs: 320,
    baseArea: 1,
    baseSpeed: 2.05,
    baseCount: 4,
    loopKind: "knife_stream",
    evolvesFromWeaponId: "knife",
    levelBonuses: dmgCdPattern(4, -30),
  },
  axe: {
    id: "axe",
    name: "Cleaver",
    maxLevel: 8,
    baseDamage: 32,
    baseCooldownMs: 1850,
    baseArea: 1.05,
    baseSpeed: 0.95,
    baseCount: 1,
    loopKind: "axe_lob",
    projectileTtlMs: 6200,
    projectileRadiusPx: 12,
    evolutionId: "death_spiral",
    passiveRequirement: "candelabrador",
    levelBonuses: dmgAreaPattern(8, 0.08),
  },
  death_spiral: {
    id: "death_spiral",
    name: "Reaper Spiral",
    maxLevel: 8,
    baseDamage: 48,
    baseCooldownMs: 1500,
    baseArea: 1.35,
    baseSpeed: 1.05,
    baseCount: 2,
    loopKind: "axe_lob",
    projectileTtlMs: 7000,
    projectileRadiusPx: 14,
    evolvesFromWeaponId: "axe",
    levelBonuses: dmgAreaPattern(10, 0.1),
  },
  cross: {
    id: "cross",
    name: "Sanctum Cross",
    maxLevel: 8,
    baseDamage: 26,
    baseCooldownMs: 1600,
    baseArea: 1,
    baseSpeed: 1.05,
    baseCount: 1,
    loopKind: "cross_quartet",
    projectileTtlMs: 5200,
    projectileRadiusPx: 11,
    evolutionId: "heaven_sword",
    passiveRequirement: "clover",
    levelBonuses: dmgCdPattern(8, -150),
  },
  heaven_sword: {
    id: "heaven_sword",
    name: "Celestial Blade",
    maxLevel: 8,
    baseDamage: 36,
    baseCooldownMs: 1300,
    baseArea: 1.25,
    baseSpeed: 1.12,
    baseCount: 2,
    loopKind: "cross_quartet",
    projectileTtlMs: 6000,
    projectileRadiusPx: 13,
    evolvesFromWeaponId: "cross",
    levelBonuses: dmgCdPattern(11, -120),
  },
  king_bible: {
    id: "king_bible",
    name: "Orbiting Tome",
    maxLevel: 8,
    baseDamage: 18,
    baseCooldownMs: 3000,
    activeDurationMs: 3000,
    baseArea: 1.05,
    baseSpeed: 1,
    baseCount: 1,
    loopKind: "bible_orbit",
    evolutionId: "unholy_vespers",
    passiveRequirement: "spellbinder",
    levelBonuses: dmgAreaPattern(4, 0.06),
  },
  unholy_vespers: {
    id: "unholy_vespers",
    name: "Nocturne Tome",
    maxLevel: 8,
    baseDamage: 26,
    baseCooldownMs: 3000,
    activeDurationMs: 3000,
    baseArea: 1.2,
    baseSpeed: 1.03,
    baseCount: 1,
    loopKind: "bible_orbit",
    evolvesFromWeaponId: "king_bible",
    levelBonuses: dmgAreaPattern(6, 0.07),
  },
  fire_wand: {
    id: "fire_wand",
    name: "Ember Wand",
    maxLevel: 8,
    baseDamage: 42,
    baseCooldownMs: 1100,
    baseArea: 1.08,
    baseSpeed: 1.05,
    baseCount: 1,
    loopKind: "fire_fan",
    projectileTtlMs: 5400,
    projectileRadiusPx: 14,
    evolutionId: "hellfire",
    passiveRequirement: "spinach",
    levelBonuses: dmgCdPattern(10, -90),
  },
  hellfire: {
    id: "hellfire",
    name: "Inferno Burst",
    maxLevel: 8,
    baseDamage: 60,
    baseCooldownMs: 900,
    baseArea: 1.25,
    baseSpeed: 1.12,
    baseCount: 2,
    loopKind: "fire_fan",
    projectileTtlMs: 5800,
    projectileRadiusPx: 17,
    evolvesFromWeaponId: "fire_wand",
    levelBonuses: dmgCdPattern(12, -70),
  },
  garlic: {
    id: "garlic",
    name: "Warding Aura",
    maxLevel: 8,
    baseDamage: 6,
    baseCooldownMs: 800,
    baseArea: 1.2,
    baseSpeed: 0.95,
    baseCount: 1,
    loopKind: "garlic_aura",
    evolutionId: "soul_eater",
    passiveRequirement: "pummarola",
    levelBonuses: dmgAreaPattern(2, 0.05),
  },
  soul_eater: {
    id: "soul_eater",
    name: "Life Drain",
    maxLevel: 8,
    baseDamage: 10,
    baseCooldownMs: 650,
    baseArea: 1.55,
    baseSpeed: 1,
    baseCount: 1,
    loopKind: "garlic_aura",
    evolvesFromWeaponId: "garlic",
    levelBonuses: dmgAreaPattern(4, 0.07),
  },
  santa_water: {
    id: "santa_water",
    name: "Sanctified Tide",
    maxLevel: 8,
    baseDamage: 24,
    baseCooldownMs: 2400,
    baseArea: 1.05,
    baseSpeed: 1,
    baseCount: 3,
    loopKind: "santa_pools",
    evolutionId: "la_borra",
    passiveRequirement: "attractorb",
    levelBonuses: dmgCdPattern(6, -180),
  },
  la_borra: {
    id: "la_borra",
    name: "Deluge",
    maxLevel: 8,
    baseDamage: 36,
    baseCooldownMs: 2000,
    baseArea: 1.3,
    baseSpeed: 1.06,
    baseCount: 5,
    loopKind: "santa_pools",
    evolvesFromWeaponId: "santa_water",
    levelBonuses: dmgCdPattern(10, -150),
  },
  runetracer: {
    id: "runetracer",
    name: "Rune Shard",
    maxLevel: 8,
    baseDamage: 20,
    baseCooldownMs: 2100,
    baseArea: 1,
    baseSpeed: 1.05,
    baseCount: 1,
    loopKind: "rune_piercing",
    projectileTtlMs: 9000,
    projectileRadiusPx: 8,
    pierceBias: 18,
    evolutionId: "no_future",
    passiveRequirement: "armor",
    levelBonuses: dmgCdPattern(6, -150),
  },
  no_future: {
    id: "no_future",
    name: "Final Sigil",
    maxLevel: 8,
    baseDamage: 32,
    baseCooldownMs: 1800,
    baseArea: 1.08,
    baseSpeed: 1.07,
    baseCount: 2,
    loopKind: "rune_piercing",
    projectileTtlMs: 11000,
    projectileRadiusPx: 9,
    pierceBias: 28,
    evolvesFromWeaponId: "runetracer",
    levelBonuses: dmgCdPattern(8, -120),
  },
  lightning_ring: {
    id: "lightning_ring",
    name: "Storm Ring",
    maxLevel: 8,
    baseDamage: 22,
    baseCooldownMs: 4500,
    baseArea: 1,
    baseSpeed: 1,
    baseCount: 1,
    loopKind: "lightning_bolt",
    evolutionId: "thunder_loop",
    passiveRequirement: "duplicator",
    levelBonuses: dmgCdPattern(6, -150),
  },
  thunder_loop: {
    id: "thunder_loop",
    name: "Tempest Loop",
    maxLevel: 8,
    baseDamage: 34,
    baseCooldownMs: 1900,
    baseArea: 1.05,
    baseSpeed: 1.06,
    baseCount: 2,
    loopKind: "lightning_bolt",
    evolvesFromWeaponId: "lightning_ring",
    levelBonuses: dmgCdPattern(9, -120),
  },
  pentagram: {
    id: "pentagram",
    name: "Sigil Nova",
    maxLevel: 8,
    baseDamage: 70,
    baseCooldownMs: 90000,
    baseArea: 1,
    baseSpeed: 0.92,
    baseCount: 1,
    loopKind: "pentagram_shock",
    evolutionId: "gorgeous_moon",
    passiveRequirement: "crown",
    levelBonuses: dmgCdPattern(14, -200),
  },
  gorgeous_moon: {
    id: "gorgeous_moon",
    name: "Lunar Bloom",
    maxLevel: 8,
    baseDamage: 95,
    baseCooldownMs: 3600,
    baseArea: 1.2,
    baseSpeed: 0.94,
    baseCount: 1,
    loopKind: "pentagram_shock",
    evolvesFromWeaponId: "pentagram",
    levelBonuses: dmgCdPattern(18, -160),
  },
} as const satisfies Record<string, WeaponData>;

/** Phase-4 baseline weapons offered before evolutions overwrite them. */
export const BASE_WEAPON_INVENTORY_IDS: string[] = [
  "knife",
  "axe",
  "cross",
  "king_bible",
  "fire_wand",
  "garlic",
  "santa_water",
  "runetracer",
  "lightning_ring",
  "pentagram",
];

export type KnownWeaponKind = keyof typeof WEAPON_DATABASE;

export function requireWeapon(weaponId: string): WeaponData {
  const data = WEAPON_DATABASE[weaponId as KnownWeaponKind];
  if (data === undefined) {
    throw new Error(`Missing weapon authoring entry "${weaponId}".`);
  }
  return data;
}

export interface MergedWeaponStats {
  damage: number;
  cooldownMs: number;
  areaMultiplier: number;
  speedMultiplier: number;
  durationMultiplier: number;
  count: number;
}

export function resolveWeaponMergedStats(
  data: WeaponData,
  weaponLevel: number,
  passiveBonusAmountFlat: number,
): MergedWeaponStats {
  let damage = data.baseDamage;
  let cooldownMs = data.baseCooldownMs;
  let area = data.baseArea;
  let speed = data.baseSpeed;
  let count = data.baseCount + passiveBonusAmountFlat;

  const clampedWeaponLevel = Math.min(Math.max(weaponLevel, 1), data.maxLevel);

  const stackingDepth = Math.min(
    Math.max(clampedWeaponLevel - 1, 0),
    data.levelBonuses.length,
  );
  for (let i = 0; i < stackingDepth; i += 1) {
    const bonus = data.levelBonuses[i];
    if (bonus === undefined) {
      break;
    }
    damage += bonus.baseDamage ?? 0;
    cooldownMs += bonus.baseCooldownMs ?? 0;
    area += bonus.baseArea ?? 0;
    speed += bonus.baseSpeed ?? 0;
    count += bonus.baseCount ?? 0;
  }

  count = Math.min(Math.max(Math.round(count), 1), 16);

  return {
    damage: Math.max(1, damage),
    cooldownMs: Math.max(60, cooldownMs),
    areaMultiplier: Math.max(0.25, area),
    speedMultiplier: Math.max(0.2, speed),
    durationMultiplier: 1,
    count,
  };
}

/**
 * Amplifies authored weapon merges with Survivor passive tables (might, cooldown, area, speed).
 */
export function amplifyMergedWeaponDamageProfile(
  bundle: MergedWeaponStats,
  passive: PassiveCombatTotals,
): MergedWeaponStats {
  return {
    damage: Math.max(1, Math.floor(bundle.damage * passive.mightMultiplier)),
    cooldownMs: Math.max(
      55,
      Math.floor(bundle.cooldownMs * passive.cooldownMultiplier),
    ),
    areaMultiplier: Math.max(
      0.1,
      bundle.areaMultiplier * passive.areaMultiplierPassive,
    ),
    speedMultiplier: Math.max(
      0.12,
      bundle.speedMultiplier * passive.projectileSpeedMultiplier,
    ),
    durationMultiplier: Math.max(
      0.1,
      bundle.durationMultiplier * passive.durationMultiplierPassive,
    ),
    count: Math.max(1, Math.round(bundle.count)),
  };
}
