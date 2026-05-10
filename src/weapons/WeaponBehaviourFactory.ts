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

const VFX_MEDIUM_SHEET_SRC = "/assets/vfx/vfx_medium_atlas.png";
const LASH_STRIP_RECT = { x: 384, y: 0, w: 192, h: 192 };
const RITUAL_WAVE_RECT = { x: 576, y: 0, w: 192, h: 192 };
const HOLY_RING_RECT = { x: 0, y: 0, w: 192, h: 192 };
const WEAPON_ICONS_SHEET_SRC = "/assets/weapons/weapon_icons_64_atlas.png";
const ORBITING_TOME_RECT = { x: 256, y: 64, w: 64, h: 64 };
const NOCTURNE_TOME_RECT = { x: 320, y: 64, w: 64, h: 64 };
let vfxMediumSheetImage: HTMLImageElement | null = null;
let vfxMediumSheetRequested = false;
let weaponIconsSheetImage: HTMLImageElement | null = null;
let weaponIconsSheetRequested = false;

/** Interface implemented by authored weapon behaviours. */
export interface WeaponHudState {
  ready: boolean;
  cooldownRemainingMs: number;
}

export interface WeaponBehaviour {
  readonly weaponId: string;
  tick(ctx: WeaponRuntimeContext, weaponLevel: number): void;
  renderWorld?(ctx: CanvasRenderingContext2D): void;
  getHudState?(): WeaponHudState;
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

  getHudState(): WeaponHudState {
    return {
      ready: this.cadenceRemainMs <= 0,
      cooldownRemainingMs: Math.max(0, this.cadenceRemainMs),
    };
  }
}

interface LashStrikeVisual {
  midX: number;
  midY: number;
  a: number;
  b: number;
  angle: number;
  tipX: number;
  tipY: number;
  tailX: number;
  tailY: number;
  curlDir: number;
  recoilPx: number;
  swingPhase: number;
  arcLiftPx: number;
  tipCrackPx: number;
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
      const curve = 18 * merged.areaMultiplier;
      const tipX = ctx.playerOriginX + currentDirX * reachLength + perpX * curve;
      const tipY = ctx.playerOriginY + currentDirY * reachLength + perpY * curve;
      const tailX = ctx.playerOriginX - currentDirX * 8 - perpX * 3;
      const tailY = ctx.playerOriginY - currentDirY * 8 - perpY * 3;

      const midX = ctx.playerOriginX + currentDirX * a + perpX * lateralOffset;
      const midY = ctx.playerOriginY + currentDirY * a + perpY * lateralOffset;
      const angle = Math.atan2(currentDirY, currentDirX);

