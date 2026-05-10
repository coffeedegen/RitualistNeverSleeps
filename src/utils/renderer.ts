import { CANVAS_DEFAULT_HEIGHT_PX, CANVAS_DEFAULT_WIDTH_PX } from "./constants";

type PixelArtContext = CanvasRenderingContext2D & {
  mozImageSmoothingEnabled?: boolean;
  msImageSmoothingEnabled?: boolean;
  webkitImageSmoothingEnabled?: boolean;
};

export function applyPixelArtRendering(
  ctx: CanvasRenderingContext2D,
  canvas?: HTMLCanvasElement,
): void {
  const pixelCtx = ctx as PixelArtContext;
  pixelCtx.imageSmoothingEnabled = false;
  pixelCtx.imageSmoothingQuality = "low";
  pixelCtx.mozImageSmoothingEnabled = false;
  pixelCtx.msImageSmoothingEnabled = false;
  pixelCtx.webkitImageSmoothingEnabled = false;

  if (canvas !== undefined) {
    canvas.style.imageRendering = "pixelated";
  }
}

/**
 * Resizes the canvas backing store to match display size × device pixel ratio.
 * Applies `ctx.scale(dpr, dpr)` so drawing uses CSS pixel coordinates.
 * @param canvas Target canvas element.
 */
export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): void {
  const dpr = Math.max(1, window.devicePixelRatio ?? 1);
  const cssW =
    canvas.clientWidth > 0 ? canvas.clientWidth : CANVAS_DEFAULT_WIDTH_PX;
  const cssH =
    canvas.clientHeight > 0 ? canvas.clientHeight : CANVAS_DEFAULT_HEIGHT_PX;

  const w = Math.max(1, Math.floor(cssW * dpr));
  const h = Math.max(1, Math.floor(cssH * dpr));

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    applyPixelArtRendering(ctx, canvas);
  }
}

/** Clears the full backing store regardless of current transform. */
export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

/**
 * Draws a checkerboard for all tiles intersecting world bounds using the active transform (camera).
 * @param tileSizePx Size of each tile in world units.
 * @param colorA Even tile color (CSS color string).
 * @param colorB Odd tile color (CSS color string).
 */
export function drawInfiniteCheckerboard(
  ctx: CanvasRenderingContext2D,
  tileSizePx: number,
  colorA: string,
  colorB: string,
  worldBounds: { minX: number; minY: number; maxX: number; maxY: number },
): void {
  const startCol = Math.floor(worldBounds.minX / tileSizePx);
  const endCol = Math.floor(worldBounds.maxX / tileSizePx);
  const startRow = Math.floor(worldBounds.minY / tileSizePx);
  const endRow = Math.floor(worldBounds.maxY / tileSizePx);

  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      const isEven = ((row & 1) ^ (col & 1)) === 0;
      ctx.fillStyle = isEven ? colorA : colorB;
      ctx.fillRect(
        col * tileSizePx,
        row * tileSizePx,
        tileSizePx,
        tileSizePx,
      );
    }
  }
}
