import { MAX_DELTA_TIME_MS } from "../utils/constants";

export type UpdateFn = (deltaTimeMs: number) => void;
export type RenderFn = (ctx: CanvasRenderingContext2D) => void;

/**
 * Fixed-step-ish main loop using `requestAnimationFrame` with capped delta time.
 */
export class GameLoop {
  private animationFrameId: number | undefined;

  private lastTimestampMs = 0;

  private readonly update: UpdateFn;

  private readonly render: RenderFn;

  /**
   * @param canvas Canvas used for sizing context acquisition (drawing uses `render`).
   * @param update World/logic tick; receives capped delta milliseconds.
   * @param render Presentation pass; receives the 2D context.
   */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    update: UpdateFn,
    render: RenderFn,
  ) {
    this.update = update;
    this.render = render;
  }

  /** Starts the RAF loop if not already running. */
  start(): void {
    if (this.animationFrameId !== undefined) {
      return;
    }

    this.lastTimestampMs = performance.now();

    const frame = (now: DOMHighResTimeStamp): void => {
      const rawDt = now - this.lastTimestampMs;
      this.lastTimestampMs = now;

      const dtMs = Math.min(rawDt, MAX_DELTA_TIME_MS);
      if (dtMs > 0) {
        this.update(dtMs);
      }

      const ctx = this.canvas.getContext("2d");
      if (ctx !== null) {
        this.render(ctx);
      }

      this.animationFrameId = requestAnimationFrame(frame);
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  /** Cancels the next scheduled frame if any. */
  stop(): void {
    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
  }
}
