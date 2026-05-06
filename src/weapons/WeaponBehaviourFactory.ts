import {
  amplifyMergedWeaponDamageProfile,
  requireWeapon,
  resolveWeaponMergedStats,
  type WeaponData,
  type WeaponLoopKind,
} from "../data/weapons";
import {
  MAGIC_WAND_MULTI_SHOT_SPREAD_RAD,
  MAGIC_WAND_PROJECTILE_TTL_MS,
  PROJECTILE_DOWNWARD_GRAVITY_PPS2,
  PROJECTILE_WAND_RADIUS_PX,
} from "../utils/constants";
import type { WeaponRuntimeContext } from "./WeaponBase";

/** Interface implemented by authored weapon behaviours. */
export interface WeaponBehaviour {
  readonly weaponId: string;
  tick(ctx: WeaponRuntimeContext, weaponLevel: number): void;
  renderWorld?(ctx: CanvasRenderingContext2D): void;
}

export function createWeaponBehaviour(weaponId: string): WeaponBehaviour {
  const data = requireWeapon(weaponId);
  switch (data.loopKind) {
    case "whip_arc":
      return new LashSlashBehaviour(weaponId);
    case "magic_barrage":
      return new MagicVolleyBehaviour(weaponId);
    case "knife_stream":
      return new ShardStreamBehaviour(weaponId);
    case "axe_lob":
      return new CleaverArcBehaviour(weaponId);
    case "cross_quartet":
      return new SanctumCrossBehaviour(weaponId);
    case "bible_orbit":
      return new OrbitalLiturgyBehaviour(weaponId);
    case "fire_fan":
      return new FireFanBehaviour(weaponId);
    case "garlic_aura":
      return new WardingAuraBehaviour(weaponId);
    case "santa_pools":
      return new ConsecratedPoolBehaviour(weaponId);
    case "rune_piercing":
      return new RuneTracerBehaviour(weaponId);
    case "lightning_bolt":
      return new LightningNovaBehaviour(weaponId);
    case "pentagram_shock":
      return new SigilNovaBehaviour(weaponId);
    default:
      throw new Error(`Unhandled weapon archetype "${String(data.loopKind)}"`);
  }
}

function mergeProfile(
  ctx: WeaponRuntimeContext,
  laneId: string,
  weaponLevel: number,
): ReturnType<typeof resolveWeaponMergedStats> {
  const data = requireWeapon(laneId);
  const bundled = resolveWeaponMergedStats(
    data,
    weaponLevel,
    ctx.passiveCombat.passiveAmountBonus,
  );
  return amplifyMergedWeaponDamageProfile(bundled, ctx.passiveCombat);
}

abstract class BehaviourBase implements WeaponBehaviour {
  readonly weaponId: string;

  /** Milliseconds remaining before the next authored activation. */
  protected cadenceRemainMs = 0;

  abstract tick(ctx: WeaponRuntimeContext, weaponLevel: number): void;

  constructor(weaponId: string) {
    this.weaponId = weaponId;
  }

  /** Generic cadence countdown shared by every behaviour file. */
  protected regressCadence(deltaMs: number): void {
    if (this.cadenceRemainMs > 0) {
      this.cadenceRemainMs = Math.max(0, this.cadenceRemainMs - deltaMs);
    }
  }
}

interface LashStrikeVisual {
  midX: number;
  midY: number;
  a: number;
  b: number;
  angle: number;
  ttlMs: number;
  maxTtlMs: number;
}

