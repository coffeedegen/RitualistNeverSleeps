import { requireWeapon } from "./weapons";

export interface InventoryWeaponLike {
  id: string;
  level: number;
}

export interface InventoryPassiveLike {
  id: string;
  level: number;
}

export interface EvolutionInventorySnapshot {
  weapons: readonly InventoryWeaponLike[];
  passives: readonly InventoryPassiveLike[];
}

export interface WeaponEvolutionRule {
  baseWeaponId: string;
  evolvedWeaponId: string;
  catalystPassiveIds: readonly string[];
}

export interface ResolvedWeaponEvolution {
  rule: WeaponEvolutionRule;
  baseWeapon: InventoryWeaponLike;
}

export const WEAPON_EVOLUTIONS: readonly WeaponEvolutionRule[] = [
  { baseWeaponId: "whip", evolvedWeaponId: "bloody_tear", catalystPassiveIds: ["hollow_heart"] },
  { baseWeaponId: "magic_wand", evolvedWeaponId: "holy_wand", catalystPassiveIds: ["empty_tome"] },
  { baseWeaponId: "clock_lancet", evolvedWeaponId: "infinite_corridor", catalystPassiveIds: ["silver_ring", "gold_ring"] },
  { baseWeaponId: "bracelet", evolvedWeaponId: "bi_bracelet", catalystPassiveIds: [] },
  { baseWeaponId: "knife", evolvedWeaponId: "thousand_edge", catalystPassiveIds: ["bracer"] },
  { baseWeaponId: "axe", evolvedWeaponId: "death_spiral", catalystPassiveIds: ["candelabrador"] },
  { baseWeaponId: "cross", evolvedWeaponId: "heaven_sword", catalystPassiveIds: ["clover"] },
  { baseWeaponId: "king_bible", evolvedWeaponId: "unholy_vespers", catalystPassiveIds: ["spellbinder"] },
  { baseWeaponId: "fire_wand", evolvedWeaponId: "hellfire", catalystPassiveIds: ["spinach"] },
  { baseWeaponId: "garlic", evolvedWeaponId: "soul_eater", catalystPassiveIds: ["pummarola"] },
  { baseWeaponId: "santa_water", evolvedWeaponId: "la_borra", catalystPassiveIds: ["attractorb"] },
  { baseWeaponId: "runetracer", evolvedWeaponId: "no_future", catalystPassiveIds: ["armor"] },
  { baseWeaponId: "lightning_ring", evolvedWeaponId: "thunder_loop", catalystPassiveIds: ["duplicator"] },
  { baseWeaponId: "pentagram", evolvedWeaponId: "gorgeous_moon", catalystPassiveIds: ["crown"] },
] as const;

function tryResolveRequiredWeaponLevel(baseWeaponId: string): number | null {
  try {
    return requireWeapon(baseWeaponId).maxLevel;
  } catch {
    return null;
  }
}

function passiveRequirementMet(
  inventory: EvolutionInventorySnapshot,
  passiveId: string,
): boolean {
  return inventory.passives.some((passive) => passive.id === passiveId && passive.level >= 1);
}

export function canWeaponEvolutionTrigger(
  inventory: EvolutionInventorySnapshot,
  rule: WeaponEvolutionRule,
): rule is WeaponEvolutionRule {
  const lane = inventory.weapons.find((weapon) => weapon.id === rule.baseWeaponId);
  if (lane === undefined) {
    return false;
  }

  const requiredWeaponLevel = tryResolveRequiredWeaponLevel(rule.baseWeaponId);
  if (requiredWeaponLevel !== null && lane.level < requiredWeaponLevel) {
    return false;
  }

  return rule.catalystPassiveIds.every((passiveId) =>
    passiveRequirementMet(inventory, passiveId),
  );
}

export function getAvailableWeaponEvolutions(
  inventory: EvolutionInventorySnapshot,
): ResolvedWeaponEvolution[] {
  const ready: ResolvedWeaponEvolution[] = [];

  for (const rule of WEAPON_EVOLUTIONS) {
    const baseWeapon = inventory.weapons.find((weapon) => weapon.id === rule.baseWeaponId);
    if (baseWeapon === undefined) {
      continue;
    }

    if (!canWeaponEvolutionTrigger(inventory, rule)) {
      continue;
    }

    ready.push({ rule, baseWeapon });
  }

  return ready;
}

export function CheckForWeaponEvolution(
  inventory: EvolutionInventorySnapshot,
): ResolvedWeaponEvolution | null {
  const [firstReadyEvolution] = getAvailableWeaponEvolutions(inventory);
  return firstReadyEvolution ?? null;
}

export function getWeaponEvolutionRule(
  baseWeaponId: string,
): WeaponEvolutionRule | undefined {
  return WEAPON_EVOLUTIONS.find((rule) => rule.baseWeaponId === baseWeaponId);
}
