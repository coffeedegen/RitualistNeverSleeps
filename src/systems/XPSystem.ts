import type { ObjectPool } from "../core/ObjectPool";
import type { ExperienceGem } from "../entities/XPGem";
import type { Player } from "../entities/Player";
import {
  GEM_RADIUS_PX,
  PLAYER_RADIUS_PX,
} from "../utils/constants";

const XP_REQUIREMENTS_BY_LEVEL: readonly number[] = [
  0,
  28,
  42,
  60,
  82,
  108,
  138,
  172,
  210,
  252,
  298,
  348,
  402,
  460,
  522,
  588,
  658,
  732,
  810,
  892,
  978,
];

/** Encapsulates gem drops + XP accumulation until level-up pauses fire. */
export class XPSystem {
  constructor(
    private readonly gemPool: ObjectPool<ExperienceGem>,
    private readonly player: Player,
  ) {}

  /**
   * Seeds the starting XP budget using the active survivor level.
   */
  static initializeSurvivorBudget(player: Player): void {
    player.xpBudgetForNextLevel = XPSystem.xpRequirementForLevel(
      player.survivorLevel,
    );
  }

  /**
   * Computes how much XP is required to advance from `currentLevel` → `currentLevel + 1`.
   */
  static xpRequirementForLevel(currentLevel: number): number {
    const safeLevel = Math.max(1, currentLevel);
    const authoredRequirement = XP_REQUIREMENTS_BY_LEVEL[safeLevel];
    if (authoredRequirement !== undefined) {
      return authoredRequirement;
    }

    const tailLevel = XP_REQUIREMENTS_BY_LEVEL.length - 1;
    const extraLevels = safeLevel - tailLevel;
    const tailBase = XP_REQUIREMENTS_BY_LEVEL[tailLevel] ?? 978;
    return tailBase + extraLevels * (96 + extraLevels * 12);
  }

  /**
   * Spawns a gem pickup at the provided world location with the requested value.
   */
  spawnGem(worldX: number, worldY: number, value: number): void {
    const gem = this.gemPool.acquire();
    if (gem === undefined) {
      return;
    }
    gem.initializeDrop(worldX, worldY, value);
  }

  /**
   * Magnetizes gems while encounters are simulated.
   */
  updateGemCollection(shouldSimulate: boolean): void {
    if (!shouldSimulate) {
      return;
    }

    const magnet = this.player.magnetRadiusPx;
    const magnetSq = magnet * magnet;
    const pullStart = Math.max(120, magnet * 0.72);
    const pullStartSq = pullStart * pullStart;
    const collectRadius = PLAYER_RADIUS_PX + GEM_RADIUS_PX + 2;
    const collectRadiusSq = collectRadius * collectRadius;

    this.gemPool.forEachActive((gem) => {
      if (!gem.active) {
        return;
      }

      const dx = this.player.x - gem.x;
      const dy = this.player.y - gem.y;
      const distSq = dx * dx + dy * dy;
      gem.pullPhase += 0.12;

      if (distSq <= pullStartSq) {
        const dist = Math.sqrt(Math.max(distSq, 1e-6));
        const nx = dx / dist;
        const ny = dy / dist;
        const tx = -ny;
        const ty = nx;
        const pullStrength = 180 + Math.min(220, this.player.growth * 42);
        const attraction = Math.min(1.7, 0.36 + (1 - dist / pullStart) * 1.28);
        const orbit = Math.sin(gem.pullPhase) * 0.32 * attraction;
        if (gem.burstRemainMs <= 0 && distSq <= magnetSq) {
          gem.burstRemainMs = 180;
        }
        if (gem.burstRemainMs > 0) {
          gem.burstRemainMs = Math.max(0, gem.burstRemainMs - 16);
        }
        gem.vx = gem.vx * 0.84 + nx * pullStrength * attraction + tx * pullStrength * orbit;
        gem.vy = gem.vy * 0.84 + ny * pullStrength * attraction + ty * pullStrength * orbit;
        const burstBoost = gem.burstRemainMs > 0 ? 1.12 : 1;
        gem.x += gem.vx * 0.016 * burstBoost;
        gem.y += gem.vy * 0.016 * burstBoost;
      }

      if (distSq <= magnetSq || distSq <= collectRadiusSq) {
        const award = Math.max(
          1,
          Math.floor(gem.gemValueXp * this.player.growth),
        );
        gem.resetForPool();
        this.gemPool.release(gem);
        this.player.currentXpScore += award;
      }
    });
  }

  /**
   * Instantly gathers every active gem on the field.
   */
  collectAllGems(): number {
    let collected = 0;

    this.gemPool.forEachActive((gem) => {
      if (!gem.active) {
        return;
      }

      const award = Math.max(
        1,
        Math.floor(gem.gemValueXp * this.player.growth),
      );
      gem.vx = 0;
      gem.vy = 0;
      gem.resetForPool();
      this.gemPool.release(gem);
      this.player.currentXpScore += award;
      collected += award;
    });

    return collected;
  }

  /**
   * Drains leftover XP thresholds after the survivor qualifies for promotion.
   * @returns `true` whenever a promotion transaction occurred (`Game` decides when to pause for UI).
   */
  consumeNextLevelIfEligible(): boolean {
    if (this.player.currentXpScore < this.player.xpBudgetForNextLevel) {
      return false;
    }

    this.player.currentXpScore -= this.player.xpBudgetForNextLevel;
    this.player.survivorLevel += 1;
    this.player.xpBudgetForNextLevel = XPSystem.xpRequirementForLevel(
      this.player.survivorLevel,
    );
    return true;
  }
}
