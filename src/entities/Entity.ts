/**
 * Lowest-level live object contract shared by anything that occupies world space.
 */
export class Entity {
  /** World-space X center (px). */
  x = 0;

  /** World-space Y center (px). */
  y = 0;

  /** Current vitality — zero means dead for damageable entities. */
  hp = 0;

  /** Authoritative hp ceiling for clamping heals / UI (Phase 3+). */
  maxHp = 0;

  /** When false, pooled entities are eligible for reuse and skipped by systems. */
  active = false;
}
