import type { PassiveCombatTotals } from "../data/passives";
import type { WeaponData } from "../data/weapons";
import type { Enemy } from "../entities/Enemy";

export interface AxisAlignedDamageRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface EnemyDamagePacket {
  enemy: Enemy;
  impactWorldX: number;
  impactWorldY: number;
  damagePayload: number;
}

export interface ProjectileSpawnPayload {
  originX: number;
  originY: number;
  dirX: number;
  dirY: number;
  damage: number;
  speedMultiplier: number;
  areaMultiplier: number;
  projectileRadiusPxBase: number;
  ttlMs: number;
  gravityYPerSec2?: number;
  /** Total enemies projectile may influence before dismissal (≥1). */
  hitQuota?: number;
}

/** Services shared by melee + ranged weapons (`Weapon.tick` payloads). */
export interface WeaponRuntimeContext {
  dtMs: number;
  passiveCombat: PassiveCombatTotals;
  playerOriginX: number;
  playerOriginY: number;
  aimX: number;
  aimY: number;
  spawnSkillBurst(worldX: number, worldY: number, color: string, scale?: number): void;
  applyWeaponDamage(enemyInput: EnemyDamagePacket): void;
  spawnDirectedProjectile(payload: ProjectileSpawnPayload): boolean;
  forEachEnemyIntersectingRect(
    rect: AxisAlignedDamageRect,
    visitor: (enemy: Enemy) => void,
  ): void;

  /** Filters enemies strictly inside `[center,radius]` after broad-phase hashing. */
  forEachEnemyInDisc(
    centerX: number,
    centerY: number,
    radius: number,
    visitor: (enemy: Enemy) => void,
  ): void;

  findNearestEnemy(originX: number, originY: number): Enemy | undefined;
  pickRandomEnemyCandidate(): Enemy | undefined;
}

/**
 * Canonical weapon runtime scaffold — subclasses own activation cadences.
 */
export abstract class WeaponBase {
  readonly data: WeaponData;

  levelIndex: number;

  protected cooldownRemainMs = 0;

  constructor(authoring: WeaponData, initialLevelIndex: number) {
    this.data = authoring;
    this.levelIndex = Math.min(
      Math.max(initialLevelIndex, 1),
      authoring.maxLevel,
    );
  }

  /** Shared passive cooldown ticking — subclasses call ahead of attacking. */
  protected reduceCooldown(dtMs: number): void {
    if (this.cooldownRemainMs > 0) {
      this.cooldownRemainMs = Math.max(0, this.cooldownRemainMs - dtMs);
    }
  }

  abstract tick(runtime: WeaponRuntimeContext): void;
}
