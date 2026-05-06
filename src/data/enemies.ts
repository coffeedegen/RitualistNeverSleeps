import {
  DIFFICULTY_HP_PER_MINUTE,
  DIFFICULTY_SPEED_PER_MINUTE,
} from "../utils/constants";

/**
 * Static authoring record for enemy archetypes.
 */
export interface EnemyData {
  id: string;
  displayName: string;
  /** Unscaled baseline health before elapsed-time multiplier. */
  baseHp: number;
  /** Unscaled chase speed before elapsed-time multiplier (world units/sec). */
  baseMoveSpeedPerSec: number;
  /** Damage dealt to the player on collision. */
  baseDamage: number;
  /** Canonical collision/render radius in world px. */
  radiusPx: number;
  /** Cosmetic placeholder fill used before sprite sheets swap in Phase 5. */
  silhouetteHex: string;
}

export const ENEMY_DATABASE = {
  bat: {
    id: "bat",
    displayName: "Bat",
    baseHp: 8,
    baseMoveSpeedPerSec: 118,
    baseDamage: 5,
    radiusPx: 10,
    silhouetteHex: "#b84a52",
  },
  skeleton: {
    id: "skeleton",
    displayName: "Skeleton",
    baseHp: 11,
    baseMoveSpeedPerSec: 106,
    baseDamage: 8,
    radiusPx: 11,
    silhouetteHex: "#d6d9e8",
  },
  mudman: {
    id: "mudman",
    displayName: "Mudman",
    baseHp: 18,
    baseMoveSpeedPerSec: 95,
    baseDamage: 12,
    radiusPx: 14,
    silhouetteHex: "#7a5b3f",
  },
  mummy: {
    id: "mummy",
    displayName: "Mummy",
    baseHp: 24,
    baseMoveSpeedPerSec: 90,
    baseDamage: 15,
    radiusPx: 14,
    silhouetteHex: "#c8b089",
  },
  mantis: {
    id: "mantis",
    displayName: "Mantis",
    baseHp: 30,
    baseMoveSpeedPerSec: 136,
    baseDamage: 20,
    radiusPx: 13,
    silhouetteHex: "#8bc47a",
  },
} as const satisfies Record<string, EnemyData>;

export type KnownEnemyKind = keyof typeof ENEMY_DATABASE;

/**
 * @param enemyId Canonical enemy id (`EnemyData.id`).
 * @throws {Error} When the authoring entry is missing (programmer error).
 */
export function requireEnemy(enemyId: string): EnemyData {
  const data = ENEMY_DATABASE[enemyId as KnownEnemyKind];
  if (data === undefined) {
    throw new Error(`Missing enemy authoring entry "${enemyId}".`);
  }
  return data;
}

/**
 * Applies the global minute ramp to base HP.
 * @param baseHp Enemy baseline hp from {@link EnemyData}.
 * @param elapsedMinutes Accumulated gameplay minutes (`ms / 60_000`).
 */
export function scaleEnemyHpByTime(
  baseHp: number,
  elapsedMinutes: number,
): number {
  const mult = 1 + elapsedMinutes * DIFFICULTY_HP_PER_MINUTE;
  return Math.max(1, Math.round(baseHp * mult));
}

/**
 * Applies elapsed-time pacing to nominal chase speeds.
 */
export function scaleEnemySpeedByTime(
  baseSpeedPerSec: number,
  elapsedMinutes: number,
): number {
  const mult = 1 + elapsedMinutes * DIFFICULTY_SPEED_PER_MINUTE;
  return baseSpeedPerSec * mult;
}
