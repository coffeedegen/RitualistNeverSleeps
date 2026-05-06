/**
 * Passive item stat deltas authored per stacking level (`levelBonuses[0]` applies at level 2).
 */
export interface PassiveStatDelta {
  /** Additive projectile / melee damage multiplier (e.g., 0.1 = +10%). */
  mightPct?: number;
  /** Cooldown deltas (negative shortens casts, e.g., -0.08 = −8% duration between shots). */
  cooldownPct?: number;
  /** Area/size scaling for weapon hitboxes / projectiles. */
  areaPct?: number;
  /** Travel speed for projectiles. */
  projectileSpeedPct?: number;
  /** Duration for persistent effects (orbits, poisons, etc.). */
  durationPct?: number;
  /** Flat extra projectiles / burst amount (rounded later). */
  amountFlat?: number;
  /** Flat armor mitigating future damage systems. */
  armorFlat?: number;
  /** Max HP percentage boost. */
  maxHpPct?: number;
  /** Health recovery per second placeholder. */
  recoveryPerSec?: number;
  /** Movement speed percentage. */
  moveSpeedPct?: number;
  /** Magnet range percentage. */
  magnetPct?: number;
  /** Flat luck gain. */
  luckFlat?: number;
  /** XP gain multiplier percentage. */
  growthPct?: number;
  /** Gold analogue / pickup bonus percentage. */
  greedPct?: number;
  /** Curse intensity scaling for enemy pressure. */
  cursePct?: number;
}

export interface PassiveData {
  id: string;
  name: string;
  maxLevel: number;
  levelBonuses: PassiveStatDelta[];
}

export const PASSIVE_DATABASE = {
  spinach: {
    id: "spinach",
    name: "Ironleaf",
    maxLevel: 5,
    levelBonuses: [
      { mightPct: 0.1 },
      { mightPct: 0.1 },
      { mightPct: 0.1 },
      { mightPct: 0.1 },
      { mightPct: 0.1 },
    ],
  },
  armor: {
    id: "armor",
    name: "Bastion Plate",
    maxLevel: 5,
    levelBonuses: [
      { armorFlat: 1 },
      { armorFlat: 1 },
      { armorFlat: 1 },
      { armorFlat: 1 },
      { armorFlat: 1 },
    ],
  },
  hollow_heart: {
    id: "hollow_heart",
    name: "Vessel Heart",
    maxLevel: 5,
    levelBonuses: [
      { maxHpPct: 0.15 },
      { maxHpPct: 0.15 },
      { maxHpPct: 0.15 },
      { maxHpPct: 0.15 },
      { maxHpPct: 0.15 },
    ],
  },
  pummarola: {
    id: "pummarola",
    name: "Ruby Root",
    maxLevel: 5,
    levelBonuses: [
      { recoveryPerSec: 0.35 },
      { recoveryPerSec: 0.35 },
      { recoveryPerSec: 0.35 },
      { recoveryPerSec: 0.35 },
      { recoveryPerSec: 0.35 },
    ],
  },
  empty_tome: {
    id: "empty_tome",
    name: "Hollow Tome",
    maxLevel: 5,
    levelBonuses: [
      { cooldownPct: -0.08 },
      { cooldownPct: -0.08 },
      { cooldownPct: -0.08 },
      { cooldownPct: -0.08 },
      { cooldownPct: -0.08 },
    ],
  },
  candelabrador: {
    id: "candelabrador",
    name: "Flare Lantern",
    maxLevel: 5,
    levelBonuses: [
      { areaPct: 0.1 },
      { areaPct: 0.1 },
      { areaPct: 0.1 },
      { areaPct: 0.1 },
      { areaPct: 0.1 },
    ],
  },
  bracer: {
    id: "bracer",
    name: "Swiftband",
    maxLevel: 5,
    levelBonuses: [
      { durationPct: 0.08 },
      { durationPct: 0.08 },
      { durationPct: 0.08 },
      { durationPct: 0.08 },
      { durationPct: 0.08 },
    ],
  },
  spellbinder: {
    id: "spellbinder",
    name: "Timeweave",
    maxLevel: 5,
    levelBonuses: [
      { durationPct: 0.1 },
      { durationPct: 0.1 },
      { durationPct: 0.1 },
      { durationPct: 0.1 },
      { durationPct: 0.1 },
    ],
  },
  duplicator: {
    id: "duplicator",
    name: "Echo Lens",
    maxLevel: 5,
    levelBonuses: [
      { amountFlat: 1 },
      { amountFlat: 1 },
      { amountFlat: 1 },
      { amountFlat: 1 },
      { amountFlat: 1 },
    ],
  },
  wings: {
    id: "wings",
    name: "Gale Wings",
    maxLevel: 5,
    levelBonuses: [
      { moveSpeedPct: 0.05 },
      { moveSpeedPct: 0.05 },
      { moveSpeedPct: 0.05 },
      { moveSpeedPct: 0.05 },
      { moveSpeedPct: 0.05 },
    ],
  },
  attractorb: {
    id: "attractorb",
    name: "Graviton Seed",
    maxLevel: 5,
    levelBonuses: [
      { magnetPct: 0.12 },
      { magnetPct: 0.12 },
      { magnetPct: 0.12 },
      { magnetPct: 0.12 },
      { magnetPct: 0.12 },
    ],
  },
  clover: {
    id: "clover",
    name: "Fortune Leaf",
    maxLevel: 5,
    levelBonuses: [
      { luckFlat: 0.07 },
      { luckFlat: 0.07 },
      { luckFlat: 0.07 },
      { luckFlat: 0.07 },
      { luckFlat: 0.07 },
    ],
  },
  crown: {
    id: "crown",
    name: "Ascension Crown",
    maxLevel: 5,
    levelBonuses: [
      { growthPct: 0.06 },
      { growthPct: 0.06 },
      { growthPct: 0.06 },
      { growthPct: 0.06 },
      { growthPct: 0.06 },
    ],
  },
  stone_mask: {
    id: "stone_mask",
    name: "Gilded Mask",
    maxLevel: 5,
    levelBonuses: [
      { greedPct: 0.07 },
      { greedPct: 0.07 },
      { greedPct: 0.07 },
      { greedPct: 0.07 },
      { greedPct: 0.07 },
    ],
  },
} as const satisfies Record<string, PassiveData>;