      this.strikes.push({
        midX,
        midY,
        a,
        b,
        angle,
        tipX,
        tipY,
        tailX,
        tailY,
        curlDir: i % 2 === 0 ? 1 : -1,
        recoilPx: 14,
        swingPhase: i * 0.8,
        arcLiftPx: 14 + merged.areaMultiplier * 4,
        tipCrackPx: 10 + merged.areaMultiplier * 3,
        ttlMs: 220,
        maxTtlMs: 220,
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

    ctx.spawnSkillBurst(
      ctx.playerOriginX + dirX * 16,
      ctx.playerOriginY + dirY * 6,
      this.weaponId === "bloody_tear" ? "#ff6b7a" : "#dfe7ff",
      1.05 + merged.areaMultiplier * 0.12,
    );
    ctx.spawnSkillBurst(
      ctx.playerOriginX + dirX * 84,
      ctx.playerOriginY + dirY * 10,
      this.weaponId === "bloody_tear" ? "#ff8e99" : "#b9d2ff",
      1.18 + merged.areaMultiplier * 0.16,
    );
    this.cadenceRemainMs = merged.cooldownMs;
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    for (const strike of this.strikes) {
      const life = Math.max(0, strike.ttlMs / strike.maxTtlMs);
      const progress = 1 - life;
      const castPhase = Math.min(1, progress / 0.34);
      const snapPhase = Math.min(1, Math.max(0, (progress - 0.2) / 0.36));
      const recoilPhase = Math.min(1, Math.max(0, (progress - 0.58) / 0.42));
      const alpha = Math.min(1, life * 1.18);
      const snap = Math.sin(snapPhase * Math.PI) * 1.38;
      const recoil = strike.recoilPx * recoilPhase;
      const lift = (1 - castPhase) * strike.arcLiftPx;
      const swing = Math.sin(progress * Math.PI * 1.8 + strike.swingPhase) * 7 * life;
      
      ctx.save();
      ctx.translate(
        -(strike.tipX - strike.tailX) * 0.014 * recoil,
        -(strike.tipY - strike.tailY) * 0.014 * recoil,
      );
      
      const baseColor = this.weaponId === "bloody_tear"
        ? { fill: `rgba(220, 20, 60, ${alpha * 0.45})`, stroke: `rgba(255, 126, 126, ${alpha})`, glow: `rgba(255, 80, 112, ${alpha * 0.34})` }
        : { fill: `rgba(214, 229, 255, ${alpha * 0.45})`, stroke: `rgba(255, 255, 255, ${alpha})`, glow: `rgba(145, 190, 255, ${alpha * 0.3})` };

      drawLashStripSprite(
        ctx,
        strike,
        alpha,
        this.weaponId === "bloody_tear",
      );

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.strokeStyle = baseColor.glow;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(strike.tailX, strike.tailY);
      ctx.quadraticCurveTo(
        strike.midX + strike.curlDir * (20 * castPhase + 24 * snap) + swing * strike.curlDir,
        strike.midY - 8 - lift,
        strike.tipX,
        strike.tipY,
      );
      ctx.stroke();

      ctx.strokeStyle = baseColor.stroke;
      ctx.lineWidth = 5.2;
      ctx.beginPath();
      ctx.moveTo(strike.tailX, strike.tailY);
      ctx.quadraticCurveTo(
        strike.midX + strike.curlDir * (14 * castPhase + 18 * snap) + swing * 0.7 * strike.curlDir,
        strike.midY - 4 - lift * 0.72,
        strike.tipX,
        strike.tipY,
      );
      ctx.stroke();

      const segmentCount = 6;
      for (let segment = 1; segment < segmentCount; segment += 1) {
        const t = segment / segmentCount;
        const oneMinus = 1 - t;
        const knotX =
          oneMinus * oneMinus * strike.tailX +
          2 * oneMinus * t * (strike.midX + strike.curlDir * (7 + 10 * snap) + swing * 0.5 * strike.curlDir) +
          t * t * strike.tipX;
        const knotY =
          oneMinus * oneMinus * strike.tailY +
          2 * oneMinus * t * (strike.midY - 4 - lift * 0.55) +
          t * t * strike.tipY;
        ctx.beginPath();
        ctx.arc(knotX, knotY, Math.max(1.2, 3.4 - t * 1.8), 0, Math.PI * 2);
        ctx.fillStyle = this.weaponId === "bloody_tear"
          ? `rgba(255, 208, 214, ${alpha * (0.35 - t * 0.18)})`
          : `rgba(242, 247, 255, ${alpha * (0.35 - t * 0.18)})`;
        ctx.fill();
      }

      ctx.fillStyle = baseColor.fill;
      ctx.beginPath();
      ctx.arc(strike.tipX, strike.tipY, 6.4 + snap * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // Whip crack highlight at the tip during peak snap.
      const crackAlpha = alpha * Math.sin(snapPhase * Math.PI) * (1 - recoilPhase * 0.35);
      if (crackAlpha > 0.02) {
        ctx.beginPath();
        ctx.ellipse(
          strike.tipX + Math.cos(strike.angle) * strike.tipCrackPx,
          strike.tipY + Math.sin(strike.angle) * strike.tipCrackPx,
          9 + snap * 4,
          3 + snap * 1.4,
          strike.angle,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = this.weaponId === "bloody_tear"
          ? `rgba(255, 214, 220, ${crackAlpha * 0.72})`
          : `rgba(255, 255, 255, ${crackAlpha * 0.65})`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(strike.tailX, strike.tailY, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.35})`;
      ctx.fill();
      
      ctx.restore();
    }
  }
}

class MagicVolleyBehaviour extends BehaviourBase {
  private castPhase = 0;

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

      const offset = (idx - (shots - 1) * 0.5) * (9 + merged.areaMultiplier * 2.4);
      const perpX = -aimY;
      const perpY = aimX;
      const sideWave = Math.sin(this.castPhase + idx * 0.72) * 3.6;
      const front = 12 + merged.areaMultiplier * 3.5;
      ctx.spawnSkillBurst(
        ctx.playerOriginX + aimX * front + perpX * (offset + sideWave),
        ctx.playerOriginY + aimY * front + perpY * (offset + sideWave),
        "#8ca0ff",
        0.72 + merged.areaMultiplier * 0.08,
      );
    }
    ctx.spawnSkillBurst(
      ctx.playerOriginX + aimX * 12,
      ctx.playerOriginY + aimY * 12,
      "#7b8cff",
      0.95,
    );
    ctx.spawnSkillBurst(
      ctx.playerOriginX + aimX * 22,
      ctx.playerOriginY + aimY * 22,
      "#c9d3ff",
      0.74,
    );
    this.castPhase += 0.82;

    this.cadenceRemainMs = merged.cooldownMs;
  }
}

function drawLashStripSprite(
  ctx: CanvasRenderingContext2D,
  strike: LashStrikeVisual,
  alpha: number,
  isCrimson: boolean,
): void {
  const sheet = getVfxMediumSheetImage();
  if (sheet === null) {
    return;
  }

  const dx = strike.tipX - strike.tailX;
  const dy = strike.tipY - strike.tailY;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return;
  }

  const angle = Math.atan2(dy, dx);
  const thickness = 18 + Math.sin((1 - alpha) * Math.PI) * 7;
  const tintAlpha = Math.min(0.52, alpha * 0.56);

  ctx.save();
  ctx.globalAlpha = tintAlpha;
  ctx.translate(strike.tailX, strike.tailY);
  ctx.rotate(angle);
  ctx.drawImage(
    sheet,
    LASH_STRIP_RECT.x,
    LASH_STRIP_RECT.y,
    LASH_STRIP_RECT.w,
    LASH_STRIP_RECT.h,
    -10,
    -thickness * 0.5,
    length + 20,
    thickness,
  );

  if (isCrimson) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(255, 72, 102, ${Math.min(0.3, alpha * 0.32)})`;
    ctx.fillRect(-10, -thickness * 0.5, length + 20, thickness);
  }
  ctx.restore();
}

function getVfxMediumSheetImage(): HTMLImageElement | null {
  if (vfxMediumSheetImage !== null && vfxMediumSheetImage.complete) {
    return vfxMediumSheetImage;
  }
  if (vfxMediumSheetRequested) {
    return null;
  }

  vfxMediumSheetRequested = true;
  const img = new Image();
  img.src = VFX_MEDIUM_SHEET_SRC;
  img.onload = () => {
    vfxMediumSheetImage = img;
  };
  img.onerror = () => {
    vfxMediumSheetRequested = false;
  };
  return null;
}

function getWeaponIconsSheetImage(): HTMLImageElement | null {
  if (weaponIconsSheetImage !== null && weaponIconsSheetImage.complete) {
    return weaponIconsSheetImage;
  }
  if (weaponIconsSheetRequested) {
    return null;
  }

  weaponIconsSheetRequested = true;
  const img = new Image();
  img.src = WEAPON_ICONS_SHEET_SRC;
  img.onload = () => {
    weaponIconsSheetImage = img;
  };
  img.onerror = () => {
    weaponIconsSheetRequested = false;
  };
  return null;
}

class ShardStreamBehaviour extends BehaviourBase {
  private castPhase = 0;

  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    this.regressCadence(ctx.dtMs);
    if (this.cadenceRemainMs > 0) {
      return;
    }

    const merged = mergeProfile(ctx, this.weaponId, weaponLevel);
    const data = requireWeapon(this.weaponId);
    const bursts = Math.max(1, Math.round(merged.count));
    const playerFacing = normalizeVector(ctx.aimX, ctx.aimY);
    const aimX = playerFacing.x;
    const aimY = playerFacing.y;
    const baseAngle = Math.atan2(aimY, aimX);

    for (let burst = 0; burst < bursts; burst += 1) {
      const jitter =
        (burst - (bursts - 1) * 0.5) * (MAGIC_WAND_MULTI_SHOT_SPREAD_RAD * 0.6);
      const theta = baseAngle + jitter;
      spawnDirectedBolt(ctx, merged, data, Math.cos(theta), Math.sin(theta));

      const sidePerpX = -aimY;
      const sidePerpY = aimX;
      const lateral = (burst - (bursts - 1) * 0.5) * (8 + merged.areaMultiplier * 2.5);
      const front = 10 + merged.areaMultiplier * 3.2;
      const phaseWave = Math.sin(this.castPhase + burst * 0.85) * 3.4;
      const burstX = ctx.playerOriginX + aimX * front + sidePerpX * lateral;
      const burstY = ctx.playerOriginY + aimY * front + sidePerpY * lateral;
      ctx.spawnSkillBurst(
        burstX + sidePerpX * phaseWave * 0.6,
        burstY + sidePerpY * phaseWave * 0.6,
        "#dce8ff",
        0.75 + merged.areaMultiplier * 0.08,
      );
    }
    ctx.spawnSkillBurst(
      ctx.playerOriginX + aimX * 11,
      ctx.playerOriginY + aimY * 11,
      "#f2f7ff",
      0.94 + merged.areaMultiplier * 0.08,
    );
    ctx.spawnSkillBurst(
      ctx.playerOriginX + aimX * 18,
      ctx.playerOriginY + aimY * 18,
      "#9fbaff",
      0.72 + merged.areaMultiplier * 0.07,
    );
    this.castPhase += 0.9;

    this.cadenceRemainMs = merged.cooldownMs;
  }
}

class CleaverArcBehaviour extends BehaviourBase {
  private castPhase = 0;

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

      const lane = ix - (bursts - 1) * 0.5;
      const arcLift = Math.sin(this.castPhase + ix * 0.5) * 2.4;
      ctx.spawnSkillBurst(
        ctx.playerOriginX + Math.cos(theta) * (9 + lane * 2),
        ctx.playerOriginY + Math.sin(theta) * (9 + lane * 2) - arcLift,
        "#ffb26c",
        0.72 + merged.areaMultiplier * 0.06,
      );
    }
    ctx.spawnSkillBurst(ctx.playerOriginX + dirX * 8, ctx.playerOriginY + dirY * 8, "#ffbb6a", 0.96);
    this.castPhase += 0.63;

    this.cadenceRemainMs = merged.cooldownMs;
  }
}

class SanctumCrossBehaviour extends BehaviourBase {
  private phase = 0;
  private pulses: Array<{
    x: number;
    y: number;
    phase: number;
    ttlMs: number;
    maxTtlMs: number;
    radius: number;
  }> = [];