class LashSlashBehaviour extends BehaviourBase {
  private strikes: LashStrikeVisual[] = [];

  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const strike = this.strikes[i];
      if (strike) {
        strike.ttlMs -= ctx.dtMs;
        if (strike.ttlMs <= 0) {
          this.strikes.splice(i, 1);
        }
      }
    }

    this.regressCadence(ctx.dtMs);
    if (this.cadenceRemainMs > 0) {
      return;
    }

    const merged = mergeProfile(ctx, this.weaponId, weaponLevel);
    const counts = Math.max(1, Math.round(merged.count));

    let { x: rawDirX } = normalizeVector(ctx.aimX, ctx.aimY);
    let dirX = rawDirX >= 0 ? 1 : -1;
    let dirY = 0;

    for (let i = 0; i < counts; i += 1) {
      const currentDirX = i % 2 === 0 ? dirX : -dirX;
      const currentDirY = i % 2 === 0 ? dirY : -dirY;

      const lateralOffset = (i * 12) * merged.areaMultiplier;
      const perpX = -currentDirY;
      const perpY = currentDirX;

      // 150% longer reach than original 60
      const reachLength = 60 * 2.50 * merged.areaMultiplier;
      const a = reachLength / 2;
      const b = 22 * Math.sqrt(merged.areaMultiplier);

      const midX = ctx.playerOriginX + currentDirX * a + perpX * lateralOffset;
      const midY = ctx.playerOriginY + currentDirY * a + perpY * lateralOffset;
      const angle = Math.atan2(currentDirY, currentDirX);

      this.strikes.push({
        midX, midY, a, b, angle, ttlMs: 150, maxTtlMs: 150
      });

      const queryRadius = Math.max(a, b);

      ctx.forEachEnemyInDisc(midX, midY, queryRadius, (enemy) => {
        const localX = (enemy.x - midX) * currentDirX + (enemy.y - midY) * currentDirY;
        const localY = (enemy.x - midX) * -currentDirY + (enemy.y - midY) * currentDirX;

        const expandedA = a + enemy.radiusPx;
        const expandedB = b + enemy.radiusPx;
        
        if ((localX * localX) / (expandedA * expandedA) + (localY * localY) / (expandedB * expandedB) <= 1) {
          ctx.applyWeaponDamage({
            enemy,
            impactWorldX: enemy.x,
            impactWorldY: enemy.y,
            damagePayload: merged.damage,
          });
        }
      });
    }

    this.cadenceRemainMs = merged.cooldownMs;
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    for (const strike of this.strikes) {
      const alpha = Math.max(0, strike.ttlMs / strike.maxTtlMs);
      
      ctx.save();
      
      ctx.beginPath();
      ctx.ellipse(strike.midX, strike.midY, strike.a, strike.b, strike.angle, 0, Math.PI * 2);

      if (this.weaponId === "bloody_tear") {
        ctx.fillStyle = `rgba(220, 20, 60, ${alpha * 0.6})`;
        ctx.strokeStyle = `rgba(255, 100, 100, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.6})`;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      }
      
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.stroke();
      
      ctx.restore();
    }
  }
}

class MagicVolleyBehaviour extends BehaviourBase {
  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    this.regressCadence(ctx.dtMs);
    if (this.cadenceRemainMs > 0) {
      return;
    }

    const merged = mergeProfile(ctx, this.weaponId, weaponLevel);
    const data = requireWeapon(this.weaponId);
    const shots = Math.max(1, Math.round(merged.count));
    let aimX = ctx.aimX;
    let aimY = ctx.aimY;

    const focal = ctx.findNearestEnemy(ctx.playerOriginX, ctx.playerOriginY);
    if (focal !== undefined) {
      const dx = focal.x - ctx.playerOriginX;
      const dy = focal.y - ctx.playerOriginY;
      const len = Math.hypot(dx, dy);
      if (len > 1e-4) {
        aimX = dx / len;
        aimY = dy / len;
      }
    }

    const normalized = normalizeVector(aimX, aimY);
    aimX = normalized.x;
    aimY = normalized.y;

    const baseAngle = Math.atan2(aimY, aimX);
    for (let idx = 0; idx < shots; idx += 1) {
      const spreadOffset =
        (idx - (shots - 1) * 0.5) * MAGIC_WAND_MULTI_SHOT_SPREAD_RAD;
      const theta = baseAngle + spreadOffset;
      const dirX = Math.cos(theta);
      const dirY = Math.sin(theta);
      spawnDirectedBolt(ctx, merged, data, dirX, dirY);
    }

    this.cadenceRemainMs = merged.cooldownMs;
  }
}

class ShardStreamBehaviour extends BehaviourBase {
  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    this.regressCadence(ctx.dtMs);
    if (this.cadenceRemainMs > 0) {
      return;
    }

    const merged = mergeProfile(ctx, this.weaponId, weaponLevel);
    const data = requireWeapon(this.weaponId);
    const bursts = Math.max(1, Math.round(merged.count));
    let aimX = ctx.aimX;
    let aimY = ctx.aimY;

