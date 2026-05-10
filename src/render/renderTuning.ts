export interface AnchorOffset {
  x: number;
  y: number;
}

export interface EnemyRenderTuning {
  frameMsMove: number;
  frameMsIdle: number;
  frozenFrameMs: number;
  drawScale: number;
  anchor: AnchorOffset;
}

export interface ProjectileSpriteRule {
  spriteId: string;
  drawScale: number;
  anchor: AnchorOffset;
  rotateToVelocity?: boolean;
  spinRadPerSec?: number;
}

export const playerRenderConfig = {
  frameMsMove: 105,
  frameMsIdle: 260,
  frameMsHurt: 80,
  drawScale: 4.2,
  anchor: { x: 0, y: -1 } satisfies AnchorOffset,
};

export const enemyRenderConfig: Record<string, EnemyRenderTuning> = {
  bat: { frameMsMove: 124, frameMsIdle: 148, frozenFrameMs: 290, drawScale: 3.7, anchor: { x: 0, y: -3 } },
  skeleton: { frameMsMove: 128, frameMsIdle: 214, frozenFrameMs: 328, drawScale: 3.95, anchor: { x: 0, y: -2 } },
  mudman: { frameMsMove: 156, frameMsIdle: 244, frozenFrameMs: 350, drawScale: 3.55, anchor: { x: 0, y: 3 } },
  mummy: { frameMsMove: 142, frameMsIdle: 232, frozenFrameMs: 336, drawScale: 3.6, anchor: { x: 0, y: 1 } },
  mantis: { frameMsMove: 116, frameMsIdle: 194, frozenFrameMs: 306, drawScale: 3.7, anchor: { x: 0, y: -1 } },
};

export const pickupAnchorConfig: Record<string, AnchorOffset> = {
  field_ration: { x: 0, y: 0 },
  gem_siphon: { x: 0, y: -0.5 },
  halo_charm: { x: 0, y: 0 },
  chrono_seal: { x: 0, y: 0 },
};

export const projectileRenderConfig: Record<string, ProjectileSpriteRule> = {
  magic_wand: { spriteId: "arcane_bolt", drawScale: 3.25, anchor: { x: 0, y: 0 } },
  holy_wand: { spriteId: "sanctified_bolt", drawScale: 3.35, anchor: { x: 0, y: 0 } },
  knife: { spriteId: "shard_blade", drawScale: 3.15, anchor: { x: 0, y: 0 }, rotateToVelocity: true },
  thousand_edge: { spriteId: "thousand_shards", drawScale: 3.2, anchor: { x: 0, y: 0 }, rotateToVelocity: true },
  axe: {
    spriteId: "cleaver",
    drawScale: 3.7,
    anchor: { x: 0, y: 0 },
    rotateToVelocity: true,
    spinRadPerSec: 8.5,
  },
  death_spiral: {
    spriteId: "reaper_spiral",
    drawScale: 3.9,
    anchor: { x: 0, y: 0 },
    rotateToVelocity: true,
    spinRadPerSec: 11.5,
  },
  cross: { spriteId: "sanctum_cross", drawScale: 3.45, anchor: { x: 0, y: 0 }, rotateToVelocity: true },
  heaven_sword: { spriteId: "celestial_blade", drawScale: 3.55, anchor: { x: 0, y: 0 }, rotateToVelocity: true },
  fire_wand: { spriteId: "inferno_burst", drawScale: 3.45, anchor: { x: 0, y: 0 } },
  hellfire: { spriteId: "inferno_burst", drawScale: 3.85, anchor: { x: 0, y: 0 } },
  runetracer: { spriteId: "rune_shard", drawScale: 3.3, anchor: { x: 0, y: 0 }, rotateToVelocity: true },
  no_future: { spriteId: "final_sigil", drawScale: 3.45, anchor: { x: 0, y: 0 }, rotateToVelocity: true },
};
