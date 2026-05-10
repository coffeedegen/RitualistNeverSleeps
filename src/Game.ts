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
  GAMEPLAY_CAMERA_ZOOM,
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
  applyPixelArtRendering,
  clearCanvas,
  drawInfiniteCheckerboard,
  resizeCanvasToDisplaySize,
} from "./utils/renderer";
import { SpriteRegistry } from "./render/SpriteRegistry";
import {
  enemyRenderConfig,
  playerRenderConfig,
  projectileRenderConfig,
} from "./render/renderTuning";
import {
  createGeneratedTilemap,
  getBlockingTileRects,
  getGeneratedTile,
  getPerimeterSpawnLanes,
  getPlayableWorldBounds,
  getPropObstacleRects,
  type GeneratedTilemapData,
  type WorldRect,
} from "./world/generatedTilemap";

interface FrameCompensationOffset {
  x: number;
  y: number;
}

interface SpriteFrameCompensationTable {
  rows: number;
  cols: number;
  offsets: FrameCompensationOffset[][];
}

type FacingDirection = "north" | "south" | "east" | "west";

/**
 * Canonical 4-dir walk-sheet row map for `player_walk_4dir_4f_64.png`.
 * Verified from the current sprite sheet visual order:
 * row 0 = south/front, row 1 = west/left, row 2 = north/back, row 3 = east/right.
 *
 * Key mapping this enforces:
 * W -> north -> row 2
 * A -> west  -> row 1
 * S -> south -> row 0
 * D -> east  -> row 3
 */
const PLAYER_WALK_ROW_BY_FACING: Record<FacingDirection, number> = {
  north: 2,
  west: 1,
  south: 0,
  east: 3,
};

/**
 * Canonical 4-dir walk-sheet row map for enemy directional sheets.
 * Verified from the current enemy atlas visual order:
 * row 0 = south/front, row 1 = west/left, row 2 = north/back, row 3 = east/right.
 *
 * Key mapping this enforces:
 * W -> north -> row 2
 * A -> west  -> row 1
 * S -> south -> row 0
 * D -> east  -> row 3
 */
const ENEMY_WALK_ROW_BY_FACING: Record<FacingDirection, number> = {
  north: 2,
  west: 1,
  south: 0,
  east: 3,
};