    const focal = ctx.findNearestEnemy(ctx.playerOriginX, ctx.playerOriginY);
    if (focal !== undefined) {
      const dx = focal.x - ctx.playerOriginX;
      const dy = focal.y - ctx.playerOriginY;
      const len = Math.hypot(dx, dy);
      if (len > 1e-4) {
        aimX = dx / len;
        aimY = dy / len;
      }
    }

    ({ x: aimX, y: aimY } = normalizeVector(aimX, aimY));
    const baseAngle = Math.atan2(aimY, aimX);

    for (let burst = 0; burst < bursts; burst += 1) {
      const jitter =
        (burst - (bursts - 1) * 0.5) * (MAGIC_WAND_MULTI_SHOT_SPREAD_RAD * 0.6);
      const theta = baseAngle + jitter;
      spawnDirectedBolt(ctx, merged, data, Math.cos(theta), Math.sin(theta));
    }

    this.cadenceRemainMs = merged.cooldownMs;
  }
}

class CleaverArcBehaviour extends BehaviourBase {
  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    this.regressCadence(ctx.dtMs);
    if (this.cadenceRemainMs > 0) {
      return;
    }

    const merged = mergeProfile(ctx, this.weaponId, weaponLevel);
    const data = requireWeapon(this.weaponId);
    const bursts = Math.max(1, Math.round(merged.count));

    let dirX = ctx.aimX;
    let dirY = ctx.aimY;
    const aim = ctx.findNearestEnemy(ctx.playerOriginX, ctx.playerOriginY);
    if (aim !== undefined) {
      const dx = aim.x - ctx.playerOriginX;
      const dy = aim.y - ctx.playerOriginY;
      const len = Math.hypot(dx, dy);
      if (len > 1e-4) {
        dirX = dx / len;
        dirY = dy / len;
      }
    }
    ({ x: dirX, y: dirY } = normalizeVector(dirX, dirY));

    const baseAngle = Math.atan2(dirY, dirX) - Math.PI / 3.1;

    for (let ix = 0; ix < bursts; ix += 1) {
      const spread =
        (ix - (bursts - 1) * 0.5) * (MAGIC_WAND_MULTI_SHOT_SPREAD_RAD * 0.7);
      const theta = baseAngle + spread;
      spawnDirectedBolt(
        ctx,
        merged,
        data,
        Math.cos(theta),
        Math.sin(theta),
        PROJECTILE_DOWNWARD_GRAVITY_PPS2,
      );
    }

    this.cadenceRemainMs = merged.cooldownMs;
  }
}

class SanctumCrossBehaviour extends BehaviourBase {
  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    this.regressCadence(ctx.dtMs);
    if (this.cadenceRemainMs > 0) {
      return;
    }

    const merged = mergeProfile(ctx, this.weaponId, weaponLevel);
    const data = requireWeapon(this.weaponId);
    const waves = Math.max(1, Math.round(merged.count));

    const cardinals = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    for (let w = 0; w < waves; w += 1) {
      for (const dir of cardinals) {
        spawnDirectedBolt(ctx, merged, data, dir.x, dir.y);
      }
    }

    this.cadenceRemainMs = merged.cooldownMs;
  }
}

class OrbitalLiturgyBehaviour extends BehaviourBase {
  private orbitVisual:
    | {
        x: number;
        y: number;
        radius: number;
        progress: number;
      }
    | undefined;

  private activeRemainMs = 0;

  private orbitPhaseRad = 0;

  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    const merged = mergeProfile(ctx, this.weaponId, weaponLevel);
    const data = requireWeapon(this.weaponId);
    const activeDurationMs = Math.max(
      500,
      Math.floor((data.activeDurationMs ?? 3000) * merged.durationMultiplier),
    );

    this.regressCadence(ctx.dtMs);
    if (this.activeRemainMs <= 0 && this.cadenceRemainMs > 0) {
      this.orbitVisual = undefined;
      return;
    }

    if (this.activeRemainMs <= 0) {
      this.activeRemainMs = activeDurationMs;
      this.orbitPhaseRad = Math.atan2(ctx.aimY, ctx.aimX);
    }

    const activeSliceMs = Math.min(ctx.dtMs, this.activeRemainMs);
    const orbitRadius = (102 + merged.areaMultiplier * 18) * merged.areaMultiplier;
    const orbitHitRadius = Math.max(
      10,
      14 * Math.sqrt(Math.max(merged.areaMultiplier, 0.25)),
    );
    const angularStep = (Math.PI * 2 * activeSliceMs) / activeDurationMs;