  override tick(ctx: WeaponRuntimeContext, weaponLevel: number): void {
    for (let i = this.pulses.length - 1; i >= 0; i -= 1) {
      const pulse = this.pulses[i];
      if (pulse === undefined) {
        continue;
      }
      pulse.ttlMs -= ctx.dtMs;
      if (pulse.ttlMs <= 0) {
        this.pulses.splice(i, 1);
      }
    }

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

    this.pulses.push({
      x: ctx.playerOriginX,
      y: ctx.playerOriginY,
      phase: this.phase * 0.67,
      ttlMs: 280,
      maxTtlMs: 280,
      radius: 34 + merged.areaMultiplier * 12,
    });

    // Ritual cross pulse: center ignition + 4 directional flares with phase rotation.
    const coreScale = 1.08 + merged.areaMultiplier * 0.1;
    ctx.spawnSkillBurst(ctx.playerOriginX, ctx.playerOriginY, "#ffd95a", coreScale);
    ctx.spawnSkillBurst(ctx.playerOriginX, ctx.playerOriginY, "#fff2b7", coreScale * 0.72);

    const phaseAngle = this.phase * 0.58;
    const outward = 18 + merged.areaMultiplier * 7;
    for (let i = 0; i < cardinals.length; i += 1) {
      const dir = cardinals[i];
      if (dir === undefined) {
        continue;
      }
      const spin = phaseAngle + i * (Math.PI * 0.5);
      const swirlX = Math.cos(spin) * 5;
      const swirlY = Math.sin(spin) * 5;
      const burstX = ctx.playerOriginX + dir.x * outward + swirlX;
      const burstY = ctx.playerOriginY + dir.y * outward + swirlY;
      ctx.spawnSkillBurst(
        burstX,
        burstY,
        i % 2 === 0 ? "#ffd95a" : "#ffe99a",
        0.84 + merged.areaMultiplier * 0.08,
      );
    }
    this.phase += 1;

    this.cadenceRemainMs = merged.cooldownMs;
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    const sheet = getVfxMediumSheetImage();
    for (const pulse of this.pulses) {
      const life = Math.max(0, pulse.ttlMs / pulse.maxTtlMs);
      const progress = 1 - life;
      const ringRadius = pulse.radius + progress * 24;
      const glowAlpha = life * 0.5;

      if (sheet !== null) {
        const size = ringRadius * 2.25;
        ctx.save();
        ctx.globalAlpha = glowAlpha * 0.9;
        ctx.drawImage(
          sheet,
          HOLY_RING_RECT.x,
          HOLY_RING_RECT.y,
          HOLY_RING_RECT.w,
          HOLY_RING_RECT.h,
          pulse.x - size / 2,
          pulse.y - size / 2,
          size,
          size,
        );
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = "rgba(255, 244, 196, 0.54)";
        ctx.fillRect(pulse.x - size / 2, pulse.y - size / 2, size, size);
        ctx.restore();
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 245, 208, ${0.34 + glowAlpha * 0.64})`;
      ctx.lineWidth = 1.85;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, ringRadius * 0.62, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 229, 154, ${0.22 + glowAlpha * 0.42})`;
      ctx.lineWidth = 1.05;
      ctx.stroke();

      const beamLen = ringRadius * 0.95;
      const beamThickness = 1.7 + life * 0.92;
      const phase = pulse.phase + progress * 0.9;
      const dirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      for (let i = 0; i < dirs.length; i += 1) {
        const dir = dirs[i];
        if (dir === undefined) {
          continue;
        }
        const wave = Math.sin(phase + i * (Math.PI / 2)) * 4.2;
        ctx.beginPath();
        ctx.moveTo(pulse.x, pulse.y);
        ctx.lineTo(
          pulse.x + dir.x * beamLen + (dir.y * wave),
          pulse.y + dir.y * beamLen - (dir.x * wave),
        );
        ctx.strokeStyle = `rgba(255, 250, 224, ${0.34 + glowAlpha * 0.42})`;
        ctx.lineWidth = beamThickness;
        ctx.stroke();
      }
      ctx.restore();
    }
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

  override getHudState(): WeaponHudState {
    const coolingDown = this.cadenceRemainMs > 0;
    const active = this.activeRemainMs > 0;
    return {
      ready: !coolingDown && !active,
      cooldownRemainingMs: Math.max(0, active ? this.activeRemainMs : this.cadenceRemainMs),
    };
  }

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

    ctx.spawnSkillBurst(orbX, orbY, "#ffd95a", 0.75 + merged.areaMultiplier * 0.12);

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
    const weaponSheet = getWeaponIconsSheetImage();
    const isUnholy = this.weaponId === "unholy_vespers";
    ctx.save();
    if (weaponSheet !== null) {
      const rect = isUnholy ? NOCTURNE_TOME_RECT : ORBITING_TOME_RECT;
      const angle = this.orbitPhaseRad + this.orbitVisual.progress * Math.PI * 2.3;
      const drawSize = this.orbitVisual.radius * 2.25;
      ctx.translate(this.orbitVisual.x, this.orbitVisual.y);
      ctx.rotate(angle);
      ctx.globalAlpha = alpha;
      ctx.drawImage(
        weaponSheet,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        -drawSize / 2,
        -drawSize / 2,
        drawSize,
        drawSize,
      );
      ctx.globalCompositeOperation = "destination-over";
      ctx.beginPath();
      ctx.arc(0, 0, this.orbitVisual.radius * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = isUnholy
        ? `rgba(176, 132, 255, ${alpha * 0.32})`
        : `rgba(255, 218, 128, ${alpha * 0.3})`;
      ctx.fill();
    } else {
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
    }
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
    ctx.spawnSkillBurst(ctx.playerOriginX, ctx.playerOriginY, "#ff9040", 0.95);

    this.cadenceRemainMs = merged.cooldownMs;
  }
}

class WardingAuraBehaviour extends BehaviourBase {
  private lastPlayerX = 0;
  private lastPlayerY = 0;
  private lastAuraRadius = 0;
  private pulsePhase = 0;

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

