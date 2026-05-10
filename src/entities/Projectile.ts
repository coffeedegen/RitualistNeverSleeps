import { Entity } from "./Entity";

/**
 * Lightweight pooled bolt supporting optional gravity arcs + piercing volleys.
 */
export class Projectile extends Entity {
  poolIndex = 0;

  vxWorldPerSec = 0;

  vyWorldPerSec = 0;

  damageRoll = 0;

  collisionRadiusPx = 5;

  ttlRemainMs = 0;

  gravityAccelPerSec2 = 0;

  strikeQuotaRemaining = 1;

  lastVictimPoolSlot = -1;

  /** Optional debug tint index for projectile rendering palettes. */
  visualTintSeed = 0;

  sourceWeaponId: string | undefined = undefined;

  /** Configures kinematics for the duration of one salvo lifecycle. */
  initializeMotion(payload: ProjectileMotionBlueprint): void {
    this.x = payload.worldX;
    this.y = payload.worldY;
    this.vxWorldPerSec = payload.vxWorldPerSec;
    this.vyWorldPerSec = payload.vyWorldPerSec;
    this.damageRoll = payload.damagePoints;
    this.collisionRadiusPx = payload.hitRadiusPx;
    this.ttlRemainMs = payload.ttlRemainMs;
    this.gravityAccelPerSec2 = payload.gravityYPerSec2 ?? 0;
    this.strikeQuotaRemaining = Math.max(1, Math.round(payload.hitQuota ?? 1));
    this.lastVictimPoolSlot = -1;
    this.visualTintSeed = payload.visualTintSeed ?? 0;
    this.sourceWeaponId = payload.sourceWeaponId;
    this.hp = this.damageRoll;
    this.maxHp = this.damageRoll;
    this.active = true;
  }

  /** Integrates kinematics and expires TTL slots naturally. */
  advance(dtMs: number): boolean {
    if (!this.active) {
      return false;
    }

    const seconds = dtMs / 1000;
    this.ttlRemainMs -= dtMs;
    if (this.ttlRemainMs <= 0) {
      return false;
    }

    this.vyWorldPerSec += this.gravityAccelPerSec2 * seconds;
    this.x += this.vxWorldPerSec * seconds;
    this.y += this.vyWorldPerSec * seconds;
    return true;
  }

  /** Clears motion fields ahead of pooling. */
  resetForPool(): void {
    this.vxWorldPerSec = 0;
    this.vyWorldPerSec = 0;
    this.damageRoll = 0;
    this.collisionRadiusPx = 0;
    this.ttlRemainMs = 0;
    this.hp = 0;
    this.maxHp = 0;
    this.gravityAccelPerSec2 = 0;
    this.strikeQuotaRemaining = 1;
    this.lastVictimPoolSlot = -1;
    this.visualTintSeed = 0;
    this.sourceWeaponId = undefined;
  }
}

export interface ProjectileMotionBlueprint {
  worldX: number;
  worldY: number;
  vxWorldPerSec: number;
  vyWorldPerSec: number;
  damagePoints: number;
  hitRadiusPx: number;
  ttlRemainMs: number;
  gravityYPerSec2?: number;
  /** Total enemies allowed to affect before projectile retires (`1` = default single strike). */
  hitQuota?: number;
  visualTintSeed?: number;
  sourceWeaponId?: string;
}
