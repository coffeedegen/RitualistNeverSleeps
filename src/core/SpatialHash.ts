import { SPATIAL_HASH_CELL_PX } from "../utils/constants";

type Bucket<E> = E[];

/** Broad-phase accelerator keyed by coarse grid buckets. */
export class SpatialHash<E extends { x: number; y: number }> {
  /** Square cell edge length in **world px** (locked to authoring spec). */
  static readonly CELL_SIZE_PX = SPATIAL_HASH_CELL_PX;

  private readonly buckets = new Map<string, Bucket<E>>();

  /**
   * Empties every bucket without reallocating backing arrays — call once per frame.
   */
  clear(): void {
    for (const bucket of this.buckets.values()) {
      bucket.length = 0;
    }
  }

  /**
   * Inserts `entity` by its centroid into exactly one overlapping cell bucket.
   * @param entity World-positioned collaborator (typically pooled {@link Enemy}).
   */
  insert(entity: E): void {
    const gx = Math.floor(entity.x / SpatialHash.CELL_SIZE_PX);
    const gy = Math.floor(entity.y / SpatialHash.CELL_SIZE_PX);
    const key = SpatialHash.bucketKey(gx, gy);

    let bucket = this.buckets.get(key);
    if (bucket === undefined) {
      bucket = [];
      this.buckets.set(key, bucket);
    }
    bucket.push(entity);
  }

  /**
   * Collects any entity residing in buckets touched by axis-aligned `[minX,minY,maxX,maxY]`.
   * @param out Array reused by caller across frames (`length` truncated before refill).
   * @param scratchVisited Deduplicates entities touching multiple queried buckets.
   */
  queryAabbOverlappingBuckets(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    out: E[],
    scratchVisited: Set<E>,
  ): void {
    out.length = 0;
    scratchVisited.clear();

    const minGx = Math.floor(minX / SpatialHash.CELL_SIZE_PX);
    const maxGx = Math.floor(maxX / SpatialHash.CELL_SIZE_PX);
    const minGy = Math.floor(minY / SpatialHash.CELL_SIZE_PX);
    const maxGy = Math.floor(maxY / SpatialHash.CELL_SIZE_PX);

    for (let gx = minGx; gx <= maxGx; gx += 1) {
      for (let gy = minGy; gy <= maxGy; gy += 1) {
        const bucket = this.buckets.get(SpatialHash.bucketKey(gx, gy));
        if (bucket === undefined) {
          continue;
        }

        const len = bucket.length;
        for (let i = 0; i < len; i += 1) {
          const entity = bucket[i];
          if (entity === undefined) {
            continue;
          }
          if (scratchVisited.has(entity)) {
            continue;
          }
          scratchVisited.add(entity);
          out.push(entity);
        }
      }
    }
  }

  /** Utility for stable string keys resilient to sparse bucket maps. */
  private static bucketKey(gx: number, gy: number): string {
    return `${gx}:${gy}`;
  }
}