    ctx.spawnSkillBurst(
      ctx.playerOriginX,
      ctx.playerOriginY,
      "#7fe0a8",
      0.9 + merged.areaMultiplier * 0.08,
    );
    ctx.spawnSkillBurst(
      ctx.playerOriginX + Math.cos(this.pulsePhase) * (this.lastAuraRadius * 0.42),
      ctx.playerOriginY + Math.sin(this.pulsePhase) * (this.lastAuraRadius * 0.42),
      "#9cf0ba",
      0.58 + merged.areaMultiplier * 0.04,
    );
    this.pulsePhase += 0.72;

    this.cadenceRemainMs = merged.cooldownMs;
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    if (this.lastAuraRadius > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.lastPlayerX, this.lastPlayerY, this.lastAuraRadius, 0, Math.PI * 2);
      
      ctx.fillStyle = "rgba(180, 255, 120, 0.09)";
      ctx.fill();
      
      const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
      ctx.strokeStyle = `rgba(180, 255, 120, ${0.14 + 0.22 * pulse})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(this.lastPlayerX, this.lastPlayerY, this.lastAuraRadius * 0.62, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(170, 240, 140, ${0.08 + 0.12 * pulse})`;
      ctx.lineWidth = 1.2;
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
  private dropPhase = 0;

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

