import { Camera } from "./core/Camera";
import { GameLoop } from "./core/GameLoop";
import { InputManager } from "./core/InputManager";
import { ObjectPool } from "./core/ObjectPool";
import { SpatialHash } from "./core/SpatialHash";
import {
  accumulatePassiveSnapshot,
  slicePassiveCombatTotals,
  type PassiveCombatTotals,
} from "./data/passives";
import type {
  AxisAlignedDamageRect,
  EnemyDamagePacket,
  ProjectileSpawnPayload,
  WeaponRuntimeContext,
} from "./weapons/WeaponBase";
import { Enemy } from "./entities/Enemy";
import { Projectile, type ProjectileMotionBlueprint } from "./entities/Projectile";
import { Pickup } from "./entities/Pickup";
import { ExperienceGem } from "./entities/XPGem";
import { Player } from "./entities/Player";
import { LevelOfferBuilder } from "./game/LevelOfferBuilder";
import { resolveDirectedSpawnDecision } from "./systems/WaveDirector";
import { EnemySpawner } from "./systems/EnemySpawner";
import { PickupSystem } from "./systems/PickupSystem";
import type { ProjectileCollisionPass } from "./systems/CollisionSystem";
import { integrateAndResolveProjectiles } from "./systems/CollisionSystem";
import { FloatingDamageSystem } from "./systems/FloatingDamageSystem";
import { CombatVfxSystem } from "./systems/CombatVfxSystem";
import { XPSystem } from "./systems/XPSystem";
import { LevelUpUI } from "./systems/LevelUpUI";
import {
  GameOverUI,
  type GameOverUICallbacks,
} from "./systems/GameOverUI";
import { WeaponSystem } from "./systems/WeaponSystem";
import { ScoreSystem } from "./systems/ScoreSystem";
import { HudRenderer, type HudPresentationState } from "./ui/HUD";
import { SoundManager } from "./audio/SoundManager";
import { WalletContext } from "./web3";
import {
  CANVAS_DEFAULT_HEIGHT_PX,
  CANVAS_DEFAULT_WIDTH_PX,
  CHECKER_TILE_SIZE_PX,
  CHECKERBOARD_COLOR_A,
  CHECKERBOARD_COLOR_B,
  ENEMY_SPATIAL_QUERY_INFLATE_PX,
  GEM_PLACEHOLDER_FILL,
  GEM_RADIUS_PX,
  OBJECT_POOL_CAPACITY_ENEMY,
  OBJECT_POOL_CAPACITY_GEM,
  OBJECT_POOL_CAPACITY_PICKUP,
  OBJECT_POOL_CAPACITY_PROJECTILE,
  PLAYER_RADIUS_PX,
  PROJECTILE_BASE_SPEED_WORLD_PX_PER_SEC,
  PROJECTILE_WAND_FILL,
} from "./utils/constants";
import { Debug } from "./utils/debug";
import { circleIntersectsAabb, clampScalar, squaredDistance } from "./utils/math";
import { getActiveWalletLabel } from "./platform/leaderboard/LeaderboardStore";
import {
  resolveDisplayName,
  loadPlayerProfile,
} from "./platform/profile/ProfileStore";
import { getScoreTitle } from "./utils/scoreTitle";
import type { PickupKind } from "./data/pickups";
import { requireEnemy } from "./data/enemies";
import { requirePassive } from "./data/passives";
import { requireWeapon } from "./data/weapons";
import {
  clearCanvas,
  drawInfiniteCheckerboard,
  resizeCanvasToDisplaySize,
} from "./utils/renderer";

/**
 * Orchestrates the vertical slice spanning movement, combat, XP, HUD, and level pauses.
 */
export class Game {
  private readonly canvas: HTMLCanvasElement;

  private readonly loop: GameLoop;

  private readonly input: InputManager;

  private elapsedMs = 0;

  readonly camera = new Camera();

  readonly player = new Player();

  private readonly enemyPool: ObjectPool<Enemy>;

  private readonly enemySpatial = new SpatialHash<Enemy>();

  private readonly enemySpawner: EnemySpawner;

  private readonly gemPool: ObjectPool<ExperienceGem>;

  private readonly pickupPool: ObjectPool<Pickup>;

  private readonly projectilePool: ObjectPool<Projectile>;

