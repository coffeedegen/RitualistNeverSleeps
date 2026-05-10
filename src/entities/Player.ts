import { requirePassive } from "../data/passives";
import type { SurvivorPassiveSnapshot } from "../data/passives";
import { getWeaponEvolutionRule } from "../data/weaponEvolutions";
import { BASE_WEAPON_INVENTORY_IDS, requireWeapon } from "../data/weapons";
import {
  INITIAL_WHIP_WEAPON_LEVEL,
  PLAYER_BASE_MOVE_SPEED,
  PLAYER_DEFAULT_GROWTH,
  PLAYER_START_LUCK,
  PLAYER_START_MAGNET_PX,
  PLAYER_START_MAX_HP,
} from "../utils/constants";

export const MAX_WEAPON_SLOTS = 6;

export const MAX_PASSIVE_SLOTS = 6;
const PLAYER_HURT_ANIMATION_MS = 180;

export interface WeaponLane {
  id: string;
  level: number;
}

export interface PassiveLane {
  id: string;
  level: number;
}

/**
 * Survivor avatar with explicit weapon / passive lanes mirrored from Vampire Survivors.
 */
export class Player {
  x = 0;

  y = 0;

  lastFacingX = 1;

  lastFacingY = 0;

  maxHp = PLAYER_START_MAX_HP;

  hp = PLAYER_START_MAX_HP;

  invulnerabilityMs = 0;

  hurtAnimationMs = 0;

  moveSpeed = PLAYER_BASE_MOVE_SPEED;

  magnetRadiusPx = PLAYER_START_MAGNET_PX;

  growth = PLAYER_DEFAULT_GROWTH;

  luck = PLAYER_START_LUCK;

  survivorLevel = 1;

  currentXpScore = 0;

  xpBudgetForNextLevel = 70;

  armorFlat = 0;

  regenerationPerSecondFromPassives = 0;

  manualMoveBonus = 0;

  manualMagnetBonus = 0;

  manualMaxHpBonus = 0;

  manualLuckBonus = 0;

  manualGrowthBonus = 0;

  weaponLanes: WeaponLane[] = [
    { id: "whip", level: INITIAL_WHIP_WEAPON_LEVEL }
  ];

  passiveLanes: PassiveLane[] = [];

  /**
   * Applies aggregated passive rows to transient combat + mobility stats.
   */
  applyPassiveSnapshot(snapshot: SurvivorPassiveSnapshot): void {
    this.moveSpeed =
      (PLAYER_BASE_MOVE_SPEED + this.manualMoveBonus) *
      (1 + snapshot.moveSpeedPctTotal);

    this.magnetRadiusPx =
      (PLAYER_START_MAGNET_PX + this.manualMagnetBonus) *
      (1 + snapshot.magnetPctTotal);

    const fusedMaxHp = Math.floor(
      (PLAYER_START_MAX_HP + this.manualMaxHpBonus) *
      snapshot.hpBonusMultiplierFromPassives,
    );

    this.maxHp = Math.max(1, fusedMaxHp);
    if (this.hp > this.maxHp) {
      this.hp = this.maxHp;
    }

    this.luck = PLAYER_START_LUCK + this.manualLuckBonus + snapshot.luckFlatTotal;
    this.growth =
      PLAYER_DEFAULT_GROWTH * (1 + snapshot.growthPctTotal) +
      this.manualGrowthBonus;

    this.armorFlat = snapshot.armorFlatTotal;
    this.regenerationPerSecondFromPassives = snapshot.regenerationPerSecond;
  }

  /**
   * Locomotion + caches last aim for weapon targeting.
   */
  update(dtMs: number, axes: { x: number; y: number }): void {
    if (this.invulnerabilityMs > 0) {
      this.invulnerabilityMs = Math.max(0, this.invulnerabilityMs - dtMs);
    }

    if (this.hurtAnimationMs > 0) {
      this.hurtAnimationMs = Math.max(0, this.hurtAnimationMs - dtMs);
    }

    const seconds = dtMs / 1000;

    const len = Math.hypot(axes.x, axes.y);
    if (len > 0.001) {
      this.lastFacingX = axes.x / len;
      this.lastFacingY = axes.y / len;
    }

    this.x += axes.x * this.moveSpeed * seconds;
    this.y += axes.y * this.moveSpeed * seconds;
  }

