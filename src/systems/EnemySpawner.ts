import type { Camera } from "../core/Camera";
import type { ObjectPool } from "../core/ObjectPool";
import type { Enemy } from "../entities/Enemy";
import type { DirectedSpawnDecision } from "./WaveDirector";
import {
  ENEMY_SPAWN_INTERVAL_MS,
  ENEMY_SPAWN_OUTSIDE_PADDING_PX,
} from "../utils/constants";
import type { WorldRect } from "../world/generatedTilemap";

export interface EnemySpawnDeps {
  camera: Camera;
  elapsedMs: number;
  frozenUntilMs: number;
  spawnLanes: WorldRect[];
  /** Survivor-linked curse scaler (`1 + passive curse pct`). */
  cursePressureMultiplier: number;
  /** Hook into {@link WaveDirector} / bespoke wave timelines. */
  rollSpawnDecision: () => DirectedSpawnDecision;
}

/** Random-edge spawner emitting pooled {@link Enemy} instances beyond the viewport. */
export class EnemySpawner {
  private spawnAccumulatorMs = 0;

  private readonly rng: Pick<Math, "random">;

  constructor(
    private readonly pool: ObjectPool<Enemy>,
    rng: Pick<Math, "random"> = Math,
  ) {
    this.rng = rng;
  }

  /** Drives deterministic spawn cadence respecting wave budgets. */
  update(dtMs: number, deps: EnemySpawnDeps): void {
    this.spawnAccumulatorMs += dtMs;
    while (this.spawnAccumulatorMs >= ENEMY_SPAWN_INTERVAL_MS) {
      this.spawnAccumulatorMs -= ENEMY_SPAWN_INTERVAL_MS;
      this.spawnSingle(deps);
    }
  }

  /** Clears pacing timers once runs reset mid-match. */
  resetCadence(): void {
    this.spawnAccumulatorMs = 0;
  }

  private spawnSingle(deps: EnemySpawnDeps): void {
    const directive = deps.rollSpawnDecision();

    const enemy = this.pool.acquire();
    if (enemy === undefined) {
      return;
    }

    const { x, y } = pickOutsideViewportSpawn(
      deps.camera,
      deps.spawnLanes,
      ENEMY_SPAWN_OUTSIDE_PADDING_PX,
      this.rng,
    );

    const frozenRemainMs = Math.max(0, deps.frozenUntilMs - deps.elapsedMs);
    enemy.initializeSpawn(directive.enemyId, deps.elapsedMs / 60_000, x, y, {
      elite: directive.elite,
      cursePressureMultiplier: deps.cursePressureMultiplier,
      frozenRemainMs,
    });
  }
}

function pickOutsideViewportSpawn(
  camera: Camera,
  spawnLanes: WorldRect[],
  paddingWorld: number,
  rng: Pick<Math, "random">,
): { x: number; y: number } {
  const halfW = camera.viewportWidthCss * 0.5 + paddingWorld;
  const halfH = camera.viewportHeightCss * 0.5 + paddingWorld;
  const viewMinX = camera.x - halfW;
  const viewMaxX = camera.x + halfW;
  const viewMinY = camera.y - halfH;
  const viewMaxY = camera.y + halfH;

  const lanes = spawnLanes.length > 0
    ? spawnLanes
    : [{ minX: camera.x - halfW, maxX: camera.x + halfW, minY: camera.y - halfH, maxY: camera.y + halfH }];
  const fallbackLane = lanes[0];
  if (fallbackLane === undefined) {
    return { x: camera.x, y: camera.y };
  }

  for (let attempts = 0; attempts < 24; attempts += 1) {
    const lane = lanes[Math.floor(rng.random() * lanes.length)] ?? fallbackLane;
    const x = randomRangeInclusiveEdge(rng, lane.minX, lane.maxX);
    const y = randomRangeInclusiveEdge(rng, lane.minY, lane.maxY);
    const outsideViewport = x < viewMinX || x > viewMaxX || y < viewMinY || y > viewMaxY;
    if (outsideViewport) {
      return { x, y };
    }
  }

  const lane = lanes[Math.floor(rng.random() * lanes.length)] ?? fallbackLane;
  return {
    x: randomRangeInclusiveEdge(rng, lane.minX, lane.maxX),
    y: randomRangeInclusiveEdge(rng, lane.minY, lane.maxY),
  };
}

function randomRangeInclusiveEdge(
  rng: Pick<Math, "random">,
  min: number,
  max: number,
): number {
  if (max <= min) {
    return min;
  }
  return min + rng.random() * (max - min);
}
