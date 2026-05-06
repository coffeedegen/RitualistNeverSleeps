import type { PickupKind } from "../data/pickups";
import { clampScalar } from "../utils/math";

interface BurstEffect {
  x: number;
  y: number;
  baseRadius: number;
  radiusGrowPx: number;
  ttlRemainMs: number;
  ttlStartMs: number;
  coreColor: string;
  glowColor: string;
  ringWidth: number;
  spinRad: number;
}

interface SparkEffect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttlRemainMs: number;
  ttlStartMs: number;
  color: string;
  sizePx: number;
}

/** Decorative combat / pickup VFX that live in world space. */
export class CombatVfxSystem {
  private readonly bursts: BurstEffect[] = [];

  private readonly sparks: SparkEffect[] = [];

  spawnImpactBurst(x: number, y: number, coreColor: string, intensity = 1): void {
    const strength = Math.max(0.6, intensity);
    this.bursts.push({
      x,
      y,
      baseRadius: 8 + strength * 5,
      radiusGrowPx: 38 + strength * 20,
      ttlRemainMs: 220,
      ttlStartMs: 220,
      coreColor,
      glowColor: this.withAlpha(coreColor, 0.35),
      ringWidth: 2 + strength * 0.75,
      spinRad: Math.random() * Math.PI * 2,
    });
    this.spawnSparkFan(x, y, coreColor, 5 + Math.round(strength * 2), 58 + strength * 28);
  }

  spawnDeathBurst(x: number, y: number, coreColor: string, elite = false): void {
    const color = elite ? "#ffd65a" : coreColor;
    const ttl = elite ? 420 : 320;
    this.bursts.push({
      x,
      y,
      baseRadius: elite ? 12 : 10,
      radiusGrowPx: elite ? 92 : 68,
      ttlRemainMs: ttl,
      ttlStartMs: ttl,
      coreColor: this.withAlpha(color, 0.9),
      glowColor: this.withAlpha(color, 0.28),
      ringWidth: elite ? 3.2 : 2.4,
      spinRad: Math.random() * Math.PI * 2,
    });
    this.spawnSparkFan(x, y, color, elite ? 12 : 8, elite ? 94 : 72);
  }

  spawnPickupBurst(pickupKind: PickupKind, x: number, y: number): void {
    const style = this.resolvePickupStyle(pickupKind);
    this.bursts.push({
      x,
      y,
      baseRadius: 7,
      radiusGrowPx: 44,
      ttlRemainMs: 240,
      ttlStartMs: 240,
      coreColor: style.core,
      glowColor: style.glow,
      ringWidth: 2.2,
      spinRad: Math.random() * Math.PI * 2,
    });
    this.spawnSparkFan(x, y, style.core, 6, 58);
  }

  update(dtMs: number): void {
    const dtSec = dtMs / 1000;
    for (const burst of this.bursts) {
      burst.ttlRemainMs -= dtMs;
      burst.spinRad += dtSec * 3.5;
    }

    for (const spark of this.sparks) {
      spark.ttlRemainMs -= dtMs;
      spark.x += spark.vx * dtSec;
      spark.y += spark.vy * dtSec;
      spark.vx *= 0.985;
      spark.vy = spark.vy * 0.985 + 24 * dtSec;
    }

    for (let i = this.bursts.length - 1; i >= 0; i -= 1) {
      if (this.bursts[i]?.ttlRemainMs !== undefined && this.bursts[i]!.ttlRemainMs <= 0) {
        this.bursts.splice(i, 1);
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      if (this.sparks[i]?.ttlRemainMs !== undefined && this.sparks[i]!.ttlRemainMs <= 0) {
        this.sparks.splice(i, 1);
      }
    }
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const burst of this.bursts) {
      const alpha = clampScalar(burst.ttlRemainMs / burst.ttlStartMs, 0, 1);
      const radius = burst.baseRadius + burst.radiusGrowPx * (1 - alpha);

      ctx.save();
      ctx.translate(burst.x, burst.y);
      ctx.rotate(burst.spinRad);

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = this.withAlpha(burst.glowColor, alpha * 0.3);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
      ctx.strokeStyle = this.withAlpha(burst.coreColor, alpha);
      ctx.lineWidth = burst.ringWidth;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.14, 0, Math.PI * 2);
      ctx.strokeStyle = this.withAlpha(burst.glowColor, alpha * 0.8);
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();
    }

    for (const spark of this.sparks) {
      const alpha = clampScalar(spark.ttlRemainMs / spark.ttlStartMs, 0, 1);
      const trailX = spark.x - spark.vx * 0.03;
      const trailY = spark.y - spark.vy * 0.03;

      ctx.strokeStyle = this.withAlpha(spark.color, alpha);
      ctx.lineWidth = Math.max(1, spark.sizePx * alpha * 0.16);
      ctx.beginPath();
      ctx.moveTo(trailX, trailY);
      ctx.lineTo(spark.x, spark.y);
      ctx.stroke();

      ctx.fillStyle = this.withAlpha("#ffffff", alpha * 0.45);
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, Math.max(0.8, spark.sizePx * alpha * 0.14), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private spawnSparkFan(
    x: number,
    y: number,
    color: string,
    count: number,
    speedPxPerSec: number,
  ): void {
    for (let i = 0; i < count; i += 1) {
      const theta = (Math.PI * 2 * i) / count + Math.random() * 0.2;
      const speed = speedPxPerSec * (0.65 + Math.random() * 0.5);
      this.sparks.push({
        x,
        y,
        vx: Math.cos(theta) * speed,
        vy: Math.sin(theta) * speed - 24,
        ttlRemainMs: 260 + Math.random() * 100,
        ttlStartMs: 360,
        color,
        sizePx: 5 + Math.random() * 3,
      });
    }
  }

  private resolvePickupStyle(pickupKind: PickupKind): { core: string; glow: string } {
    switch (pickupKind) {
      case "floor_chicken":
        return { core: "#ffd166", glow: "#fff0b3" };
      case "vacuum":
        return { core: "#6be7ff", glow: "#dffcff" };
      case "rosary":
        return { core: "#ffe17d", glow: "#fff8c6" };
      case "orologion":
        return { core: "#7ba2ff", glow: "#dfeaff" };
      default:
        return { core: "#ffffff", glow: "#ffffff" };
    }
  }

  private withAlpha(hex: string, alpha: number): string {
    const normalized = hex.replace("#", "");
    if (normalized.length !== 6) {
      return hex;
    }

    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
