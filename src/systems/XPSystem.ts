import type { ObjectPool } from "../core/ObjectPool";
import type { ExperienceGem } from "../entities/XPGem";
import type { Player } from "../entities/Player";
import { squaredDistance } from "../utils/math";

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

    this.gemPool.forEachActive((gem) => {
      if (!gem.active) {
        return;
      }

      if (
        squaredDistance(gem.x, gem.y, this.player.x, this.player.y) <= magnetSq
      ) {
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