    this.orbitPhaseRad += angularStep;
    const orbX = ctx.playerOriginX + Math.cos(this.orbitPhaseRad) * orbitRadius;
    const orbY = ctx.playerOriginY + Math.sin(this.orbitPhaseRad) * orbitRadius;
    this.orbitVisual = {
      x: orbX,
      y: orbY,
      radius: orbitHitRadius,
      progress: 1 - this.activeRemainMs / activeDurationMs,
    };

    ctx.forEachEnemyInDisc(
      orbX,
      orbY,
      orbitHitRadius,
      (enemy) =>
        ctx.applyWeaponDamage({
          enemy,
          impactWorldX: enemy.x,
          impactWorldY: enemy.y,
          damagePayload: merged.damage,
        }),
    );

    this.activeRemainMs = Math.max(0, this.activeRemainMs - ctx.dtMs);
    if (this.activeRemainMs <= 0) {
      this.cadenceRemainMs = merged.cooldownMs;
    }
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    if (this.orbitVisual === undefined) {
      return;
    }

    const alpha = Math.max(0.2, 1 - this.orbitVisual.progress * 0.35);
    ctx.save();
    ctx.beginPath();
    ctx.arc(
      this.orbitVisual.x,
      this.orbitVisual.y,
      this.orbitVisual.radius,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = `rgba(255, 215, 120, ${alpha * 0.55})`;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255, 245, 200, ${alpha})`;
    ctx.stroke();
    ctx.restore();
  }
}

class FireFanBehaviour extends BehaviourBase {
  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    this.regressCadence(ctx.dtMs);
    if (this.cadenceRemainMs > 0) {
      return;
    }

    const merged = mergeProfile(ctx, this.weaponId, weaponLevel);
    const data = requireWeapon(this.weaponId);
    const bolts = Math.max(1, Math.round(merged.count));

    for (let i = 0; i < bolts; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      spawnDirectedBolt(ctx, merged, data, Math.cos(theta), Math.sin(theta));
    }

    this.cadenceRemainMs = merged.cooldownMs;
  }
}

class WardingAuraBehaviour extends BehaviourBase {
  private lastPlayerX = 0;
  private lastPlayerY = 0;
  private lastAuraRadius = 0;

  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    this.lastPlayerX = ctx.playerOriginX;
    this.lastPlayerY = ctx.playerOriginY;

    const merged = mergeProfile(ctx, this.weaponId, weaponLevel);
    this.lastAuraRadius =
      PLAYER_MELEE_AURA_BASE * merged.areaMultiplier +
      merged.count * GARLIC_RADIUS_STEP;

    this.regressCadence(ctx.dtMs);
    if (this.cadenceRemainMs > 0) {
      return;
    }

    ctx.forEachEnemyInDisc(
      ctx.playerOriginX,
      ctx.playerOriginY,
      this.lastAuraRadius,
      (enemy) =>
        ctx.applyWeaponDamage({
          enemy,
          impactWorldX: enemy.x,
          impactWorldY: enemy.y,
          damagePayload: Math.max(1, merged.damage * 0.55),
        }),
    );

    this.cadenceRemainMs = merged.cooldownMs;
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    if (this.lastAuraRadius > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.lastPlayerX, this.lastPlayerY, this.lastAuraRadius, 0, Math.PI * 2);
      
      ctx.fillStyle = "rgba(180, 255, 120, 0.15)";
      ctx.fill();
      
      const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
      ctx.strokeStyle = `rgba(180, 255, 120, ${0.2 + 0.3 * pulse})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.restore();
    }
  }
}

const PLAYER_MELEE_AURA_BASE = 110;
const GARLIC_RADIUS_STEP = 10;

interface PoolVisual {
  x: number;
  y: number;
  radius: number;
  ttlMs: number;
  maxTtlMs: number;
}

