/** Clamps numeric input to `[min,max]`. */
export function clampScalar(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** True when `radius` overlaps ` Axis-aligned rect`. */
export function circleIntersectsAabb(
  circleX: number,
  circleY: number,
  circleRadius: number,
  rectMinX: number,
  rectMinY: number,
  rectMaxX: number,
  rectMaxY: number,
): boolean {
  const closestX = clampScalar(circleX, rectMinX, rectMaxX);
  const closestY = clampScalar(circleY, rectMinY, rectMaxY);
  const dx = circleX - closestX;
  const dy = circleY - closestY;
  return dx * dx + dy * dy <= circleRadius * circleRadius;
}

/** Squared Euclidean distance shortcut for hot collision checks. */
export function squaredDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
