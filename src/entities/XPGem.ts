import { Entity } from "./Entity";

/**
 * Magnetic XP pickup spawned from defeating enemies until {@link XPSystem} collects it.
 */
export class ExperienceGem extends Entity {
  poolIndex = 0;

  /** Stored XP amount before {@link PLAYER_DEFAULT_GROWTH} multipliers amplify it further. */
  gemValueXp = 1;

  /** Configures pooled gem pickups at corpse locations with baseline reward weighting. */
  initializeDrop(worldX: number, worldY: number, valueXp: number): void {
    this.x = worldX;
    this.y = worldY;
    this.gemValueXp = Math.max(1, Math.round(valueXp));
    this.hp = this.gemValueXp;
    this.maxHp = this.gemValueXp;
    this.active = true;
  }

  /** Returns pooled pickups to dormant state manually before {@link ObjectPool.release}. */
  resetForPool(): void {
    this.gemValueXp = 0;
    this.hp = 0;
    this.maxHp = 0;
  }
}
