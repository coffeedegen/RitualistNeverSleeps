import { Entity } from "../entities/Entity";

/**
 * Lightweight entity bookkeeping used by pooled mutators.
 */
export type PoolTrackedEntity = Entity & { poolIndex: number };

/**
 * Fixed-capacity object pool owning pre-instantiated `Entity` subclasses.
 *
 * Acquire pops a free slot; release pushes indices back onto a stack — no mid-loop `new`.
 */
export class ObjectPool<T extends PoolTrackedEntity> {
  /** Concrete instances authored at construction time. */
  private readonly entities: readonly T[];

  /** Freelist storing indices into {@link entities}. */
  private readonly freelist: number[] = [];

  /**
   * @param capacity Absolute hard cap mirrored by authoring expectations.
   * @param factory Produces uninitialized instances (`active` defaults to false).
   */
  constructor(capacity: number, factory: (slotIndex: number) => T) {
    const buffer: T[] = [];
    for (let slot = 0; slot < capacity; slot += 1) {
      const entity = factory(slot);
      entity.active = false;
      entity.poolIndex = slot;
      buffer.push(entity);
      this.freelist.push(slot);
    }
    this.entities = buffer;
  }

  /**
   * Grants the next dormant entity slot or `undefined` when the pool saturates.
   */
  acquire(): T | undefined {
    const idx = this.freelist.pop();
    if (idx === undefined) {
      return undefined;
    }
    const entity = this.entities[idx];
    if (entity === undefined) {
      return undefined;
    }
    entity.active = true;
    return entity;
  }

  /**
   * Returns a live pooled entity to the freelist — idempotent when already inactive.
   * @param entity Instance previously handed out via {@link acquire}.
   */
  release(entity: T): void {
    if (!entity.active) {
      return;
    }
    entity.active = false;
    this.freelist.push(entity.poolIndex);
  }

  /**
   * Executes `fn` for every currently active pooled entity — stable iteration order.
   * @param fn Visitor invoked once per alive entity each frame/tick.
   */
  forEachActive(fn: (entity: T) => void): void {
    for (const entity of this.entities) {
      if (entity.active) {
        fn(entity);
      }
    }
  }
}
