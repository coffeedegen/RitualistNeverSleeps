import {
  DAMAGE_FLOAT_DRIFT_WORLD_PX_PER_SEC,
  DAMAGE_FLOATER_LIFE_MS,
} from "../utils/constants";
import { clampScalar } from "../utils/math";

interface Floater {
  worldX: number;
  worldY: number;
  label: string;
  ttlRemainMs: number;
  ttlStartMs: number;
}

/** World-space combat text used for quick damage readouts. */
export class FloatingDamageSystem {
  private readonly floaters: Floater[] = [];

  /**
   * Spawns a combat string at the requested world coordinate.
   * @param label Usually the rounded damage total for readability.
   */
  spawnFloater(worldX: number, worldY: number, label: string): void {
    this.floaters.push({
      worldX,
      worldY,
      label,
      ttlRemainMs: DAMAGE_FLOATER_LIFE_MS,
      ttlStartMs: DAMAGE_FLOATER_LIFE_MS,
    });
  }

  /**
   * Ages floaters and applies constant vertical drift.
   */
  update(dtMs: number): void {
    const seconds = dtMs / 1000;
    for (const floater of this.floaters) {
      floater.ttlRemainMs -= dtMs;
      floater.worldY +=
        DAMAGE_FLOAT_DRIFT_WORLD_PX_PER_SEC * seconds;
    }

    for (let index = this.floaters.length - 1; index >= 0; index -= 1) {
      const entry = this.floaters[index];
      if (entry === undefined) {
        continue;
      }
      if (entry.ttlRemainMs <= 0) {
        this.floaters.splice(index, 1);
      }
    }
  }

  /**
   * Renders world-space floaters after the camera transform is applied.
   */
  renderWorld(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = "800 14px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;

    for (const floater of this.floaters) {
      const alpha = clampScalar(
        floater.ttlRemainMs / floater.ttlStartMs,
        0,
        1,
      );
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
      ctx.strokeText(floater.label, floater.worldX, floater.worldY);
      ctx.fillStyle = alpha > 0.5 ? "#fff2bf" : "#ffc46b";
      ctx.fillText(floater.label, floater.worldX, floater.worldY);
    }

    ctx.restore();
  }
}