class ConsecratedPoolBehaviour extends BehaviourBase {
  private pools: PoolVisual[] = [];

  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const pool = this.pools[i];
      if (pool) {
        pool.ttlMs -= ctx.dtMs;
        if (pool.ttlMs <= 0) this.pools.splice(i, 1);
      }
    }

    this.regressCadence(ctx.dtMs);
    if (this.cadenceRemainMs > 0) {
      return;
    }

    const merged = mergeProfile(ctx, this.weaponId, weaponLevel);
    const drops = Math.max(1, Math.round(merged.count));
    const poolRadius =
      (120 + merged.speedMultiplier * 8) * Math.sqrt(merged.areaMultiplier);
    const poolTtlMs = Math.max(
      250,
      Math.floor(1500 * merged.durationMultiplier),
    );

    for (let d = 0; d < drops; d += 1) {
      const ox = (Math.random() - 0.5) * 460 * merged.areaMultiplier;
      const oy = (Math.random() - 0.5) * 280 * merged.areaMultiplier;
      const cx = ctx.playerOriginX + ox;
      const cy = ctx.playerOriginY + oy;

      this.pools.push({
        x: cx,
        y: cy,
        radius: poolRadius,
        ttlMs: poolTtlMs,
        maxTtlMs: poolTtlMs,
      });

      ctx.forEachEnemyInDisc(cx, cy, poolRadius, (enemy) =>
        ctx.applyWeaponDamage({
          enemy,
          impactWorldX: enemy.x,
          impactWorldY: enemy.y,
          damagePayload: Math.max(1, merged.damage * 0.45),
        }),
      );
    }

    this.cadenceRemainMs = merged.cooldownMs;
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    for (const pool of this.pools) {
      const alpha = Math.max(0, pool.ttlMs / pool.maxTtlMs);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(pool.x, pool.y, pool.radius, pool.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 150, 255, ${alpha * 0.4})`;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(150, 200, 255, ${alpha * 0.8})`;
      ctx.stroke();
      ctx.restore();
    }
  }
}

class RuneTracerBehaviour extends BehaviourBase {
  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    this.regressCadence(ctx.dtMs);
    if (this.cadenceRemainMs > 0) {
      return;
    }

    const merged = mergeProfile(ctx, this.weaponId, weaponLevel);
    const data = requireWeapon(this.weaponId);
    let dirX = ctx.aimX;
    let dirY = ctx.aimY;
    const focus = ctx.findNearestEnemy(ctx.playerOriginX, ctx.playerOriginY);
    if (focus !== undefined) {
      const dx = focus.x - ctx.playerOriginX;
      const dy = focus.y - ctx.playerOriginY;
      const len = Math.hypot(dx, dy);
      if (len > 1e-4) {
        dirX = dx / len;
        dirY = dy / len;
      }
    }
    ({ x: dirX, y: dirY } = normalizeVector(dirX, dirY));

    const hitsAllowed =
      merged.count +
      Math.max(0, Math.round(data.pierceBias ?? merged.count));

    spawnDirectedBolt(
      ctx,
      merged,
      data,
      dirX,
      dirY,
      0,
      Math.max(2, hitsAllowed),
    );

    this.cadenceRemainMs = merged.cooldownMs;
  }
}

interface LightningVisual {
  x: number;
  y: number;
  radius: number;
  ttlMs: number;
  maxTtlMs: number;
}