      ctx.spawnSkillBurst(cx, cy, "#89a6ff", 0.95);
      ctx.spawnSkillBurst(
        cx + Math.cos(this.dropPhase + d) * (poolRadius * 0.2),
        cy + Math.sin(this.dropPhase + d) * (poolRadius * 0.14),
        "#b8cbff",
        0.62,
      );
    }
    this.dropPhase += 0.57;

    this.cadenceRemainMs = merged.cooldownMs;
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    for (const pool of this.pools) {
      const alpha = Math.max(0, pool.ttlMs / pool.maxTtlMs);
      ctx.save();

      const sheet = getVfxMediumSheetImage();
      if (sheet !== null) {
        const pulse = 0.92 + Math.sin((1 - alpha) * Math.PI * 1.6) * 0.08;
        const w = pool.radius * 2.2 * pulse;
        const h = pool.radius * 1.45 * pulse;
        ctx.globalAlpha = alpha * 0.48;
        ctx.drawImage(
          sheet,
          RITUAL_WAVE_RECT.x,
          RITUAL_WAVE_RECT.y,
          RITUAL_WAVE_RECT.w,
          RITUAL_WAVE_RECT.h,
          pool.x - w / 2,
          pool.y - h / 2,
          w,
          h,
        );
      }

      ctx.beginPath();
      ctx.ellipse(pool.x, pool.y, pool.radius, pool.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 150, 255, ${alpha * 0.28})`;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(150, 200, 255, ${alpha * 0.62})`;
      ctx.stroke();
      ctx.restore();
    }
  }
}

