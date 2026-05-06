/**
 * Tracks keyboard input for WASD and arrow-key movement vectors.
 */
export class InputManager {
  private readonly keysDown = new Set<string>();

  /**
   * Installs listeners on `window`. Call `dispose()` to remove them.
   */
  constructor() {
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  /**
   * Releases global keyboard listeners.
   */
  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.keysDown.clear();
  }

  /**
   * Returns a normalized movement vector in {-1,0,1} per axis from current keys.
   */
  getMovementAxes(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    if (
      this.keysDown.has("KeyA") ||
      this.keysDown.has("ArrowLeft")
    ) {
      x -= 1;
    }
    if (
      this.keysDown.has("KeyD") ||
      this.keysDown.has("ArrowRight")
    ) {
      x += 1;
    }
    if (
      this.keysDown.has("KeyW") ||
      this.keysDown.has("ArrowUp")
    ) {
      y -= 1;
    }
    if (
      this.keysDown.has("KeyS") ||
      this.keysDown.has("ArrowDown")
    ) {
      y += 1;
    }

    if (x === 0 && y === 0) {
      return { x: 0, y: 0 };
    }

    const length = Math.hypot(x, y);
    return { x: x / length, y: y / length };
  }

  private onKeyDown(ev: KeyboardEvent): void {
    if (ev.code.startsWith("Arrow")) {
      ev.preventDefault();
    }
    this.keysDown.add(ev.code);
  }

  private onKeyUp(ev: KeyboardEvent): void {
    this.keysDown.delete(ev.code);
  }
}