export type PassiveId = keyof typeof PASSIVE_DATABASE;

/**
 * Retrieves passive authoring safely.
 */
export function requirePassive(id: string): PassiveData {
  const row = PASSIVE_DATABASE[id as PassiveId];
  if (row === undefined) {
    throw new Error(`Missing passive entry "${id}".`);
  }
  return row;
}

/** Combat-only passive projection consumed by weapon systems. */
export interface PassiveCombatTotals {
  /** Multiplicative damage scaler for outbound weapon hits. */
  mightMultiplier: number;
  /** Multiplicative cooldown scaler (values < 1 shorten cadence per Hollow Tome). */
  cooldownMultiplier: number;
  /** Passive area multiplier compounded with authored weapon curves. */
  areaMultiplierPassive: number;
  /** Projectile speed scaler. */
  projectileSpeedMultiplier: number;
  /** Persistent effect duration scaler. */
  durationMultiplierPassive: number;
  /** Flat bonus summed into weapon projectile counts pre-rounding. */
  passiveAmountBonus: number;
}

export interface PassiveDerivedSurvivorStats {
  armorFlatTotal: number;
  moveSpeedPctTotal: number;
  magnetPctTotal: number;
  growthPctTotal: number;
  greedPctTotal: number;
  cursePctTotal: number;
  luckFlatTotal: number;
  hpBonusMultiplierFromPassives: number;
  regenerationPerSecond: number;
}

export interface PassiveRuntimeLane {
  id: string;
  level: number;
}

/**
 * Sums authored passive deltas up to each lane's capped level (`levelBonuses[level-2]` analogue).
 */