class RuneTracerBehaviour extends BehaviourBase {
  private pulsePhase = 0;

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

    ctx.spawnSkillBurst(ctx.playerOriginX + dirX * 16, ctx.playerOriginY + dirY * 16, "#c892ff", 0.9);
    ctx.spawnSkillBurst(
      ctx.playerOriginX + dirX * 22 + Math.cos(this.pulsePhase) * 4,
      ctx.playerOriginY + dirY * 22 + Math.sin(this.pulsePhase) * 4,
      "#e1b6ff",
      0.58,
    );
    this.pulsePhase += 0.86;

    this.cadenceRemainMs = merged.cooldownMs;
  }
}

interface LightningVisual {
  x: number;
  y: number;
  radius: number;
  phase: number;
  ttlMs: number;
  maxTtlMs: number;
}

class LightningNovaBehaviour extends BehaviourBase {
  private strikes: LightningVisual[] = [];
  private phase = 0;

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
        phase: this.phase + s * 0.7,
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

      ctx.spawnSkillBurst(prey.x, prey.y, "#7fe0ff", 1.0);
    }
    this.phase += 0.8;

    this.cadenceRemainMs = merged.cooldownMs;
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    const sheet = getVfxMediumSheetImage();
    for (const strike of this.strikes) {
      const life = Math.max(0, strike.ttlMs / strike.maxTtlMs);
      const alpha = life;
      const progress = 1 - life;
      ctx.save();

      if (sheet !== null) {
        const size = strike.radius * 2.15;
        ctx.globalAlpha = alpha * 0.44;
        ctx.drawImage(
          sheet,
          HOLY_RING_RECT.x,
          HOLY_RING_RECT.y,
          HOLY_RING_RECT.w,
          HOLY_RING_RECT.h,
          strike.x - size / 2,
          strike.y - size / 2,
          size,
          size,
        );
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = "rgba(166, 232, 255, 0.42)";
        ctx.fillRect(strike.x - size / 2, strike.y - size / 2, size, size);
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.arc(strike.x, strike.y, strike.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 245, 255, ${alpha * 0.16})`;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = `rgba(206, 246, 255, ${alpha * 0.82})`;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(strike.x, strike.y, strike.radius * (0.58 + progress * 0.1), 0, Math.PI * 2);
      ctx.lineWidth = 1.15;
      ctx.strokeStyle = `rgba(184, 236, 255, ${alpha * 0.66})`;
      ctx.stroke();

      const beamLen = strike.radius * 0.86;
      const beamThickness = 1.4 + alpha * 1.2;
      const dirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      for (let i = 0; i < dirs.length; i += 1) {
        const dir = dirs[i];
        if (dir === undefined) {
          continue;
        }
        const wave = Math.sin(strike.phase + progress * 1.1 + i * (Math.PI / 2)) * 3.4;
        ctx.beginPath();
        ctx.moveTo(strike.x, strike.y);
        ctx.lineTo(
          strike.x + dir.x * beamLen + dir.y * wave,
          strike.y + dir.y * beamLen - dir.x * wave,
        );
        ctx.strokeStyle = `rgba(216, 252, 255, ${alpha * 0.72})`;
        ctx.lineWidth = beamThickness;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(strike.x, strike.y - 800);
      ctx.lineTo(strike.x, strike.y);
      ctx.lineWidth = 8 * alpha;
      ctx.strokeStyle = `rgba(200, 246, 255, ${alpha * 0.88})`;
      ctx.stroke();

      ctx.restore();
    }
  }
}

interface SigilNovaVisual {
  x: number;
  y: number;
  radius: number;
  shardSeeds: Array<{
    angle: number;
    distNorm: number;
    speedNorm: number;
    sizeNorm: number;
  }>;
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
      shardSeeds: this.buildShardSeeds(),
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
      const revealWindow = 0.42;
      const shatterProgress = Math.max(0, (p - revealWindow) / (1 - revealWindow));

      ctx.save();
      ctx.translate(shock.x, shock.y);

      // Stage 1: ritual symbol reveals briefly.
      if (p <= revealWindow) {
        const revealT = p / revealWindow;
        const sigilAlpha = Math.min(1, revealT * 1.45) * alpha;
        const spin = revealT * 0.24;
        ctx.rotate(spin);

        ctx.beginPath();
        ctx.arc(0, 0, shock.radius * 0.52, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(242, 250, 255, ${sigilAlpha * 0.72})`;
        ctx.lineWidth = 6.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, shock.radius * 0.34, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(212, 236, 255, ${sigilAlpha * 0.62})`;
        ctx.lineWidth = 3.2;
        ctx.stroke();

        // 8-point sigil star
        for (let i = 0; i < 8; i += 1) {
          const theta = (Math.PI * 2 * i) / 8;
          const outerR = shock.radius * 0.44;
          const innerR = shock.radius * 0.19;
          ctx.beginPath();
          ctx.moveTo(Math.cos(theta) * innerR, Math.sin(theta) * innerR);
          ctx.lineTo(Math.cos(theta) * outerR, Math.sin(theta) * outerR);
          ctx.strokeStyle = `rgba(232, 247, 255, ${sigilAlpha * 0.68})`;
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
      } else {
        // Stage 2: symbol shatters like glass fragments.
        const shardAlpha = (1 - shatterProgress) * alpha;

        // Expanding crack ring remnants
        ctx.beginPath();
        ctx.arc(0, 0, shock.radius * (0.44 + shatterProgress * 0.28), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(225, 244, 255, ${shardAlpha * 0.52})`;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        for (const seed of shock.shardSeeds) {
          const travel = shock.radius * (0.12 + seed.distNorm * 0.3 + shatterProgress * (0.65 + seed.speedNorm * 0.7));
          const cx = Math.cos(seed.angle) * travel;
          const cy = Math.sin(seed.angle) * travel;
          const tangent = seed.angle + Math.PI / 2;
          const shardLen = shock.radius * (0.03 + seed.sizeNorm * 0.055) * (1 - shatterProgress * 0.28);
          const shardWidth = Math.max(1.2, shardLen * 0.18);

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(tangent + shatterProgress * (0.2 + seed.speedNorm * 0.35));
          ctx.beginPath();
          ctx.moveTo(-shardLen * 0.5, 0);
          ctx.lineTo(shardLen * 0.5, 0);
          ctx.strokeStyle = `rgba(239, 251, 255, ${shardAlpha * 0.75})`;
          ctx.lineWidth = Math.max(1, shardWidth * 0.86);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(-shardLen * 0.2, -shardLen * 0.26);
          ctx.lineTo(shardLen * 0.22, shardLen * 0.26);
          ctx.strokeStyle = `rgba(182, 222, 250, ${shardAlpha * 0.36})`;
          ctx.lineWidth = Math.max(0.7, shardWidth * 0.34);
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
    }
  }

  private buildShardSeeds(): SigilNovaVisual["shardSeeds"] {
    const seeds: SigilNovaVisual["shardSeeds"] = [];
    const count = 26;
    for (let i = 0; i < count; i += 1) {
      seeds.push({
        angle: (Math.PI * 2 * i) / count + Math.random() * 0.16,
        distNorm: 0.2 + Math.random() * 0.8,
        speedNorm: Math.random(),
        sizeNorm: Math.random(),
      });
    }
    return seeds;
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
    sourceWeaponId: data.id,
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
