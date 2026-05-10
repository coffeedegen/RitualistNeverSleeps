/** View-space margin applied around the logical viewport when culling world content. */
const VIEW_MARGIN_PX = 64;

/**
 * World-space camera centered on the follow target with direct follow (no smoothing).
 */
export class Camera {
  /** World position the camera centers on (typically the player). */
  x = 0;

  y = 0;

  /** Logical viewport width in CSS pixels (matches canvas client width post-resize). */
  viewportWidthCss = 800;

  /** Logical viewport height in CSS pixels (matches canvas client height post-resize). */
  viewportHeightCss = 450;

  /** World zoom multiplier (`1` = default scale, `2` = 200% zoom-in). */
  zoom = 1;

  /**
   * Recenters the logical viewport dimensions after a canvas resize.
   * @param widthCss Logical width available for drawing (CSS px).
   * @param heightCss Logical height available for drawing (CSS px).
   */
  setViewportCss(widthCss: number, heightCss: number): void {
    this.viewportWidthCss = widthCss;
    this.viewportHeightCss = heightCss;
  }

  /**
   * Applies the world→screen transform: screen centered on `(this.x, this.y)`.
   * Call `ctx.restore()` after drawing world content.
   * @param ctx Active 2D context (already scaled for DPR by `resizeCanvasToDisplaySize`).
   */
  applyWorldTransform(ctx: CanvasRenderingContext2D): void {
    const snappedX = Math.round(this.x);
    const snappedY = Math.round(this.y);
    ctx.translate(
      Math.floor(this.viewportWidthCss / 2),
      Math.floor(this.viewportHeightCss / 2),
    );
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-snappedX, -snappedY);
  }

  /**
   * Axis-aligned bounds in **world units** describing the visible rectangle plus margin,
   * used for draw culling in later phases.
   */
  get viewBoundsWorld(): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    const safeZoom = Math.max(0.2, this.zoom);
    const hw = this.viewportWidthCss / (2 * safeZoom) + VIEW_MARGIN_PX;
    const hh = this.viewportHeightCss / (2 * safeZoom) + VIEW_MARGIN_PX;
    return {
      minX: this.x - hw,
      maxX: this.x + hw,
      minY: this.y - hh,
      maxY: this.y + hh,
    };
  }

  /** Sets gameplay zoom (clamped to avoid accidental invalid transforms). */
  setZoom(zoom: number): void {
    this.zoom = Math.min(4, Math.max(0.2, zoom));
  }

  /** Snaps camera to a world-space point (direct follow). */
  follow(worldX: number, worldY: number): void {
    this.x = worldX;
    this.y = worldY;
  }
}