export function accumulatePassiveSnapshot(
  lanes: PassiveRuntimeLane[],
): PassiveCombatTotals & PassiveDerivedSurvivorStats {
  let mightAccumulator = 0;
  let cooldownAccumulator = 0;
  let areaAccumulator = 0;
  let projectileSpeedAccumulator = 0;
  let durationAccumulator = 0;
  let amountFlatAccumulator = 0;
  let armorFlatAccumulator = 0;
  let maxHpPctAccumulator = 0;
  let recoveryAccumulator = 0;
  let movePctAccumulator = 0;
  let magnetPctAccumulator = 0;
  let luckAccumulator = 0;
  let growthPctAccumulator = 0;
  let greedPctAccumulator = 0;
  let cursePctAccumulator = 0;

  for (const lane of lanes) {
    const passiveRow = PASSIVE_DATABASE[lane.id as PassiveId];
    if (lane.level <= 0 || passiveRow === undefined) {
      continue;
    }

    const cappedLevel = Math.min(lane.level, passiveRow.maxLevel);
    const stackingDepth = Math.min(
      cappedLevel,
      passiveRow.levelBonuses.length,
    );

    for (let tier = 0; tier < stackingDepth; tier += 1) {
      const bundle = passiveRow.levelBonuses[tier];
      if (bundle === undefined) {
        break;
      }
      const delta = bundle as PassiveStatDelta;
      mightAccumulator += delta.mightPct ?? 0;
      cooldownAccumulator += delta.cooldownPct ?? 0;
      areaAccumulator += delta.areaPct ?? 0;
      projectileSpeedAccumulator += delta.projectileSpeedPct ?? 0;
      durationAccumulator += delta.durationPct ?? 0;
      amountFlatAccumulator += delta.amountFlat ?? 0;
      armorFlatAccumulator += delta.armorFlat ?? 0;
      maxHpPctAccumulator += delta.maxHpPct ?? 0;
      recoveryAccumulator += delta.recoveryPerSec ?? 0;
      movePctAccumulator += delta.moveSpeedPct ?? 0;
      magnetPctAccumulator += delta.magnetPct ?? 0;
      luckAccumulator += delta.luckFlat ?? 0;
      growthPctAccumulator += delta.growthPct ?? 0;
      greedPctAccumulator += delta.greedPct ?? 0;
      cursePctAccumulator += delta.cursePct ?? 0;
    }
  }

  return {
    mightMultiplier: Math.max(0.05, 1 + mightAccumulator),
    cooldownMultiplier: Math.max(0.2, 1 + cooldownAccumulator),
    areaMultiplierPassive: Math.max(0.05, 1 + areaAccumulator),
    projectileSpeedMultiplier: Math.max(
      0.15,
      1 + projectileSpeedAccumulator,
    ),
    durationMultiplierPassive: Math.max(0.1, 1 + durationAccumulator),
    passiveAmountBonus: amountFlatAccumulator,
    armorFlatTotal: armorFlatAccumulator,
    magnetPctTotal: magnetPctAccumulator,
    moveSpeedPctTotal: movePctAccumulator,
    growthPctTotal: growthPctAccumulator,
    greedPctTotal: greedPctAccumulator,
    cursePctTotal: cursePctAccumulator,
    luckFlatTotal: luckAccumulator,
    hpBonusMultiplierFromPassives: 1 + maxHpPctAccumulator,
    regenerationPerSecond: recoveryAccumulator,
  };
}

export type SurvivorPassiveSnapshot = ReturnType<
  typeof accumulatePassiveSnapshot
>;

/** Strips non-weapon stat columns for {@link WeaponRuntimeContext}. */
export function slicePassiveCombatTotals(
  snapshot: SurvivorPassiveSnapshot,
): PassiveCombatTotals {
  return {
    mightMultiplier: snapshot.mightMultiplier,
    cooldownMultiplier: snapshot.cooldownMultiplier,
    areaMultiplierPassive: snapshot.areaMultiplierPassive,
    projectileSpeedMultiplier: snapshot.projectileSpeedMultiplier,
    durationMultiplierPassive: snapshot.durationMultiplierPassive,
    passiveAmountBonus: snapshot.passiveAmountBonus,
  };
}
