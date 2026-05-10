import {
  requireEnemy,
  scaleEnemyHpByTime,
  scaleEnemySpeedByTime,
} from "../data/enemies";
import {
  ELITE_HEALTH_MULTIPLIER,
  ELITE_RADIUS_MULTIPLIER,
  ELITE_SPEED_MULTIPLIER,
} from "../utils/constants";
import { Entity } from "./Entity";

export interface EnemySpawnFlavor {
  /** Extra pressure sourced from Survivor curse passives (>1 ramps enemy power). */
  cursePressureMultiplier: number;
  elite: boolean;
  frozenRemainMs?: number;
}

/**
 * Pooled horde actor that chases the player using simple homing AI.
 */
export class Enemy extends Entity {
  poolIndex = 0;

  enemyTypeId = "";

  /** Stable phase offset so each enemy gets a slightly different chase rhythm. */
  private pathingSeed = 0;

  /** Per-enemy oscillation frequency in Hz. */
  private swayFrequencyHz = 0;

  /** Per-enemy lateral sway magnitude applied while chasing. */
  private swayStrength = 0;

  /** Direction sign used to break up identical homing arcs. */
  private swayDirection = 1;

  /** Remaining freeze time in milliseconds. */
  frozenRemainMs = 0;

  /** Remaining hit flash time in milliseconds. */
  hitFlashRemainMs = 0;

  /** Last normalized steering direction used for sprite facing. */
  facingX = 0;

  /** Last normalized steering direction used for sprite facing. */
  facingY = 1;

  /** Effective chase speed for this spawn instance (world units / sec). */
  private moveSpeedPerSec = 0;

  /** Base damage to deal to the player. */
  baseDamage = 0;

  /** Cached collision/render radius in world px. */
  radiusPx = 0;

  /** Tint pulled from authoring data (`EnemyData`). */
  silhouetteHex = "#ffffff";

  elite = false;

  /** Overrides default gem payout when elites die. */
  gemYield = 1;

  /**
   * Configures pooled enemies at authored wave directives + elite / curse ramps.
   */
  initializeSpawn(
    dataId: string,
    elapsedMinutes: number,
    worldX: number,
    worldY: number,
    flavor: EnemySpawnFlavor,
  ): void {
    const data = requireEnemy(dataId);

    const curseClamp = Math.max(0.5, flavor.cursePressureMultiplier);

    let hpScaled = scaleEnemyHpByTime(data.baseHp, elapsedMinutes) * curseClamp;
    let speedScaled =
      scaleEnemySpeedByTime(data.baseMoveSpeedPerSec, elapsedMinutes) *
      curseClamp;
    let damageScaled = data.baseDamage;
    let radiusWorking = data.radiusPx;

    this.elite = flavor.elite;
    if (flavor.elite) {
      hpScaled *= ELITE_HEALTH_MULTIPLIER;
      speedScaled *= ELITE_SPEED_MULTIPLIER;
      damageScaled *= 1.5;
      radiusWorking *= ELITE_RADIUS_MULTIPLIER;
    }

    this.pathingSeed = Math.random() * Math.PI * 2;
    this.swayFrequencyHz = 0.75 + Math.random() * 0.55;
    this.swayStrength = 0.1 + Math.random() * 0.16;
    this.swayDirection = Math.random() < 0.5 ? -1 : 1;

    this.enemyTypeId = data.id;
    this.silhouetteHex = data.silhouetteHex;
    this.maxHp = Math.max(1, Math.round(hpScaled));
    this.hp = this.maxHp;
    this.moveSpeedPerSec = speedScaled;
    this.baseDamage = Math.max(1, Math.round(damageScaled));
    this.radiusPx = radiusWorking;
    this.x = worldX;
    this.y = worldY;
    this.frozenRemainMs = Math.max(0, flavor.frozenRemainMs ?? 0);
    this.gemYield = flavor.elite ? 5 : 1;
    this.active = true;
    this.hitFlashRemainMs = 0;
    this.facingX = 0;
    this.facingY = 1;
  }

  /**
   * Integrates constant-speed movement directly toward a world-space target.
   * @param targetX Focus X in world units.
   * @param targetY Focus Y in world units.
   * @param dtSeconds Uncapped integration slice in seconds.
   * @param separationX Lateral push away from nearby enemies.
   * @param separationY Lateral push away from nearby enemies.
   * @param elapsedSeconds Absolute run time used to keep each enemy's sway unique.
   */
  updateChaseToward(
    targetX: number,
    targetY: number,
    dtSeconds: number,
    separationX = 0,
    separationY = 0,
    elapsedSeconds = 0,
  ): void {
    if (!this.active) {
      return;
    }

    if (this.frozenRemainMs > 0) {
      this.frozenRemainMs = Math.max(0, this.frozenRemainMs - dtSeconds * 1000);
      return;
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const len = Math.hypot(dx, dy);
    if (len <= 1e-6) {
      return;
    }

    const chaseX = dx / len;
    const chaseY = dy / len;
    const tangentX = -chaseY;
    const tangentY = chaseX;
    const swayPhase =
      elapsedSeconds * this.swayFrequencyHz * Math.PI * 2 + this.pathingSeed;
    const sway = Math.sin(swayPhase) * this.swayStrength * this.swayDirection;

    const steerX = chaseX + separationX + tangentX * sway;
    const steerY = chaseY + separationY + tangentY * sway;
    const steerLen = Math.hypot(steerX, steerY);
    if (steerLen <= 1e-6) {
      return;
    }

    const step = this.moveSpeedPerSec * dtSeconds;
    const nx = steerX / steerLen;
    const ny = steerY / steerLen;
    this.facingX = nx;
    this.facingY = ny;
    this.x += nx * step;
    this.y += ny * step;
  }

  flashHit(durationMs = 120): void {
    this.hitFlashRemainMs = Math.max(this.hitFlashRemainMs, durationMs);
  }

  tickVisualState(dtMs: number): void {
    if (this.hitFlashRemainMs > 0) {
      this.hitFlashRemainMs = Math.max(0, this.hitFlashRemainMs - dtMs);
    }
  }

  /** Clears authoring/runtime cache before handing the slot back via {@link ObjectPool.release}. */
  resetForPool(): void {
    this.hp = 0;
    this.maxHp = 0;
    this.moveSpeedPerSec = 0;
    this.baseDamage = 0;
    this.radiusPx = 0;
    this.enemyTypeId = "";
    this.silhouetteHex = "#ffffff";
    this.elite = false;
    this.gemYield = 1;
    this.pathingSeed = 0;
    this.swayFrequencyHz = 0;
    this.swayStrength = 0;
    this.swayDirection = 1;
    this.frozenRemainMs = 0;
    this.hitFlashRemainMs = 0;
    this.facingX = 0;
    this.facingY = 1;
  }

  applyFreeze(durationMs: number): void {
    this.frozenRemainMs = Math.max(this.frozenRemainMs, durationMs);
  }

  isFrozen(): boolean {
    return this.frozenRemainMs > 0;
  }

  /** Applies discrete damage parcels — armour mitigation lands in Phase 5. */
  receiveDamage(hitPoints: number): boolean {
    if (!this.active) {
      return false;
    }

    const dealt = Math.max(1, Math.floor(hitPoints));
    this.hp -= dealt;
    if (this.hp <= 0) {
      this.hp = 0;
      return true;
    }
    return false;
  }
}
