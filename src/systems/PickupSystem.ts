import type { ObjectPool } from "../core/ObjectPool";
import { requirePickup, rollEnemyPickupDrop, type PickupKind } from "../data/pickups";
import type { Pickup } from "../entities/Pickup";
import type { Player } from "../entities/Player";
import { PLAYER_RADIUS_PX } from "../utils/constants";
import { squaredDistance } from "../utils/math";
import type { SpriteRegistry } from "../render/SpriteRegistry";
import { pickupAnchorConfig } from "../render/renderTuning";

export interface PickupSystemCallbacks {
  collectAllExperienceGems: () => void;
  clearAllEnemies: () => void;
  freezeAllEnemies: (durationMs: number) => void;
  healPlayer: (amount: number) => void;
  emitPickupFloater: (label: string, worldX: number, worldY: number) => void;
  spawnPickupBurst: (pickupKind: PickupKind, worldX: number, worldY: number) => void;
}

/**
 * Handles ground pickups and their one-shot utility effects.
 */
export class PickupSystem {
  constructor(
    private readonly pickupPool: ObjectPool<Pickup>,
    private readonly player: Player,
    private readonly callbacks: PickupSystemCallbacks,
  ) {}

  spawnEnemyDrop(
    worldX: number,
    worldY: number,
    survivorLevel: number,
    luck: number,
    hpFraction: number,
    elite: boolean,
  ): boolean {
    const pickupKind = rollEnemyPickupDrop({
      survivorLevel,
      luck,
      hpFraction,
      elite,
      rng: Math,
    });

    if (pickupKind === undefined) {
      return false;
    }

    return this.spawnPickup(pickupKind, worldX, worldY);
  }

  spawnPickup(kind: PickupKind, worldX: number, worldY: number): boolean {
    const pickup = this.pickupPool.acquire();
    if (pickup === undefined) {
      return false;
    }

    pickup.initializePickup(kind, worldX, worldY);
    return true;
  }

  update(shouldSimulate: boolean): void {
    if (!shouldSimulate) {
      return;
    }

    const playerReach = PLAYER_RADIUS_PX;
    this.pickupPool.forEachActive((pickup) => {
      if (!pickup.active) {
        return;
      }

      const reach = playerReach + pickup.radiusPx;
      if (
        squaredDistance(this.player.x, this.player.y, pickup.x, pickup.y) >
        reach * reach
      ) {
        return;
      }

      this.consumePickup(pickup);
    });
  }

  renderWorld(ctx: CanvasRenderingContext2D, sprites?: SpriteRegistry): void {
    this.pickupPool.forEachActive((pickup) => {
      if (!pickup.active) {
        return;
      }

      const meta = requirePickup(pickup.pickupKind);

      ctx.save();
      ctx.globalAlpha = 0.88;
      const drawSize = pickup.radiusPx * 2.8;
      const spriteId = this.resolvePickupSpriteId(pickup.pickupKind);
      const anchor = spriteId !== undefined
        ? (pickupAnchorConfig[spriteId] ?? { x: 0, y: 0 })
        : { x: 0, y: 0 };
      const drewSprite = spriteId !== undefined && sprites !== undefined
        ? sprites.drawSprite(
            ctx,
            spriteId,
            pickup.x - drawSize / 2 + anchor.x,
            pickup.y - drawSize / 2 + anchor.y,
            drawSize,
            drawSize,
          )
        : false;

      if (!drewSprite) {
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y, pickup.radiusPx, 0, Math.PI * 2);
        ctx.fillStyle = pickup.fillHex;
        ctx.fill();
        ctx.lineWidth = Math.max(2, pickup.radiusPx * 0.18);
        ctx.strokeStyle = pickup.outlineHex;
        ctx.stroke();
      }

      switch (pickup.pickupKind) {
        case "floor_chicken":
          drawFieldRationGlyph(ctx, pickup.x, pickup.y, pickup.radiusPx);
          break;
        case "vacuum":
          drawGemSiphonGlyph(ctx, pickup.x, pickup.y, pickup.radiusPx);
          break;
        case "rosary":
          drawHaloCharmGlyph(ctx, pickup.x, pickup.y, pickup.radiusPx);
          break;
        case "orologion":
          drawChronoSealGlyph(ctx, pickup.x, pickup.y, pickup.radiusPx);
          break;
      }

      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = pickup.pickupKind === "vacuum" ? "#dffcff" : "#fff8d8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, pickup.radiusPx + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.font = "600 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#f7f2de";
      ctx.fillText(meta.name, pickup.x, pickup.y + pickup.radiusPx + 4);
      ctx.restore();
    });
  }

  private resolvePickupSpriteId(kind: PickupKind): string | undefined {
    switch (kind) {
      case "floor_chicken":
        return "field_ration";
      case "vacuum":
        return "gem_siphon";
      case "rosary":
        return "halo_charm";
      case "orologion":
        return "chrono_seal";
      default:
        return undefined;
    }
  }

  private consumePickup(pickup: Pickup): void {
    switch (pickup.pickupKind) {
      case "floor_chicken":
        this.callbacks.healPlayer(30);
        this.callbacks.spawnPickupBurst("floor_chicken", pickup.x, pickup.y);
        this.callbacks.emitPickupFloater("Yummy!", pickup.x, pickup.y);
        break;
      case "vacuum":
        this.callbacks.collectAllExperienceGems();
        this.callbacks.spawnPickupBurst("vacuum", pickup.x, pickup.y);
        this.callbacks.emitPickupFloater("VACUUM", pickup.x, pickup.y);
        break;
      case "rosary":
        this.callbacks.clearAllEnemies();
        this.callbacks.spawnPickupBurst("rosary", pickup.x, pickup.y);
        this.callbacks.emitPickupFloater("ROSARY", pickup.x, pickup.y);
        break;
      case "orologion":
        this.callbacks.freezeAllEnemies(10_000);
        this.callbacks.spawnPickupBurst("orologion", pickup.x, pickup.y);
        this.callbacks.emitPickupFloater("TIME STOP", pickup.x, pickup.y);
        break;
    }

    pickup.resetForPool();
    this.pickupPool.release(pickup);
  }
}

function drawFieldRationGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  ctx.save();
  ctx.lineWidth = Math.max(1.5, radius * 0.12);
  ctx.strokeStyle = "#fff7eb";
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.45, y);
  ctx.lineTo(x + radius * 0.45, y);
  ctx.moveTo(x, y - radius * 0.45);
  ctx.lineTo(x, y + radius * 0.45);
  ctx.stroke();
  ctx.restore();
}

function drawGemSiphonGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  ctx.save();
  ctx.strokeStyle = "#f2fdff";
  ctx.lineWidth = Math.max(1.5, radius * 0.12);
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHaloCharmGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  ctx.save();
  ctx.strokeStyle = "#fff9de";
  ctx.lineWidth = Math.max(1.8, radius * 0.12);
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.5, y);
  ctx.lineTo(x + radius * 0.5, y);
  ctx.moveTo(x, y - radius * 0.5);
  ctx.lineTo(x, y + radius * 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawChronoSealGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  ctx.save();
  ctx.strokeStyle = "#f4fbff";
  ctx.lineWidth = Math.max(1.5, radius * 0.1);
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.64, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - radius * 0.38);
  ctx.moveTo(x, y);
  ctx.lineTo(x + radius * 0.3, y + radius * 0.14);
  ctx.stroke();
  ctx.restore();
}
