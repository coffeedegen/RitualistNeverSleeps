import type { Camera } from "../core/Camera";
import type { ObjectPool } from "../core/ObjectPool";
import type { Enemy } from "../entities/Enemy";
import type { DirectedSpawnDecision } from "./WaveDirector";
import {
  ENEMY_SPAWN_INTERVAL_MS,
  ENEMY_SPAWN_OUTSIDE_PADDING_PX,
} from "../utils/constants";

export interface EnemySpawnDeps {
  camera: Camera;
  elapsedMs: number;
  frozenUntilMs: number;
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
  paddingWorld: number,
  rng: Pick<Math, "random">,
): { x: number; y: number } {
  const halfW = camera.viewportWidthCss * 0.5 + paddingWorld;
  const halfH = camera.viewportHeightCss * 0.5 + paddingWorld;

  const minX = camera.x - halfW;
  const maxX = camera.x + halfW;
  const minY = camera.y - halfH;
  const maxY = camera.y + halfH;

  const edge = Math.floor(rng.random() * 4);

  switch (edge) {
    case 0:
      return { x: randomRangeInclusiveEdge(rng, minX, maxX), y: minY };
    case 1:
      return { x: randomRangeInclusiveEdge(rng, minX, maxX), y: maxY };
    case 2:
      return { x: minX, y: randomRangeInclusiveEdge(rng, minY, maxY) };
    default:
      return { x: maxX, y: randomRangeInclusiveEdge(rng, minY, maxY) };
  }
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
