/** Pickup kinds currently surfaced by the run loop. */
export type PickupKind = "floor_chicken" | "vacuum" | "rosary" | "orologion";

export interface PickupData {
  id: PickupKind;
  name: string;
  unlockLevel: number;
  baseWeight: number;
  radiusPx: number;
  fillHex: string;
  outlineHex: string;
}

export const PICKUP_DATABASE = {
  floor_chicken: {
    id: "floor_chicken",
    name: "Field Ration",
    unlockLevel: 0,
    baseWeight: 6.5,
    radiusPx: 8,
    fillHex: "#ff9b54",
    outlineHex: "#fff1cd",
  },
  vacuum: {
    id: "vacuum",
    name: "Gem Siphon",
    unlockLevel: 12,
    baseWeight: 0.7,
    radiusPx: 9,
    fillHex: "#63d9ff",
    outlineHex: "#e8fbff",
  },
  rosary: {
    id: "rosary",
    name: "Halo Charm",
    unlockLevel: 8,
    baseWeight: 0.9,
    radiusPx: 9,
    fillHex: "#f5d04f",
    outlineHex: "#fff7c6",
  },
  orologion: {
    id: "orologion",
    name: "Chrono Seal",
    unlockLevel: 4,
    baseWeight: 1.2,
    radiusPx: 9,
    fillHex: "#73a8ff",
    outlineHex: "#e7f1ff",
  },
} as const satisfies Record<string, PickupData>;

export interface PickupDropContext {
  survivorLevel: number;
  luck: number;
  hpFraction: number;
  elite: boolean;
  rng: Pick<Math, "random">;
}

export function requirePickup(pickupId: PickupKind): PickupData {
  return PICKUP_DATABASE[pickupId];
}

/**
 * Rolls a utility pickup from the current run snapshot.
 * The distribution is intentionally biased toward Field Ration early, then
 * unlocks stronger screen-control pickups later.
 */
export function rollEnemyPickupDrop(
  context: PickupDropContext,
): PickupKind | undefined {
  const unlockable = Object.values(PICKUP_DATABASE).filter(
    (row) => context.survivorLevel >= row.unlockLevel,
  );
  if (unlockable.length === 0) {
    return undefined;
  }

  const luckBoost = Math.max(0, context.luck - 1);
  const dropChance = Math.min(
    0.24,
    0.055 +
      luckBoost * 0.018 +
      (context.elite ? 0.045 : 0) +
      (context.hpFraction < 0.45 ? 0.015 : 0),
  );

  if (context.rng.random() > dropChance) {
    return undefined;
  }

  const weighted = unlockable.map((row) => {
    let weight = row.baseWeight * (1 + luckBoost * 0.2);

    if (row.id === "floor_chicken") {
      if (context.hpFraction < 0.35) {
        weight *= 5;
      } else if (context.hpFraction < 0.6) {
        weight *= 2.2;
      } else if (context.hpFraction > 0.9) {
        weight *= 0.7;
      }
    }

    if (row.id === "vacuum" && context.survivorLevel < 14) {
      weight *= 0.7;
    }

    if (row.id === "rosary" && context.survivorLevel < 10) {
      weight *= 0.75;
    }

    if (row.id === "orologion" && context.survivorLevel < 6) {
      weight *= 0.8;
    }

    if (context.elite) {
      weight *= 1.15;
    }

    return { row, weight: Math.max(0.05, weight) };
  });

  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return undefined;
  }

  let cursor = context.rng.random() * totalWeight;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.row.id;
    }
  }

  return weighted[weighted.length - 1]?.row.id;
}