  receiveDamage(rawDamage: number): void {
    if (this.invulnerabilityMs > 0) {
      return;
    }

    const damage = Math.max(1, Math.floor(rawDamage) - this.armorFlat);
    this.hp -= damage;
    this.invulnerabilityMs = 500; // Half a second of i-frames
    this.hurtAnimationMs = PLAYER_HURT_ANIMATION_MS;

    if (this.hp < 0) {
      this.hp = 0;
    }
  }

  ownsWeapon(weaponId: string): boolean {
    return this.weaponLanes.some((lane) => lane.id === weaponId);
  }

  passiveMeetsRequirement(passiveId: string, minLevel: number): boolean {
    const row = this.passiveLanes.find((lane) => lane.id === passiveId);
    return row !== undefined && row.level >= minLevel;
  }

  /** Attempts to add a brand-new weapon lane (level 1). */
  tryAddWeapon(weaponId: string): boolean {
    if (this.weaponLanes.length >= MAX_WEAPON_SLOTS) {
      return false;
    }

    const authoring = requireWeapon(weaponId);
    if (authoring.evolvesFromWeaponId !== undefined) {
      return false;
    }

    if (this.weaponLanes.some((lane) => lane.id === weaponId)) {
      return false;
    }

    this.weaponLanes.push({ id: weaponId, level: 1 });
    return true;
  }

  /** Increments weapon level respecting {@link WeaponData.maxLevel}. */
  elevateWeapon(weaponId: string): boolean {
    const lane = this.weaponLanes.find((slot) => slot.id === weaponId);
    if (lane === undefined) {
      return false;
    }

    const data = requireWeapon(weaponId);
    if (lane.level >= data.maxLevel) {
      return false;
    }

    lane.level += 1;
    return true;
  }

  /**
   * Upgrades baseline weapons into their evolved authoring row when prerequisites hold.
   */
  tryEvolveWeapon(baseWeaponId: string): boolean {
    const laneIdx = this.weaponLanes.findIndex(
      (slot) => slot.id === baseWeaponId,
    );
    if (laneIdx === -1) {
      return false;
    }

    const blueprint = requireWeapon(baseWeaponId);
    const evolutionRule = getWeaponEvolutionRule(baseWeaponId);
    if (evolutionRule === undefined) {
      return false;
    }

    const lane = this.weaponLanes[laneIdx];
    if (lane === undefined || lane.level < blueprint.maxLevel) {
      return false;
    }

    for (const passiveId of evolutionRule.catalystPassiveIds) {
      if (!this.passiveMeetsRequirement(passiveId, 1)) {
        return false;
      }
    }

    requireWeapon(evolutionRule.evolvedWeaponId);

    lane.id = evolutionRule.evolvedWeaponId;
    lane.level = 1;
    return true;
  }

  /** Upserts passive lanes (bounded by {@link MAX_PASSIVE_SLOTS}). */
  grantPassiveOrLevel(passiveId: string): boolean {
    const meta = requirePassive(passiveId);
    const lane = this.passiveLanes.find((slot) => slot.id === passiveId);

    if (lane !== undefined) {
      if (lane.level >= meta.maxLevel) {
        return false;
      }
      lane.level += 1;
      return true;
    }

    if (this.passiveLanes.length >= MAX_PASSIVE_SLOTS) {
      return false;
    }

    this.passiveLanes.push({ id: passiveId, level: 1 });
    return true;
  }

  /**
   * Returns weapons that can appear as “new discoveries” excluding equipped + evolved rows.
   */
  listDiscoverableWeapons(): readonly string[] {
    return BASE_WEAPON_INVENTORY_IDS;
  }

  passiveSlotCount(): number {
    return this.passiveLanes.length;
  }

  weaponSlotCount(): number {
    return this.weaponLanes.length;
  }
}