class LightningNovaBehaviour extends BehaviourBase {
  private strikes: LightningVisual[] = [];

  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const strike = this.strikes[i];
      if (strike) {
        strike.ttlMs -= ctx.dtMs;
        if (strike.ttlMs <= 0) this.strikes.splice(i, 1);
      }
    }

    this.regressCadence(ctx.dtMs);
    if (this.cadenceRemainMs > 0) {
      return;
    }

    const merged = mergeProfile(ctx, this.weaponId, weaponLevel);
    const strikesCount = Math.max(1, Math.round(merged.count));
    const radius = (150 + merged.areaMultiplier * 40) * 0.9;

    for (let s = 0; s < strikesCount; s += 1) {
      const prey = ctx.pickRandomEnemyCandidate();
      if (prey === undefined) {
        break;
      }

      this.strikes.push({
        x: prey.x,
        y: prey.y,
        radius,
        ttlMs: 250,
        maxTtlMs: 250,
      });

      ctx.forEachEnemyInDisc(prey.x, prey.y, radius, (enemy) =>
        ctx.applyWeaponDamage({
          enemy,
          impactWorldX: enemy.x,
          impactWorldY: enemy.y,
          damagePayload: merged.damage,
        }),
      );
    }

    this.cadenceRemainMs = merged.cooldownMs;
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    for (const strike of this.strikes) {
      const alpha = Math.max(0, strike.ttlMs / strike.maxTtlMs);
      ctx.save();
      
      ctx.beginPath();
      ctx.arc(strike.x, strike.y, strike.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 255, 255, ${alpha * 0.2})`;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = `rgba(200, 255, 255, ${alpha * 0.8})`;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(strike.x, strike.y - 800);
      ctx.lineTo(strike.x, strike.y);
      ctx.lineWidth = 12 * alpha;
      ctx.strokeStyle = `rgba(200, 255, 255, ${alpha})`;
      ctx.stroke();

      ctx.restore();
    }
  }
}

interface SigilNovaVisual {
  x: number;
  y: number;
  radius: number;
  ttlMs: number;
  maxTtlMs: number;
}

class SigilNovaBehaviour extends BehaviourBase {
  private shocks: SigilNovaVisual[] = [];

  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const shock = this.shocks[i];
      if (shock) {
        shock.ttlMs -= ctx.dtMs;
        if (shock.ttlMs <= 0) this.shocks.splice(i, 1);
      }
    }

    this.regressCadence(ctx.dtMs);
    if (this.cadenceRemainMs > 0) {
      return;
    }

    const merged = mergeProfile(ctx, this.weaponId, weaponLevel);
    const screenClearRadius = 760 * merged.areaMultiplier;

    this.shocks.push({
      x: ctx.playerOriginX,
      y: ctx.playerOriginY,
      radius: screenClearRadius,
      ttlMs: 400,
      maxTtlMs: 400,
    });

    ctx.forEachEnemyInDisc(
      ctx.playerOriginX,
      ctx.playerOriginY,
      screenClearRadius,
      (enemy) =>
        ctx.applyWeaponDamage({
          enemy,
          impactWorldX: enemy.x,
          impactWorldY: enemy.y,
          damagePayload: merged.damage,
        }),
    );

    this.cadenceRemainMs = merged.cooldownMs;
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    for (const shock of this.shocks) {
      const p = 1 - Math.max(0, shock.ttlMs / shock.maxTtlMs);
      const alpha = 1 - p;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(shock.x, shock.y, shock.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 50, 80, ${alpha * 0.5})`;
      ctx.fill();
      ctx.lineWidth = 15;
      ctx.strokeStyle = `rgba(255, 200, 50, ${alpha * 0.8})`;
      ctx.stroke();
      ctx.restore();
    }
  }
}

function spawnDirectedBolt(
  ctx: WeaponRuntimeContext,
  merged: ReturnType<typeof amplifyMergedWeaponDamageProfile>,
  data: WeaponData,
  dirX: number,
  dirY: number,
  gravity = 0,
  hitQuota?: number,
): void {
  const dirLen = Math.hypot(dirX, dirY);
  if (dirLen <= 1e-4) {
    return;
  }

  ctx.spawnDirectedProjectile({
    originX: ctx.playerOriginX,
    originY: ctx.playerOriginY,
    dirX,
    dirY,
    damage: merged.damage,
    speedMultiplier: merged.speedMultiplier,
    areaMultiplier: merged.areaMultiplier,
    projectileRadiusPxBase: pickProjectileFootprintRadius(data),
    ttlMs:
      data.projectileTtlMs !== undefined ? data.projectileTtlMs : MAGIC_WAND_PROJECTILE_TTL_MS,
    gravityYPerSec2: gravity !== 0 ? gravity : undefined,
    hitQuota: hitQuota ?? 1,
  });
}

function pickProjectileFootprintRadius(data: WeaponData): number {
  if (data.projectileRadiusPx !== undefined) {
    return data.projectileRadiusPx;
  }

  switch (data.loopKind as WeaponLoopKind) {
    case "knife_stream":
      return PROJECTILE_WAND_RADIUS_PX * 0.9;
    case "axe_lob":
      return 12;
    case "cross_quartet":
      return PROJECTILE_WAND_RADIUS_PX * 1.1;
    default:
      return PROJECTILE_WAND_RADIUS_PX;
  }
}

function normalizeVector(ax: number, ay: number): { x: number; y: number } {
  const len = Math.hypot(ax, ay);
  if (len <= 1e-4) {
    return { x: 1, y: 0 };
  }

  return { x: ax / len, y: ay / len };
}