const PLAYER_FRAME_COUNT = 4;
const PLAYER_FULL_DIRECTIONAL_ROWS = 4;
const PLAYER_HURT_FRAME_INDEX = 2;

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

  private readonly batSpriteSheet: HTMLImageElement;

  private batSpriteReady = false;

  private readonly sprites = new SpriteRegistry();
  private readonly spriteFrameCompensationCache = new Map<string, SpriteFrameCompensationTable>();
  private readonly terrainMap: GeneratedTilemapData;
  private readonly playableBounds: WorldRect;
  private readonly terrainObstacleRects: WorldRect[];
  private readonly perimeterSpawnLanes: WorldRect[];
  private playerAnimClockMs = 0;
  private playerMoveMagnitude = 0;

  /**
   * @param canvas Root gameplay surface (`#game`).
   * @throws {Error} If the 2D context cannot be acquired.
   */
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GameOverUICallbacks,
  ) {
    this.canvas = canvas;
    this.batSpriteSheet = new Image();
    this.batSpriteSheet.onload = () => {
      this.batSpriteReady = true;
    };
    this.batSpriteSheet.onerror = () => {
      this.batSpriteReady = false;
    };
    this.batSpriteSheet.src = "/assets/characters/enemies/bat/bat_hover_4f_48x48.png";
    this.terrainMap = createGeneratedTilemap();
    this.playableBounds = getPlayableWorldBounds(this.terrainMap);
    this.terrainObstacleRects = [
      ...getBlockingTileRects(this.terrainMap),
      ...getPropObstacleRects(this.terrainMap),
    ];
    this.perimeterSpawnLanes = getPerimeterSpawnLanes(this.terrainMap);
    this.primeSpriteRegistry();

    const ctxSmokeTest = canvas.getContext("2d");
    if (ctxSmokeTest === null) {
      throw new Error("CanvasRenderingContext2D is not available.");
    }
    applyPixelArtRendering(ctxSmokeTest, canvas);

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

    this.camera.setZoom(GAMEPLAY_CAMERA_ZOOM);
    this.applyResize();
    Debug.log("Game constructed");
  }

  private async primeSpriteRegistry(): Promise<void> {
    await Promise.allSettled([
      this.sprites.loadManifest("/assets/manifests/pickups_atlas.json"),
      this.sprites.loadManifest("/assets/manifests/ui_icons_atlas.json"),
      this.sprites.loadManifest("/assets/manifests/weapon_icons_64_atlas.json"),
      this.sprites.loadManifest("/assets/manifests/vfx_medium_atlas.json"),
      this.sprites.loadManifest("/assets/manifests/ritual_tileset_64_atlas.json"),
      this.sprites.loadManifest("/assets/manifests/ritual_props_atlas.json"),
      this.sprites.loadSheet("player_core", "/assets/characters/player/player_core_sheet.png"),
      this.sprites.loadSheet("player_walk_4dir", "/assets/characters/player/player_walk_4dir_4f_64.png"),
      this.sprites.loadSheet("enemy_bat", "/assets/characters/enemies/bat/bat_hover_4f_48x48.png"),
      this.sprites.loadSheet("enemy_skeleton", "/assets/characters/enemies/skeleton/skeleton_anim_sheet.png"),
      this.sprites.loadSheet("enemy_skeleton_4dir", "/assets/characters/enemies/skeleton/skeleton_walk_4dir_4f_64.png"),
      this.sprites.loadSheet("enemy_mudman", "/assets/characters/enemies/mudman/mudman_anim_sheet.png"),
      this.sprites.loadSheet("enemy_mudman_4dir", "/assets/characters/enemies/mudman/mudman_walk_4dir_4f_64.png"),
      this.sprites.loadSheet("enemy_mummy", "/assets/characters/enemies/mummy/mummy_anim_sheet.png"),
      this.sprites.loadSheet("enemy_mummy_4dir", "/assets/characters/enemies/mummy/mummy_walk_4dir_4f_64.png"),
      this.sprites.loadSheet("enemy_mantis", "/assets/characters/enemies/mantis/mantis_anim_sheet.png"),
      this.sprites.loadSheet("enemy_mantis_4dir", "/assets/characters/enemies/mantis/mantis_walk_4dir_4f_64.png"),
    ]);
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
   * Dev helper: opens the Level Up overlay immediately without requiring XP progression.
   */
  debugOpenLevelUpOverlay(): void {
    if (this.levelUi.isBannerOpen() || this.gameOverUi.isBannerOpen()) {
      return;
    }
    this.levelUi.presentOffers(this.levelOfferBuilder.composeOffers());
    this.sound.play("levelUp");
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
    this.resolveCircleMapCollision(this.player, PLAYER_RADIUS_PX);
    this.updatePlayerAnimationClock(dtMs, axes);
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
        spawnLanes: this.perimeterSpawnLanes,
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
        this.resolveCircleMapCollision(enemy, enemy.radiusPx);

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
    applyPixelArtRendering(ctx, this.canvas);

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
    if (!this.drawGeneratedTerrain(ctx)) {
      drawInfiniteCheckerboard(
        ctx,
        CHECKER_TILE_SIZE_PX,
        CHECKERBOARD_COLOR_A,
        CHECKERBOARD_COLOR_B,
        this.camera.viewBoundsWorld,
      );
    }

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
      if (this.drawEnemySprite(ctx, enemy)) {
        return;
      }

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

    this.pickupSystem.renderWorld(ctx, this.sprites);

    this.projectilePool.forEachActive((bolt) => {
      const projectileDrawn = this.drawProjectileSprite(ctx, bolt);
      if (!projectileDrawn) {
        ctx.fillStyle = PROJECTILE_WAND_FILL;
        ctx.beginPath();
        ctx.arc(bolt.x, bolt.y, bolt.collisionRadiusPx, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    if (!this.drawPlayerSprite(ctx)) {
      ctx.fillStyle = "#e8e8ff";
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, PLAYER_RADIUS_PX, 0, Math.PI * 2);
      ctx.fill();
    }

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

    this.hud.draw(ctx, cssW, cssH, snapshot, this.sprites);
    this.levelUi.render(ctx, cssW, cssH);
    this.gameOverUi.render(ctx, cssW, cssH);
  }

  private drawEnemySprite(
    ctx: CanvasRenderingContext2D,
    enemy: Enemy,
  ): boolean {
    if (enemy.enemyTypeId === "bat" && this.batSpriteReady) {
      // 4-frame hover loop: up -> mid -> down -> mid
      const tuning = enemyRenderConfig.bat
        ?? { frameMsMove: 120, frameMsIdle: 140, frozenFrameMs: 280, drawScale: 3.8, anchor: { x: 0, y: 0 } };
      const frameCount = 4;
      const frameW = 48;
      const frameH = 48;
      const frameMs = tuning.frameMsMove;
      const frameIndex = Math.floor(this.elapsedMs / frameMs) % frameCount;

      const drawSize = enemy.radiusPx * tuning.drawScale;
      const comp = this.resolveEnemyFrameCompensation(
        "bat",
        this.batSpriteSheet,
        frameW,
        frameH,
        1,
        frameCount,
        0,
        frameIndex,
      );
      const compScale = drawSize / frameW;
      const x = enemy.x - drawSize / 2 + tuning.anchor.x + comp.x * compScale;
      const y = enemy.y - drawSize / 2 + tuning.anchor.y + comp.y * compScale;

      if (enemy.elite) {
        const eliteGlow = ctx.createRadialGradient(
          enemy.x,
          enemy.y,
          enemy.radiusPx * 0.55,
          enemy.x,
          enemy.y,
          enemy.radiusPx * 1.8,
        );
        eliteGlow.addColorStop(0, "rgba(255, 230, 120, 0.0)");
        eliteGlow.addColorStop(0.58, "rgba(255, 215, 80, 0.2)");
        eliteGlow.addColorStop(1, "rgba(255, 215, 80, 0.0)");
        ctx.fillStyle = eliteGlow;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radiusPx * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      const flash = clampScalar(enemy.hitFlashRemainMs / 120, 0, 1);
      if (flash > 0) {
        ctx.save();
        ctx.globalAlpha = flash * 0.45;
        ctx.strokeStyle = "#fff4ca";
        ctx.lineWidth = Math.max(1.6, enemy.radiusPx * 0.14);
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radiusPx + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.drawImage(
        this.batSpriteSheet,
        frameIndex * frameW,
        0,
        frameW,
        frameH,
        x,
        y,
        drawSize,
        drawSize,
      );

      return true;
    }

    const directionalSheet = this.sprites.getSheet(`enemy_${enemy.enemyTypeId}_4dir`);
    const fallbackSheet = this.sprites.getSheet(`enemy_${enemy.enemyTypeId}`);
    const sheet = directionalSheet ?? fallbackSheet;
    if (sheet === undefined) {
      return false;
    }

    const tuning = enemyRenderConfig[enemy.enemyTypeId]
      ?? { frameMsMove: 140, frameMsIdle: 220, frozenFrameMs: 320, drawScale: 4.2, anchor: { x: 0, y: 0 } };
    const frameCount = 4;
    const frameW = 64;
    const frameH = 64;
    const frameMs = enemy.isFrozen() ? tuning.frozenFrameMs : tuning.frameMsMove;
    const phase = enemy.poolIndex * 37;
    const frameIndex = Math.floor((this.elapsedMs + phase) / frameMs) % frameCount;
    const isDirectionalSheet = directionalSheet !== undefined && sheet.naturalHeight >= frameH * 4;
    const facing = this.resolveFacingDirection(enemy.facingX, enemy.facingY);
    const row = this.resolveEnemySpriteRow(facing, isDirectionalSheet, enemy.isFrozen());
    const compRows = isDirectionalSheet ? 4 : Math.max(1, Math.floor(sheet.naturalHeight / frameH));
    const comp = this.resolveEnemyFrameCompensation(
      enemy.enemyTypeId,
      sheet,
      frameW,
      frameH,
      compRows,
      frameCount,
      row,
      frameIndex,
    );
    const flipX = this.shouldFlipEnemySprite(facing, isDirectionalSheet);
    const srcX = frameIndex * frameW;
    const srcY = row * frameH;
    const drawSize = enemy.radiusPx * tuning.drawScale;
    const compScale = drawSize / frameW;
    const x = Math.floor(enemy.x - drawSize / 2 + tuning.anchor.x + comp.x * compScale);
    const y = Math.floor(enemy.y - drawSize / 2 + tuning.anchor.y + comp.y * compScale);
    ctx.save();
    if (flipX) {
      ctx.translate(x + drawSize * 0.5, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(x + drawSize * 0.5), 0);
    }
    ctx.drawImage(
      sheet,
      srcX,
      srcY,
      frameW,
      frameH,
      x,
      y,
      drawSize,
      drawSize,
    );
    ctx.restore();

    return true;
  }

  private drawGeneratedTerrain(ctx: CanvasRenderingContext2D): boolean {
    if (this.sprites.getSprite("base_floor") === undefined) {
      return false;
    }

    const map = this.terrainMap;
    const tileSize = map.tileSize;
    const startCol = Math.max(
      0,
      Math.floor((this.camera.viewBoundsWorld.minX - map.originX) / tileSize) - 1,
    );
    const endCol = Math.min(
      map.width - 1,
      Math.ceil((this.camera.viewBoundsWorld.maxX - map.originX) / tileSize) + 1,
    );
    const startRow = Math.max(
      0,
      Math.floor((this.camera.viewBoundsWorld.minY - map.originY) / tileSize) - 1,
    );
    const endRow = Math.min(
      map.height - 1,
      Math.ceil((this.camera.viewBoundsWorld.maxY - map.originY) / tileSize) + 1,
    );

    for (let row = startRow; row <= endRow; row += 1) {
      for (let col = startCol; col <= endCol; col += 1) {
        const tileId = getGeneratedTile(map, col, row);
        if (tileId === null) {
          continue;
        }
        const drawX = Math.round(map.originX + col * tileSize);
        const drawY = Math.round(map.originY + row * tileSize);
        const drew = this.drawTerrainTile(ctx, tileId, drawX, drawY, tileSize);
        if (!drew) {
          ctx.fillStyle = ((row + col) & 1) === 0
            ? CHECKERBOARD_COLOR_A
            : CHECKERBOARD_COLOR_B;
          ctx.fillRect(drawX, drawY, tileSize, tileSize);
        }
      }
    }

    for (const prop of map.props) {
      if (prop.col < startCol || prop.col > endCol || prop.row < startRow || prop.row > endRow) {
        continue;
      }

      const drawX = Math.round(map.originX + prop.col * tileSize);
      const drawY = Math.round(map.originY + prop.row * tileSize);
      const drew = this.sprites.drawSprite(
        ctx,
        prop.id,
        drawX,
        drawY,
        tileSize,
        tileSize,
      );
      if (!drew) {
        ctx.save();
        ctx.fillStyle = "rgba(82, 166, 118, 0.32)";
        ctx.beginPath();
        ctx.arc(drawX + tileSize * 0.5, drawY + tileSize * 0.5, tileSize * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    return true;
  }

  private drawTerrainTile(
    ctx: CanvasRenderingContext2D,
    tileId: string,
    drawX: number,
    drawY: number,
    tileSize: number,
  ): boolean {
    if (tileId === "west_border" || tileId === "east_border") {
      this.drawSideWallTile(ctx, tileId, drawX, drawY, tileSize);
      return true;
    }

    return this.sprites.drawSprite(
      ctx,
      tileId,
      drawX,
      drawY,
      tileSize,
      tileSize,
    );
  }

  private drawSideWallTile(
    ctx: CanvasRenderingContext2D,
    tileId: "west_border" | "east_border",
    drawX: number,
    drawY: number,
    tileSize: number,
  ): void {
    const x = Math.round(drawX);
    const y = Math.round(drawY);
    const isWest = tileId === "west_border";
    const faceInset = tileSize * 0.14;
    const pillarWidth = tileSize * 0.28;

    // Base stone body distinct from north/south walls.
    ctx.save();
    const bodyGradient = ctx.createLinearGradient(x, y, x + tileSize, y);
    if (isWest) {
      bodyGradient.addColorStop(0, "#132019");
      bodyGradient.addColorStop(0.58, "#27332b");
      bodyGradient.addColorStop(1, "#08110d");
    } else {
      bodyGradient.addColorStop(0, "#08110d");
      bodyGradient.addColorStop(0.42, "#27332b");
      bodyGradient.addColorStop(1, "#132019");
    }
    ctx.fillStyle = bodyGradient;
    ctx.fillRect(x, y, tileSize, tileSize);

    // Structural face toward the arena to differentiate side walls.
    ctx.fillStyle = "rgba(126, 255, 210, 0.08)";
    ctx.fillRect(
      isWest ? x + tileSize - pillarWidth : x,
      y,
      pillarWidth,
      tileSize,
    );

    ctx.fillStyle = "rgba(8, 14, 11, 0.95)";
    ctx.fillRect(
      isWest ? x + faceInset : x + tileSize - faceInset - pillarWidth,
      y + faceInset,
      tileSize - faceInset * 2 - pillarWidth,
      tileSize - faceInset * 2,
    );

    ctx.strokeStyle = "rgba(17, 201, 146, 0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);

    // Vertical rune rails.
    const railX = isWest ? x + tileSize - pillarWidth * 0.5 : x + pillarWidth * 0.5;
    ctx.strokeStyle = "rgba(102, 255, 208, 0.3)";
    ctx.beginPath();
    ctx.moveTo(railX, y + 8);
    ctx.lineTo(railX, y + tileSize - 8);
    ctx.stroke();

    const runeCenterX = isWest ? x + tileSize - pillarWidth * 0.55 : x + pillarWidth * 0.55;
    const runeCenterY = y + tileSize * 0.5;
    ctx.strokeStyle = "rgba(126, 255, 210, 0.48)";
    ctx.beginPath();
    ctx.moveTo(runeCenterX, runeCenterY - 9);
    ctx.lineTo(runeCenterX + (isWest ? -7 : 7), runeCenterY);
    ctx.lineTo(runeCenterX, runeCenterY + 9);
    ctx.lineTo(runeCenterX + (isWest ? 7 : -7), runeCenterY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private resolveCircleMapCollision(
    entity: { x: number; y: number },
    radius: number,
  ): void {
    entity.x = clampScalar(
      entity.x,
      this.playableBounds.minX + radius,
      this.playableBounds.maxX - radius,
    );
    entity.y = clampScalar(
      entity.y,
      this.playableBounds.minY + radius,
      this.playableBounds.maxY - radius,
    );

    for (const rect of this.terrainObstacleRects) {
      if (
        !circleIntersectsAabb(
          entity.x,
          entity.y,
          radius,
          rect.minX,
          rect.minY,
          rect.maxX,
          rect.maxY,
        )
      ) {
        continue;
      }

      const closestX = clampScalar(entity.x, rect.minX, rect.maxX);
      const closestY = clampScalar(entity.y, rect.minY, rect.maxY);
      let dx = entity.x - closestX;
      let dy = entity.y - closestY;
      let distSq = dx * dx + dy * dy;

      if (distSq <= 1e-6) {
        const leftPen = Math.abs(entity.x - rect.minX);
        const rightPen = Math.abs(rect.maxX - entity.x);
        const topPen = Math.abs(entity.y - rect.minY);
        const bottomPen = Math.abs(rect.maxY - entity.y);
        const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);

        if (minPen === leftPen) {
          dx = -1;
          dy = 0;
        } else if (minPen === rightPen) {
          dx = 1;
          dy = 0;
        } else if (minPen === topPen) {
          dx = 0;
          dy = -1;
        } else {
          dx = 0;
          dy = 1;
        }
        distSq = 1;
      }

      const dist = Math.sqrt(distSq);
      const overlap = radius - dist;
      if (overlap > 0) {
        entity.x += (dx / dist) * overlap;
        entity.y += (dy / dist) * overlap;
      }
    }
  }

  private resolveEnemyFrameCompensation(
    key: string,
    sheet: HTMLImageElement,
    frameW: number,
    frameH: number,
    rows: number,
    cols: number,
    row: number,
    frame: number,
  ): FrameCompensationOffset {
    const cacheKey = `${key}:${sheet.src}:${frameW}x${frameH}:${rows}x${cols}`;
    let table = this.spriteFrameCompensationCache.get(cacheKey);
    if (table === undefined) {
      table = this.buildEnemyFrameCompensationTable(sheet, frameW, frameH, rows, cols);
      this.spriteFrameCompensationCache.set(cacheKey, table);
    }
    if (row < 0 || row >= table.rows || frame < 0 || frame >= table.cols) {
      return { x: 0, y: 0 };
    }
    return table.offsets[row]?.[frame] ?? { x: 0, y: 0 };
  }

  private buildEnemyFrameCompensationTable(
    sheet: HTMLImageElement,
    frameW: number,
    frameH: number,
    rows: number,
    cols: number,
  ): SpriteFrameCompensationTable {
    const canvas = document.createElement("canvas");
    const sampledW = Math.min(sheet.naturalWidth, frameW * cols);
    const sampledH = Math.min(sheet.naturalHeight, frameH * rows);
    canvas.width = Math.max(1, sampledW);
    canvas.height = Math.max(1, sampledH);
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      return {
        rows,
        cols,
        offsets: Array.from({ length: rows }, () =>
          Array.from({ length: cols }, () => ({ x: 0, y: 0 })),
        ),
      };
    }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sheet, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    const bboxFor = (r: number, c: number): { minX: number; minY: number; maxX: number; maxY: number } | null => {
      const ox = c * frameW;
      const oy = r * frameH;
      if (ox >= canvas.width || oy >= canvas.height) {
        return null;
      }
      const sx = Math.min(frameW, canvas.width - ox);
      const sy = Math.min(frameH, canvas.height - oy);
      let minX = sx;
      let minY = sy;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < sy; y += 1) {
        for (let x = 0; x < sx; x += 1) {
          const px = ox + x;
          const py = oy + y;
          const idx = (py * canvas.width + px) * 4 + 3;
          const alpha = data[idx] ?? 0;
          if (alpha > 48) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < minX || maxY < minY) {
        return null;
      }
      return { minX, minY, maxX, maxY };
    };

    const median = (values: number[]): number => {
      if (values.length === 0) {
        return 0;
      }
      const sorted = values.slice().sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)] ?? 0;
    };

    const offsets: FrameCompensationOffset[][] = [];
    for (let r = 0; r < rows; r += 1) {
      const centers: number[] = [];
      const bottoms: number[] = [];
      const bbs: Array<{ minX: number; minY: number; maxX: number; maxY: number } | null> = [];
      for (let c = 0; c < cols; c += 1) {
        const bb = bboxFor(r, c);
        bbs.push(bb);
        if (bb === null) {
          continue;
        }
        centers.push((bb.minX + bb.maxX) * 0.5);
        bottoms.push(bb.maxY);
      }
      const targetCenterX = median(centers);
      const targetBottomY = median(bottoms);
      const rowOffsets: FrameCompensationOffset[] = [];
      for (let c = 0; c < cols; c += 1) {
        const bb = bbs[c];
        if (bb === undefined || bb === null) {
          rowOffsets.push({ x: 0, y: 0 });
          continue;
        }
        const centerX = (bb.minX + bb.maxX) * 0.5;
        const bottomY = bb.maxY;
        const dx = Math.max(-6, Math.min(6, Math.round(targetCenterX - centerX)));
        const dy = Math.max(-6, Math.min(6, Math.round(targetBottomY - bottomY)));
        rowOffsets.push({ x: dx, y: dy });
      }
      offsets.push(rowOffsets);
    }

    return { rows, cols, offsets };
  }

  private drawPlayerSprite(ctx: CanvasRenderingContext2D): boolean {
    const directionalSheet = this.sprites.getSheet("player_walk_4dir");
    const fallbackSheet = this.sprites.getSheet("player_core");
    if (directionalSheet === undefined && fallbackSheet === undefined) {
      return false;
    }

    const sheet = directionalSheet ?? fallbackSheet;
    if (sheet === undefined) {
      return false;
    }

    const legacyTwoRowSheet = sheet.naturalHeight <= sheet.naturalWidth / 2;
    const rowCount = legacyTwoRowSheet ? 2 : PLAYER_FULL_DIRECTIONAL_ROWS;
    const frameW = Math.max(1, Math.floor(sheet.naturalWidth / PLAYER_FRAME_COUNT));
    const frameH = Math.max(1, Math.floor(sheet.naturalHeight / rowCount));
    const moving = this.playerMoveMagnitude > 0.1;
    const hurt = this.player.hurtAnimationMs > 0;
    const frameMs = hurt ? playerRenderConfig.frameMsHurt : playerRenderConfig.frameMsMove;
    const frameIndex = this.resolvePlayerFrameIndex(moving, hurt, frameMs);
    const facing = this.resolveFacingDirection(this.player.lastFacingX, this.player.lastFacingY);
    const row = this.resolvePlayerSpriteRow(facing, legacyTwoRowSheet, hurt);
    const flipX = this.shouldFlipPlayerSprite(facing, legacyTwoRowSheet);
    const comp = this.resolveEnemyFrameCompensation(
      "player",
      sheet,
      frameW,
      frameH,
      rowCount,
      PLAYER_FRAME_COUNT,
      row,
      frameIndex,
    );
    const drawHeight = Math.max(1, Math.round(PLAYER_RADIUS_PX * playerRenderConfig.drawScale));
    const drawWidth = Math.max(1, Math.round(drawHeight * (frameW / frameH)));
    const compScaleX = drawWidth / frameW;
    const compScaleY = drawHeight / frameH;
    const x = Math.round(
      this.player.x - drawWidth / 2 + playerRenderConfig.anchor.x + comp.x * compScaleX,
    );
    const y = Math.round(
      this.player.y - drawHeight / 2 + playerRenderConfig.anchor.y + comp.y * compScaleY,
    );

    ctx.save();
    applyPixelArtRendering(ctx);
    if (flipX) {
      ctx.translate(x + drawWidth * 0.5, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(x + drawWidth * 0.5), 0);
    }
    ctx.drawImage(
      sheet,
      frameIndex * frameW,
      row * frameH,
      frameW,
      frameH,
      x,
      y,
      drawWidth,
      drawHeight,
    );
    ctx.restore();

    if (hurt) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.45, this.player.hurtAnimationMs / 180);
      ctx.strokeStyle = "#ffe7ef";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, PLAYER_RADIUS_PX + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    return true;
  }

  private updatePlayerAnimationClock(dtMs: number, axes: { x: number; y: number }): void {
    const speedMagnitude = Math.hypot(axes.x, axes.y);
    this.playerMoveMagnitude = speedMagnitude;
    if (speedMagnitude > 0.08) {
      const pacedDt = dtMs * (0.75 + speedMagnitude * 0.45);
      this.playerAnimClockMs += pacedDt;
      return;
    }

    if (this.player.hurtAnimationMs > 0) {
      this.playerAnimClockMs += dtMs * 0.35;
      return;
    }

    // Snap cleanly to frame 0 when idle to avoid wobble/flicker.
    this.playerAnimClockMs = 0;
  }

  private resolvePlayerFrameIndex(
    moving: boolean,
    hurt: boolean,
    frameMs: number,
  ): number {
    if (hurt) {
      return PLAYER_HURT_FRAME_INDEX;
    }
    if (!moving) {
      return 0;
    }
    return Math.floor(this.playerAnimClockMs / frameMs) % PLAYER_FRAME_COUNT;
  }

  private resolveFacingDirection(
    facingX: number,
    facingY: number,
  ): FacingDirection {
    if (Math.abs(facingY) > Math.abs(facingX)) {
      return facingY < 0 ? "north" : "south";
    }
    return facingX < 0 ? "west" : "east";
  }

  private resolvePlayerSpriteRow(
    facing: FacingDirection,
    legacyTwoRowSheet: boolean,
    hurt: boolean,
  ): number {
    if (!legacyTwoRowSheet) {
      if (hurt) {
        return PLAYER_WALK_ROW_BY_FACING[facing];
      }
      return PLAYER_WALK_ROW_BY_FACING[facing];
    }

    // Legacy 2-row fallback:
    // row 0 is used for north-facing/idle, row 1 for side/south walk.
    if (hurt) {
      return facing === "north" ? 0 : 1;
    }
    if (facing === "north") {
      return 0;
    }
    return 1;
  }

  private shouldFlipPlayerSprite(
    facing: FacingDirection,
    legacyTwoRowSheet: boolean,
  ): boolean {
    if (!legacyTwoRowSheet) {
      return false;
    }
    return facing === "west";
  }

  private resolveEnemySpriteRow(
    facing: "north" | "south" | "east" | "west",
    directionalSheet: boolean,
    frozen: boolean,
  ): number {
    if (directionalSheet) {
      if (frozen) {
        return ENEMY_WALK_ROW_BY_FACING[facing];
      }
      return ENEMY_WALK_ROW_BY_FACING[facing];
    }

    // Legacy 3-row fallback (4x3):
    // row0: north/idle, row1: move (south/east), row2: extra/death (unused here)
    if (frozen) {
      return 0;
    }
    return facing === "north" ? 0 : 1;
  }

  private shouldFlipEnemySprite(
    facing: "north" | "south" | "east" | "west",
    directionalSheet: boolean,
  ): boolean {
    if (directionalSheet) {
      return false;
    }
    return facing === "west";
  }

  private drawProjectileSprite(
    ctx: CanvasRenderingContext2D,
    bolt: Projectile,
  ): boolean {
    const byWeapon = bolt.sourceWeaponId !== undefined
      ? projectileRenderConfig[bolt.sourceWeaponId]
      : undefined;
    const spriteId = byWeapon?.spriteId ?? "arcane_bolt";
    const size = Math.max(12, bolt.collisionRadiusPx * (byWeapon?.drawScale ?? 3.3));
    const anchorX = byWeapon?.anchor.x ?? 0;
    const anchorY = byWeapon?.anchor.y ?? 0;
    const sourceWeaponId = bolt.sourceWeaponId;
    const isRuneLaser =
      sourceWeaponId === "runetracer" || sourceWeaponId === "no_future";
    if (isRuneLaser) {
      const trailHandle = this.sprites.getSprite("lash_strip_fx");
      if (trailHandle !== undefined) {
        const travelAngle = Math.atan2(bolt.vyWorldPerSec, bolt.vxWorldPerSec);
        const speed = Math.hypot(bolt.vxWorldPerSec, bolt.vyWorldPerSec);
        const trailLength = Math.max(34, Math.min(96, speed * 0.052 + bolt.collisionRadiusPx * 5.5));
        const trailThickness = Math.max(8, bolt.collisionRadiusPx * 1.8);
        ctx.save();
        ctx.translate(bolt.x + anchorX, bolt.y + anchorY);
        ctx.rotate(travelAngle);
        ctx.globalAlpha = 0.5;
        ctx.drawImage(
          trailHandle.image,
          trailHandle.rect.x,
          trailHandle.rect.y,
          trailHandle.rect.w,
          trailHandle.rect.h,
          -trailLength,
          -trailThickness * 0.5,
          trailLength,
          trailThickness,
        );
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = sourceWeaponId === "no_future"
          ? "rgba(232, 188, 255, 0.5)"
          : "rgba(196, 146, 255, 0.48)";
        ctx.fillRect(-trailLength, -trailThickness * 0.5, trailLength, trailThickness);
        ctx.restore();
      }
    }
    if (byWeapon?.rotateToVelocity) {
      const handle = this.sprites.getSprite(spriteId);
      if (handle === undefined) {
        return false;
      }
      const travelAngle = Math.atan2(bolt.vyWorldPerSec, bolt.vxWorldPerSec);
      const spinAngle = byWeapon.spinRadPerSec !== undefined
        ? (Date.now() / 1000) * byWeapon.spinRadPerSec + bolt.poolIndex * 0.23
        : 0;
      const angle = travelAngle + spinAngle;
      ctx.save();
      ctx.translate(bolt.x + anchorX, bolt.y + anchorY);
      ctx.rotate(angle);
      ctx.drawImage(
        handle.image,
        handle.rect.x,
        handle.rect.y,
        handle.rect.w,
        handle.rect.h,
        -size / 2,
        -size / 2,
        size,
        size,
      );
      ctx.restore();
      return true;
    }
    return this.sprites.drawSprite(
      ctx,
      spriteId,
      bolt.x - size / 2 + anchorX,
      bolt.y - size / 2 + anchorY,
      size,
      size,
    );
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
      sourceWeaponId: spawn.sourceWeaponId,
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
