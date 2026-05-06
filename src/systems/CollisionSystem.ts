import type { ObjectPool } from "../core/ObjectPool";
import type { SpatialHash } from "../core/SpatialHash";
import type { Enemy } from "../entities/Enemy";
import type { Projectile } from "../entities/Projectile";
import { ENEMY_SPATIAL_QUERY_INFLATE_PX } from "../utils/constants";
import { squaredDistance } from "../utils/math";

/** Mutable scratch container reused by the projectile pass each frame. */
export interface ProjectileCollisionPass {
  projectilePool: ObjectPool<Projectile>;
  enemySpatial: SpatialHash<Enemy>;
  scratchEnemies: Enemy[];
  scratchVisited: Set<Enemy>;
  onProjectileStrike: (enemy: Enemy, projectile: Projectile) => void;
}

const PIERCE_NUDGE_PX = 6;

/** Advances projectile motion until TTL expires and resolves pierce chains in one cadence slice. */
export function integrateAndResolveProjectiles(
  pass: ProjectileCollisionPass,
  dtMs: number,
): void {
  pass.projectilePool.forEachActive((projectile) => {
    const alive = projectile.advance(dtMs);
    if (!alive) {
      recycleProjectile(pass.projectilePool, projectile);
      return;
    }

    projectile.lastVictimPoolSlot = -1;

    while (true) {
      const inflate =
        ENEMY_SPATIAL_QUERY_INFLATE_PX + projectile.collisionRadiusPx;
      pass.enemySpatial.queryAabbOverlappingBuckets(
        projectile.x - inflate,
        projectile.y - inflate,
        projectile.x + inflate,
        projectile.y + inflate,
        pass.scratchEnemies,
        pass.scratchVisited,
      );

      let contact: Enemy | undefined;
      let bestDist = Number.POSITIVE_INFINITY;

      for (const enemy of pass.scratchEnemies) {
        if (!enemy.active) {
          continue;
        }
        if (enemy.poolIndex === projectile.lastVictimPoolSlot) {
          continue;
        }

        const reach = enemy.radiusPx + projectile.collisionRadiusPx;
        const distSq = squaredDistance(
          projectile.x,
          projectile.y,
          enemy.x,
          enemy.y,
        );

        if (distSq <= reach * reach && distSq < bestDist) {
          bestDist = distSq;
          contact = enemy;
        }
      }

      if (contact === undefined) {
        break;
      }

      pass.onProjectileStrike(contact, projectile);
      projectile.lastVictimPoolSlot = contact.poolIndex;

      projectile.strikeQuotaRemaining -= 1;

      const travelLen = Math.hypot(
        projectile.vxWorldPerSec,
        projectile.vyWorldPerSec,
      );
      const safeLen = travelLen <= 1e-4 ? 1 : travelLen;

      projectile.x += (projectile.vxWorldPerSec / safeLen) * PIERCE_NUDGE_PX;
      projectile.y += (projectile.vyWorldPerSec / safeLen) * PIERCE_NUDGE_PX;
      projectile.lastVictimPoolSlot = -1;

      if (projectile.strikeQuotaRemaining <= 0) {
        recycleProjectile(pass.projectilePool, projectile);
        return;
      }
    }
  });
}

/** Returns a pooled projectile to the freelist after clearing motion fields. */
export function recycleProjectile(
  pool: ObjectPool<Projectile>,
  projectile: Projectile,
): void {
  projectile.resetForPool();
  pool.release(projectile);
}