  private readonly hashScratchAgents: Enemy[] = [];

  private readonly hashScratchSeen = new Set<Enemy>();

  private readonly enemySeparationScratch = new Map<
    Enemy,
    { x: number; y: number }
  >();

  private readonly projectileCollisionPass: ProjectileCollisionPass;

  private readonly floatingDamage = new FloatingDamageSystem();

  private readonly combatVfx = new CombatVfxSystem();

  private playerHitFlashRemainMs = 0;

  private freezeAllEnemySpawnsUntilMs = 0;

  private readonly xpAuthority: XPSystem;

  private readonly pickupSystem: PickupSystem;

  private readonly weaponSystem: WeaponSystem;

  private readonly levelOfferBuilder: LevelOfferBuilder;

  private readonly hud = new HudRenderer();

  private readonly levelUi: LevelUpUI;

  private readonly gameOverUi: GameOverUI;

  private readonly scoreSystem = new ScoreSystem();

  private readonly sound = SoundManager.getInstance();

  private gameOverResolved = false;

  private readonly weaponRuntime: WeaponRuntimeContext;

  private readonly onResizeBound: () => void;

  /**
   * @param canvas Root gameplay surface (`#game`).
   * @throws {Error} If the 2D context cannot be acquired.
   */
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GameOverUICallbacks,
  ) {
    this.canvas = canvas;
    const ctxSmokeTest = canvas.getContext("2d");
    if (ctxSmokeTest === null) {
      throw new Error("CanvasRenderingContext2D is not available.");
    }

    this.enemyPool = new ObjectPool<Enemy>(
      OBJECT_POOL_CAPACITY_ENEMY,
      () => new Enemy(),
    );
    this.player.applyPassiveSnapshot(
      accumulatePassiveSnapshot(this.player.passiveLanes),
    );
    this.weaponSystem = new WeaponSystem(this.player);
    this.levelOfferBuilder = new LevelOfferBuilder({
      player: this.player,
      weaponAccess: this.weaponSystem,
      refreshDerivedStats: () => {
        this.refreshSurvivorDerivedStats();
      },
    });
    this.enemySpawner = new EnemySpawner(this.enemyPool);

    this.gemPool = new ObjectPool<ExperienceGem>(
      OBJECT_POOL_CAPACITY_GEM,
      () => new ExperienceGem(),
    );

    this.pickupPool = new ObjectPool<Pickup>(
      OBJECT_POOL_CAPACITY_PICKUP,
      () => new Pickup(),
    );

    this.projectilePool = new ObjectPool<Projectile>(
      OBJECT_POOL_CAPACITY_PROJECTILE,
      () => new Projectile(),
    );

    this.projectileCollisionPass = {
      projectilePool: this.projectilePool,
      enemySpatial: this.enemySpatial,
      scratchEnemies: this.hashScratchAgents,
      scratchVisited: this.hashScratchSeen,
      onProjectileStrike: (enemy: Enemy, projectile: Projectile): void => {
        this.applyStrikeDamage(
          enemy,
          projectile.x,
          projectile.y,
          projectile.damageRoll,
        );
      },
    };

    this.levelUi = new LevelUpUI(() => {
      this.kickPromotionPipeline();
    });

    this.gameOverUi = new GameOverUI(callbacks);

    this.xpAuthority = new XPSystem(this.gemPool, this.player);
    XPSystem.initializeSurvivorBudget(this.player);

    this.pickupSystem = new PickupSystem(
      this.pickupPool,
      this.player,
      {
        collectAllExperienceGems: () => {
          this.xpAuthority.collectAllGems();
        },
        clearAllEnemies: () => {
          this.clearAllEnemiesFromPickup();
        },
        freezeAllEnemies: (durationMs: number) => {
          this.freezeAllEnemies(durationMs);
        },
        healPlayer: (amount: number) => {
          this.healPlayer(amount);
        },
        emitPickupFloater: (label: string, worldX: number, worldY: number) => {
          this.floatingDamage.spawnFloater(worldX, worldY, label);
        },
        spawnPickupBurst: (
          pickupKind: PickupKind,
          worldX: number,
          worldY: number,
        ) => {
          this.combatVfx.spawnPickupBurst(pickupKind, worldX, worldY);
        },
      },
    );

    const starterCombatTotals = slicePassiveCombatTotals(
      accumulatePassiveSnapshot(this.player.passiveLanes),
    );

    this.weaponRuntime = {
      dtMs: 0,
      passiveCombat: starterCombatTotals,
      playerOriginX: 0,
      playerOriginY: 0,
      aimX: 1,
      aimY: 0,
      spawnSkillBurst: (worldX: number, worldY: number, color: string, scale?: number): void => {
        this.combatVfx.spawnSkillBurst(worldX, worldY, color, scale);
      },
      applyWeaponDamage: (packet: EnemyDamagePacket): void => {
        this.applyStrikeDamage(
          packet.enemy,
          packet.impactWorldX,
          packet.impactWorldY,
          packet.damagePayload,
        );
      },
      spawnDirectedProjectile: (payload: ProjectileSpawnPayload): boolean => {
        return this.spawnDirectedProjectilePayload(payload);
      },
      forEachEnemyIntersectingRect: (
        rect: AxisAlignedDamageRect,
        visitor: (enemy: Enemy) => void,
      ): void => {
        this.forEachEnemyInAttackRect(rect, visitor);
      },
      forEachEnemyInDisc: (
        centerX: number,
        centerY: number,
        radius: number,
        visitor: (enemy: Enemy) => void,
      ): void => {
        this.forEachEnemyInCircularBand(centerX, centerY, radius, visitor);
      },
      findNearestEnemy: (originX: number, originY: number): Enemy | undefined => {
        return this.findClosestEnemy(originX, originY);
      },
      pickRandomEnemyCandidate: (): Enemy | undefined => {
        return this.pickRandomEnemy();
      },
    };

    this.input = new InputManager();
    this.loop = new GameLoop(canvas, (dt) => this.update(dt), (c) =>
      this.render(c),
    );

    this.onResizeBound = () => {
      this.applyResize();
    };
    window.addEventListener("resize", this.onResizeBound);
    canvas.style.display = "block";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";

    this.applyResize();
    Debug.log("Game constructed");
  }

  /**
   * Brings the RAF loop online.
   */
  start(): void {
    this.sound.unlock();
    this.loop.start();
    Debug.log("Game loop running");
  }

  /**
   * Dev helper: opens the Game Over overlay immediately without requiring a full run.
   * Does not persist a leaderboard entry.
   */
  debugOpenGameOverOverlay(): void {
    if (this.gameOverUi.isBannerOpen()) {
      return;
    }
    const capturedAt = Date.now();
    const previewScore = this.scoreSystem.getLiveScore(this.player.survivorLevel);
    this.gameOverResolved = true;
    this.gameOverUi.present(this.buildRunCardSummary(previewScore, capturedAt));
    this.sound.play("gameOver");
  }

  /**
   * Tears down listeners and stops the RAF loop — call before hot-reload teardown.
   */
  dispose(): void {
    window.removeEventListener("resize", this.onResizeBound);
    this.loop.stop();
    this.input.dispose();
    this.levelUi.dispose();
    this.gameOverUi.dispose();
    Debug.log("Game disposed");
  }

  /**
   * Recomputes backing-store resolution and pushes viewport metrics into {@link Camera}.
   */
  applyResize(): void {
    resizeCanvasToDisplaySize(this.canvas);
    const w =
      this.canvas.clientWidth > 0
        ? this.canvas.clientWidth
        : CANVAS_DEFAULT_WIDTH_PX;
    const h =
      this.canvas.clientHeight > 0
        ? this.canvas.clientHeight
        : CANVAS_DEFAULT_HEIGHT_PX;
    this.camera.setViewportCss(w, h);
  }

  private update(dtMs: number): void {
    if (
      !this.gameOverResolved &&
      this.player.hp <= 0 &&
      !this.gameOverUi.isBannerOpen()
    ) {
      const wallet = getActiveWalletLabel();
      const capturedAt = Date.now();
      const finalScore = this.scoreSystem.saveRun(
        wallet,
        this.player.survivorLevel,
      );
      this.gameOverResolved = true;
      this.gameOverUi.present(this.buildRunCardSummary(finalScore, capturedAt));
      this.sound.play("gameOver");
    }

    const worldSimActive = !this.levelUi.isBannerOpen() && !this.gameOverUi.isBannerOpen();
    const dtSecs = dtMs / 1000;

    const passivePortrait = accumulatePassiveSnapshot(this.player.passiveLanes);
    this.player.applyPassiveSnapshot(passivePortrait);
    this.assignPassiveCombatTotals(slicePassiveCombatTotals(passivePortrait));

    const axes = worldSimActive ? this.input.getMovementAxes() : { x: 0, y: 0 };
    this.player.update(dtMs, axes);
    this.camera.follow(this.player.x, this.player.y);

    if (worldSimActive) {
      this.elapsedMs += dtMs;

      const regenSlice = passivePortrait.regenerationPerSecond * dtSecs;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + regenSlice);

      const cursePressure = Math.max(0.4, 1 + passivePortrait.cursePctTotal);

      this.enemySpawner.update(dtMs, {
        camera: this.camera,
        elapsedMs: this.elapsedMs,
        frozenUntilMs: this.freezeAllEnemySpawnsUntilMs,
        cursePressureMultiplier: cursePressure,
        rollSpawnDecision: () =>
          resolveDirectedSpawnDecision(this.elapsedMs, Math),
      });

      this.rebuildEnemySpatialHash();
      this.enemySeparationScratch.clear();
      this.enemyPool.forEachActive((enemy) => {
        this.enemySeparationScratch.set(
          enemy,
          this.computeEnemySeparation(enemy),
        );
      });
      this.enemyPool.forEachActive((enemy) => {
        const separation = this.enemySeparationScratch.get(enemy) ?? {
          x: 0,
          y: 0,
        };
        enemy.updateChaseToward(
          this.player.x,
          this.player.y,
          dtSecs,
          separation.x,
          separation.y,
          this.elapsedMs / 1000,
        );

        enemy.tickVisualState(dtMs);

        if (enemy.isFrozen()) {
          return;
        }

        const reach = PLAYER_RADIUS_PX + enemy.radiusPx;
        if (
          squaredDistance(this.player.x, this.player.y, enemy.x, enemy.y) <=
          reach * reach
        ) {
          const hpBefore = this.player.hp;
          this.player.receiveDamage(enemy.baseDamage);
          if (this.player.hp < hpBefore) {
            this.playerHitFlashRemainMs = 220;
            this.hud.notifyHit();
            this.combatVfx.spawnImpactBurst(
              this.player.x,
              this.player.y,
              "#ff6b7a",
              1.5,
            );
            this.sound.play("hit");
          }
        }

      });

      this.rebuildEnemySpatialHash();

      this.primeWeaponRuntime(dtMs);
      this.weaponSystem.tick(this.weaponRuntime);
      integrateAndResolveProjectiles(this.projectileCollisionPass, dtMs);

      this.pickupSystem.update(true);
      this.xpAuthority.updateGemCollection(true);
      this.scoreSystem.tick(dtMs);
      this.kickPromotionPipeline();

      this.combatVfx.update(dtMs);
      this.floatingDamage.update(dtMs);
      this.playerHitFlashRemainMs = Math.max(0, this.playerHitFlashRemainMs - dtMs);
    }
  }

  private assignPassiveCombatTotals(source: PassiveCombatTotals): void {
    this.weaponRuntime.passiveCombat = { ...source };
  }

  private healPlayer(amount: number): void {
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
    if (amount > 0) {
      this.sound.play("pickup");
    }
  }

  private freezeAllEnemies(durationMs: number): void {
    this.freezeAllEnemySpawnsUntilMs = Math.max(
      this.freezeAllEnemySpawnsUntilMs,
      this.elapsedMs + durationMs,
    );

    this.enemyPool.forEachActive((enemy) => {
      enemy.applyFreeze(durationMs);
    });
  }

  private clearAllEnemiesFromPickup(): void {
    const victims: Enemy[] = [];
    this.enemyPool.forEachActive((enemy) => {
      victims.push(enemy);
    });

    if (victims.length === 0) {
      return;
    }

    this.floatingDamage.spawnFloater(this.player.x, this.player.y, "ROSARY");
    this.sound.play("pickup");

    for (const enemy of victims) {
      if (!enemy.active) {
        continue;
      }

      const gx = enemy.x;
      const gy = enemy.y;
      const gemYield = enemy.gemYield;
      this.combatVfx.spawnDeathBurst(gx, gy, enemy.silhouetteHex, enemy.elite);
      enemy.resetForPool();
      this.enemyPool.release(enemy);
      this.scoreSystem.registerKill(enemy.enemyTypeId || "unknown");
      this.xpAuthority.spawnGem(gx, gy, gemYield);
      this.sound.play("kill");
    }
  }

  private rebuildEnemySpatialHash(): void {
    this.enemySpatial.clear();
    this.enemyPool.forEachActive((enemy) => this.enemySpatial.insert(enemy));
  }

  private primeWeaponRuntime(dtMs: number): void {
    this.weaponRuntime.dtMs = dtMs;
    this.weaponRuntime.playerOriginX = this.player.x;
    this.weaponRuntime.playerOriginY = this.player.y;
    this.weaponRuntime.aimX = this.player.lastFacingX;
    this.weaponRuntime.aimY = this.player.lastFacingY;
  }

  private render(ctx: CanvasRenderingContext2D): void {
    clearCanvas(ctx, this.canvas);

    const cssW =
      this.canvas.clientWidth > 0
        ? this.canvas.clientWidth
        : CANVAS_DEFAULT_WIDTH_PX;
    const cssH =
      this.canvas.clientHeight > 0
        ? this.canvas.clientHeight
        : CANVAS_DEFAULT_HEIGHT_PX;

    ctx.save();
    this.camera.applyWorldTransform(ctx);
    drawInfiniteCheckerboard(
      ctx,
      CHECKER_TILE_SIZE_PX,
      CHECKERBOARD_COLOR_A,
      CHECKERBOARD_COLOR_B,
      this.camera.viewBoundsWorld,
    );

    this.gemPool.forEachActive((gem) => {
      const burstAlpha = Math.max(0, gem.burstRemainMs / 180);
      const pullAlpha = Math.max(0.16, Math.min(0.92, 0.45 + burstAlpha * 0.35));
      const trailX = gem.x - gem.vx * 0.018;
      const trailY = gem.y - gem.vy * 0.018;

      ctx.save();
      ctx.globalAlpha = pullAlpha * 0.55;
      ctx.strokeStyle = "#dffcff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(trailX, trailY);
      ctx.lineTo(gem.x, gem.y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.34 + burstAlpha * 0.14;
      ctx.strokeStyle = burstAlpha > 0 ? "#f4fbff" : "#8ef0a2";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(gem.x, gem.y, GEM_RADIUS_PX + 4 + burstAlpha * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = GEM_PLACEHOLDER_FILL;
      ctx.beginPath();
      ctx.arc(gem.x, gem.y, GEM_RADIUS_PX, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    this.enemyPool.forEachActive((enemy) => {
      const flash = clampScalar(enemy.hitFlashRemainMs / 120, 0, 1);
      const bodyGradient = ctx.createRadialGradient(
        enemy.x - enemy.radiusPx * 0.28,
        enemy.y - enemy.radiusPx * 0.32,
        Math.max(2, enemy.radiusPx * 0.18),
        enemy.x,
        enemy.y,
        enemy.radiusPx * 1.25,
      );
      bodyGradient.addColorStop(0, this.mixEnemyTint(enemy.silhouetteHex, 0.16 + flash * 0.22));
      bodyGradient.addColorStop(0.68, enemy.silhouetteHex);
      bodyGradient.addColorStop(1, this.mixEnemyTint(enemy.silhouetteHex, -0.22));
      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radiusPx, 0, Math.PI * 2);
      ctx.fill();

      if (flash > 0) {
        ctx.save();
        ctx.globalAlpha = flash * 0.5;
        ctx.strokeStyle = "#fff4ca";
        ctx.lineWidth = Math.max(2, enemy.radiusPx * 0.2);
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radiusPx + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (enemy.elite) {
        const eliteGlow = ctx.createRadialGradient(
          enemy.x,
          enemy.y,
          enemy.radiusPx * 0.5,
          enemy.x,
          enemy.y,
          enemy.radiusPx * 1.5,
        );
        eliteGlow.addColorStop(0, "rgba(255, 230, 120, 0.0)");
        eliteGlow.addColorStop(0.5, "rgba(255, 215, 80, 0.18)");
        eliteGlow.addColorStop(1, "rgba(255, 215, 80, 0.0)");
        ctx.fillStyle = eliteGlow;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radiusPx * 1.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#ffd95a";
        ctx.lineWidth = Math.max(2, enemy.radiusPx * 0.12);
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radiusPx + 2, 0, Math.PI * 2);
        ctx.stroke();
      }

    });

    this.pickupSystem.renderWorld(ctx);

    ctx.fillStyle = PROJECTILE_WAND_FILL;
    this.projectilePool.forEachActive((bolt) => {
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, bolt.collisionRadiusPx, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#e8e8ff";
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, PLAYER_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();

    this.weaponSystem.renderWorld(ctx);
    this.combatVfx.renderWorld(ctx);
    this.floatingDamage.renderWorld(ctx);
    ctx.restore();

    this.drawScreenAtmosphere(ctx, cssW, cssH);
    if (this.playerHitFlashRemainMs > 0) {
      this.drawPlayerHitFlash(ctx, cssW, cssH, this.playerHitFlashRemainMs);
    }

    const snapshot: HudPresentationState = {
      survivorHp: Math.max(0, Math.floor(this.player.hp)),
      survivorMaxHp: Math.max(1, Math.floor(this.player.maxHp)),
      survivorLevel: this.player.survivorLevel,
      xpProgress: this.player.currentXpScore,
      xpBudget: Math.max(1, this.player.xpBudgetForNextLevel),
      elapsedMs: this.elapsedMs,
      score: this.scoreSystem.getLiveScore(this.player.survivorLevel),
    };

    this.hud.draw(ctx, cssW, cssH, snapshot);
    this.levelUi.render(ctx, cssW, cssH);
    this.gameOverUi.render(ctx, cssW, cssH);
  }

  private spawnDirectedProjectilePayload(
    spawn: ProjectileSpawnPayload,
  ): boolean {
    const bolt = this.projectilePool.acquire();
    if (bolt === undefined) {
      return false;
    }

    const dirLen = Math.hypot(spawn.dirX, spawn.dirY);
    if (dirLen <= 1e-5) {
      this.projectilePool.release(bolt);
      return false;
    }

    const nx = spawn.dirX / dirLen;
    const ny = spawn.dirY / dirLen;
    const radial = Math.max(
      3,
      spawn.projectileRadiusPxBase * Math.sqrt(Math.max(spawn.areaMultiplier, 0.25)),
    );
    const speed =
      PROJECTILE_BASE_SPEED_WORLD_PX_PER_SEC * spawn.speedMultiplier;

    const payload: ProjectileMotionBlueprint = {
      worldX: spawn.originX,
      worldY: spawn.originY,
      vxWorldPerSec: nx * speed,
      vyWorldPerSec: ny * speed,
      damagePoints: Math.max(1, Math.floor(spawn.damage)),
      hitRadiusPx: radial,
      ttlRemainMs: spawn.ttlMs,
      gravityYPerSec2:
        spawn.gravityYPerSec2 !== undefined && spawn.gravityYPerSec2 !== 0
          ? spawn.gravityYPerSec2
          : undefined,
      hitQuota: spawn.hitQuota ?? 1,
    };

    bolt.initializeMotion(payload);
    return true;
  }

  private forEachEnemyInAttackRect(
    rect: AxisAlignedDamageRect,
    visitor: (enemy: Enemy) => void,
  ): void {
    const pad = ENEMY_SPATIAL_QUERY_INFLATE_PX;
    this.enemySpatial.queryAabbOverlappingBuckets(
      rect.minX - pad,
      rect.minY - pad,
      rect.maxX + pad,
      rect.maxY + pad,
      this.hashScratchAgents,
      this.hashScratchSeen,
    );

    for (const enemy of this.hashScratchAgents) {
      if (!enemy.active) {
        continue;
      }

      if (
        circleIntersectsAabb(
          enemy.x,
          enemy.y,
          enemy.radiusPx,
          rect.minX,
          rect.minY,
          rect.maxX,
          rect.maxY,
        )
      ) {
        visitor(enemy);
      }
    }
  }

  private forEachEnemyInCircularBand(
    centerX: number,
    centerY: number,
    radius: number,
    visitor: (enemy: Enemy) => void,
  ): void {
    const pad = radius + ENEMY_SPATIAL_QUERY_INFLATE_PX;
    this.enemySpatial.queryAabbOverlappingBuckets(
      centerX - pad,
      centerY - pad,
      centerX + pad,
      centerY + pad,
      this.hashScratchAgents,
      this.hashScratchSeen,
    );

    for (const enemy of this.hashScratchAgents) {
      if (!enemy.active) {
        continue;
      }

      const reach = radius + enemy.radiusPx;
      if (squaredDistance(enemy.x, enemy.y, centerX, centerY) <= reach * reach) {
        visitor(enemy);
      }
    }
  }

  private computeEnemySeparation(enemy: Enemy): { x: number; y: number } {
    const queryPad = enemy.radiusPx + ENEMY_SPATIAL_QUERY_INFLATE_PX;
    this.enemySpatial.queryAabbOverlappingBuckets(
      enemy.x - queryPad,
      enemy.y - queryPad,
      enemy.x + queryPad,
      enemy.y + queryPad,
      this.hashScratchAgents,
      this.hashScratchSeen,
    );

    let steerX = 0;
    let steerY = 0;
    let contributors = 0;

    for (const neighbor of this.hashScratchAgents) {
      if (!neighbor.active || neighbor === enemy) {
        continue;
      }

      const dx = enemy.x - neighbor.x;
      const dy = enemy.y - neighbor.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= 1e-6) {
        const seedAngle =
          (enemy.poolIndex * 0.61803398875 + this.elapsedMs * 0.00091) *
          Math.PI *
          2;
        steerX += Math.cos(seedAngle);
        steerY += Math.sin(seedAngle);
        contributors += 1;
        continue;
      }

      const dist = Math.sqrt(distSq);
      const minimumGap = enemy.radiusPx + neighbor.radiusPx + 8;
      const influenceRadius = minimumGap + 44;
      if (dist >= influenceRadius) {
        continue;
      }

      const closeness = (influenceRadius - dist) / influenceRadius;
      const push = (closeness * closeness) / Math.max(12, dist);
      steerX += dx * push;
      steerY += dy * push;
      contributors += 1;
    }

    if (contributors === 0) {
      return { x: 0, y: 0 };
    }

    const steerLen = Math.hypot(steerX, steerY);
    if (steerLen <= 1e-6) {
      return { x: 0, y: 0 };
    }

    const magnitude = Math.min(0.9, 0.18 + Math.min(6, contributors) * 0.09);
    return {
      x: (steerX / steerLen) * magnitude,
      y: (steerY / steerLen) * magnitude,
    };
  }

  private pickRandomEnemy(): Enemy | undefined {
    const buffer: Enemy[] = [];
    this.enemyPool.forEachActive((enemy) => buffer.push(enemy));

    if (buffer.length === 0) {
      return undefined;
    }

    const index = Math.floor(Math.random() * buffer.length);
    return buffer[index];
  }

  private findClosestEnemy(x: number, y: number): Enemy | undefined {
    let best: Enemy | undefined;
    let bestDist = Number.POSITIVE_INFINITY;

    this.enemyPool.forEachActive((enemy) => {
      const dist = squaredDistance(enemy.x, enemy.y, x, y);
      if (dist < bestDist) {
        bestDist = dist;
        best = enemy;
      }
    });

    return best;
  }

  private applyStrikeDamage(
    enemy: Enemy,
    fxWorld: number,
    fyWorld: number,
    rawDamage: number,
    allowPickupDrop = true,
  ): void {
    if (!enemy.active) {
      return;
    }

    const damage = Math.max(1, Math.floor(rawDamage));
    enemy.flashHit(120);
    this.combatVfx.spawnImpactBurst(
      fxWorld,
      fyWorld,
      enemy.silhouetteHex,
      Math.max(0.8, damage / 24),
    );
    this.floatingDamage.spawnFloater(
      fxWorld,
      fyWorld,
      `${Math.round(damage)}`,
    );

    const killed = enemy.receiveDamage(damage);
    if (!killed) {
      return;
    }

      this.scoreSystem.registerKill(enemy.enemyTypeId || "unknown");

    const gx = enemy.x;
    const gy = enemy.y;
    const gemYield = enemy.gemYield;
    const elite = enemy.elite;
    this.combatVfx.spawnDeathBurst(gx, gy, enemy.silhouetteHex, elite);
    enemy.resetForPool();
    this.enemyPool.release(enemy);
    this.xpAuthority.spawnGem(gx, gy, gemYield);
    if (allowPickupDrop) {
      this.pickupSystem.spawnEnemyDrop(
        gx,
        gy,
        this.player.survivorLevel,
        this.player.luck,
        this.player.hp / Math.max(1, this.player.maxHp),
        elite,
      );
    }
  }

  private buildRunCardSummary(
    finalScore: number,
    capturedAt: number,
  ): import("./systems/RunCardRenderer").RunCardSummary {
    const wallet = WalletContext.getWallet();
    const profile = loadPlayerProfile();
    const resolvedHandle = wallet?.xHandle ?? profile.xHandle;
    const displayName = resolveDisplayName(wallet?.address ?? null, resolvedHandle);
    const xHandle = resolvedHandle ?? null;
    const kills = this.scoreSystem.getKillCount();
    const survivedMs = this.scoreSystem.getSurvivedMs();
    const rankTitle = getScoreTitle(finalScore).title;
    const serialNumber = buildRunCardSerial({
      walletAddress: wallet?.address ?? getActiveWalletLabel(),
      score: finalScore,
      kills,
      survivedMs,
      capturedAt,
    });

    const skills: import("./systems/RunCardRenderer").RunCardSkill[] = [
      ...this.player.weaponLanes.map((lane) => ({
        label: requireWeapon(lane.id).name,
        level: lane.level,
        kind: "weapon" as const,
      })),
      ...this.player.passiveLanes.map((lane) => ({
        label: requirePassive(lane.id).name,
        level: lane.level,
        kind: "passive" as const,
      })),
    ];

    const enemyKills = this.scoreSystem.getKillBreakdown().map((entry) => ({
      label: (() => {
        try {
          return requireEnemy(entry.enemyId).displayName;
        } catch {
          return entry.enemyId;
        }
      })(),
      count: entry.kills,
    }));

    return {
      displayName,
      walletAddress: wallet?.address ?? getActiveWalletLabel(),
      xHandle,
      serialNumber,
      capturedAt,
      rankTitle,
      score: finalScore,
      kills,
      survivedMs,
      level: this.player.survivorLevel,
      skills,
      enemyKills,
    };
  }

  private kickPromotionPipeline(): void {
    if (this.levelUi.isBannerOpen()) {
      return;
    }

    if (!this.xpAuthority.consumeNextLevelIfEligible()) {
      return;
    }

    this.levelUi.presentOffers(this.levelOfferBuilder.composeOffers());
    this.sound.play("levelUp");
  }

  private refreshSurvivorDerivedStats(): void {
    const portrait = accumulatePassiveSnapshot(this.player.passiveLanes);
    this.player.applyPassiveSnapshot(portrait);
    this.assignPassiveCombatTotals(slicePassiveCombatTotals(portrait));
  }

  private drawScreenAtmosphere(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    ctx.save();
    const vignette = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      Math.min(width, height) * 0.12,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.74,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.6, "rgba(0,0,0,0.12)");
    vignette.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  private drawPlayerHitFlash(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    remainMs: number,
  ): void {
    const alpha = clampScalar(remainMs / 220, 0, 1);
    ctx.save();
    ctx.fillStyle = `rgba(255, 74, 106, ${alpha * 0.12})`;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = `rgba(255, 241, 191, ${alpha * 0.5})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, width - 16, height - 16);
    ctx.restore();
  }

  private mixEnemyTint(hex: string, amount: number): string {
    const normalized = hex.replace("#", "");
    if (normalized.length !== 6) {
      return hex;
    }

    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    const mix = (value: number): number => {
      const shifted =
        amount >= 0 ? value + (255 - value) * amount : value * (1 + amount);
      return Math.max(0, Math.min(255, Math.round(shifted)));
    };

    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
  }
}

function buildRunCardSerial(seed: {
  walletAddress: string;
  score: number;
  kills: number;
  survivedMs: number;
  capturedAt: number;
}): string {
  const input = [
    seed.walletAddress,
    seed.score,
    seed.kills,
    seed.survivedMs,
    seed.capturedAt,
  ].join("|");
  const hash = hashString(input);
  return `RNS-${hash.toString(16).toUpperCase().padStart(8, "0")}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
