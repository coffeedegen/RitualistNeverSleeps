import { formatRunDuration } from "../utils/time";

interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GameOverUICallbacks {
  onStartNewGame: () => void;
  onBackToMainMenu: () => void;
  onQuitConfirmed: () => void;
}

type OverlayMode = "hidden" | "gameOver" | "confirmQuit";

/**
 * Canvas overlay shown after the survivor dies.
 *
 * The overlay owns the game-over button state and keeps the quit confirmation
 * entirely inside the canvas layer so the game can be restarted or returned to
 * the homepage without reusing stale runtime state.
 */
export class GameOverUI {
  private overlayMode: OverlayMode = "hidden";

  private actionLocked = false;

  private finalScore = 0;

  private finalKills = 0;

  private finalSurvivedMs = 0;

  private readonly clickListener = (event: MouseEvent): void => {
    if (this.overlayMode === "hidden" || this.actionLocked) {
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    if (this.overlayMode === "gameOver") {
      const buttons = this.getMainButtons(width, height);
      if (this.hitTest(mouseX, mouseY, buttons.start)) {
        event.preventDefault();
        this.actionLocked = true;
        this.callbacks.onStartNewGame();
        return;
      }

      if (this.hitTest(mouseX, mouseY, buttons.menu)) {
        event.preventDefault();
        this.actionLocked = true;
        this.callbacks.onBackToMainMenu();
        return;
      }

      if (this.hitTest(mouseX, mouseY, buttons.quit)) {
        event.preventDefault();
        this.overlayMode = "confirmQuit";
      }
      return;
    }

    const buttons = this.getQuitButtons(width, height);
    if (this.hitTest(mouseX, mouseY, buttons.yes)) {
      event.preventDefault();
      this.actionLocked = true;
      this.callbacks.onQuitConfirmed();
      return;
    }

    if (this.hitTest(mouseX, mouseY, buttons.no)) {
      event.preventDefault();
      this.overlayMode = "gameOver";
    }
  };

  constructor(private readonly callbacks: GameOverUICallbacks) {
    window.addEventListener("mousedown", this.clickListener, true);
  }

  dispose(): void {
    window.removeEventListener("mousedown", this.clickListener, true);
    this.overlayMode = "hidden";
    this.actionLocked = false;
  }

  present(finalScore: number, kills: number, survivedMs: number): void {
    this.finalScore = finalScore;
    this.finalKills = kills;
    this.finalSurvivedMs = survivedMs;
    this.overlayMode = "gameOver";
    this.actionLocked = false;
  }

  isBannerOpen(): boolean {
    return this.overlayMode !== "hidden";
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.overlayMode === "hidden") {
      return;
    }

    ctx.save();
    const backdrop = ctx.createRadialGradient(
      width * 0.5,
      height * 0.22,
      10,
      width * 0.5,
      height * 0.45,
      Math.max(width, height) * 0.95,
    );
    backdrop.addColorStop(0, "rgba(42, 18, 24, 0.92)");
    backdrop.addColorStop(0.45, "rgba(8, 11, 22, 0.94)");
    backdrop.addColorStop(1, "rgba(2, 3, 7, 0.98)");
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    this.drawBackdrop(ctx, width, height);

    this.drawTitle(ctx, width, height);

    if (this.overlayMode === "confirmQuit") {
      this.drawQuitConfirmation(ctx, width, height);
    } else {
      this.drawGameOverSummary(ctx, width, height);
      this.drawMainButtons(ctx, width, height);
    }

    ctx.restore();
  }

  private drawTitle(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const compact = this.isCompactLayout(width, height);
    ctx.fillStyle = "#ff6b7a";
    ctx.font = `900 ${compact ? 48 : 72}px 'Cinzel', 'Times New Roman', serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("GAME OVER", width * 0.5, height * (compact ? 0.17 : 0.24));

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `600 ${compact ? 11 : 13}px 'JetBrains Mono', monospace`;
    ctx.fillText("THE RITUAL HAS ENDED", width * 0.5, height * (compact ? 0.23 : 0.29));
  }

  private drawGameOverSummary(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const compact = this.isCompactLayout(width, height);
    const cardW = Math.min(width * 0.82, compact ? 360 : 420);
    const cardH = compact ? 112 : 128;
    const cardX = width * 0.5 - cardW / 2;
    const cardY = height * (compact ? 0.30 : 0.34);

    const fillGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    fillGradient.addColorStop(0, "rgba(16, 22, 42, 0.98)");
    fillGradient.addColorStop(1, "rgba(6, 8, 14, 0.96)");
    ctx.fillStyle = fillGradient;
    this.roundPane(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(127, 224, 168, 0.24)";
    ctx.lineWidth = 1.5;
    this.roundPane(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.stroke();

    ctx.fillStyle = "rgba(127, 224, 168, 0.14)";
    this.roundPane(ctx, cardX + 10, cardY + 10, cardW - 20, cardH - 20, 10);
    ctx.fill();

    ctx.fillStyle = "#7fe0a8";
    ctx.font = `900 ${compact ? 30 : 40}px 'Space Grotesk', 'Segoe UI', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.finalScore.toLocaleString(), width * 0.5, cardY + 42);

    ctx.fillStyle = "rgba(255,255,255,0.48)";
    ctx.font = "700 10px 'JetBrains Mono', monospace";
    ctx.fillText("FINAL SCORE", width * 0.5, cardY + 68);

    const statsY = cardY + 92;
    this.drawStatChip(ctx, width * 0.5 - 104, statsY, "KILLS", `${this.finalKills}`);
    this.drawStatChip(ctx, width * 0.5 + 12, statsY, "TIME", formatRunDuration(this.finalSurvivedMs));
  }

  private drawMainButtons(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const compact = this.isCompactLayout(width, height);
    const layout = this.getMainButtons(width, height);
    const accentFont = compact ? 15 : 18;

    this.drawButton(ctx, layout.start, "Start a New Game", "#5f92ff", accentFont, true);
    this.drawButton(ctx, layout.menu, "Back to Main Menu", "#41d37c", accentFont);
    this.drawButton(ctx, layout.quit, "Quit", "#ff6b7a", accentFont);
  }

  private drawQuitConfirmation(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const compact = this.isCompactLayout(width, height);
    const questionY = height * (compact ? 0.40 : 0.42);

    const panelW = Math.min(width * 0.86, 620);
    const panelH = compact ? 96 : 104;
    const panelX = width * 0.5 - panelW / 2;
    const panelY = questionY - panelH / 2;

    const fillGradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    fillGradient.addColorStop(0, "rgba(16, 22, 42, 0.98)");
    fillGradient.addColorStop(1, "rgba(6, 8, 14, 0.96)");
    ctx.fillStyle = fillGradient;
    this.roundPane(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,107,122,0.55)";
    ctx.lineWidth = 2;
    this.roundPane(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${compact ? 18 : 22}px 'Space Grotesk', 'Segoe UI', sans-serif`;
    wrapAndFillText(
      ctx,
      "Are you sure you will quit the game?",
      width * 0.5,
      panelY + panelH / 2,
      panelW - 36,
      compact ? 24 : 28,
    );

    const buttons = this.getQuitButtons(width, height);
    const accentFont = compact ? 15 : 17;
    this.drawButton(ctx, buttons.yes, "Yes", "#ff6b7a", accentFont);
    this.drawButton(ctx, buttons.no, "No", "#5f92ff", accentFont);
  }

  private drawButton(
    ctx: CanvasRenderingContext2D,
    rect: ButtonRect,
    text: string,
    accent: string,
    fontSize: number,
    highlight = false,
  ): void {
    const fillGradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    fillGradient.addColorStop(0, "rgba(22, 28, 46, 0.98)");
    fillGradient.addColorStop(1, "rgba(7, 9, 15, 0.98)");
    ctx.fillStyle = fillGradient;
    this.roundPane(ctx, rect.x, rect.y, rect.w, rect.h, 8);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = highlight ? 4 : 3;
    this.roundPane(ctx, rect.x, rect.y, rect.w, rect.h, 8);
    ctx.stroke();

    ctx.fillStyle = this.withAlpha(accent, 0.14);
    this.roundPane(ctx, rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8, 6);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${fontSize}px 'Space Grotesk', ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  private getMainButtons(width: number, height: number): {
    start: ButtonRect;
    menu: ButtonRect;
    quit: ButtonRect;
  } {
    if (this.isCompactLayout(width, height)) {
      const buttonW = Math.min(340, Math.max(240, width * 0.84));
      const buttonH = height < 420 ? 42 : 46;
      const gap = height < 420 ? 8 : 10;
      const totalH = buttonH * 3 + gap * 2;
      const startY = Math.min(
        Math.max(height * 0.57, 24),
        height - totalH - 20,
      );
      const x = width * 0.5 - buttonW / 2;

      return {
        start: { x, y: startY, w: buttonW, h: buttonH },
        menu: { x, y: startY + buttonH + gap, w: buttonW, h: buttonH },
        quit: { x, y: startY + (buttonH + gap) * 2, w: buttonW, h: buttonH },
      };
    }

    const buttonW = Math.min(240, Math.max(210, width * 0.22));
    const buttonH = 60;
    const gap = Math.max(20, Math.min(30, width * 0.03));
    const totalW = buttonW * 3 + gap * 2;
    const x = width * 0.5 - totalW / 2;
    const y = Math.min(
      Math.max(height * 0.63, 24),
      height - buttonH - 44,
    );

    return {
      start: { x, y, w: buttonW, h: buttonH },
      menu: { x: x + buttonW + gap, y, w: buttonW, h: buttonH },
      quit: { x: x + (buttonW + gap) * 2, y, w: buttonW, h: buttonH },
    };
  }

  private getQuitButtons(width: number, height: number): {
    yes: ButtonRect;
    no: ButtonRect;
  } {
    if (width < 420) {
      const buttonW = Math.min(280, Math.max(180, width * 0.74));
      const buttonH = 44;
      const gap = 10;
      const totalH = buttonH * 2 + gap;
      const x = width * 0.5 - buttonW / 2;
      const y = Math.min(Math.max(height * 0.58, 24), height - totalH - 24);

      return {
        yes: { x, y, w: buttonW, h: buttonH },
        no: { x, y: y + buttonH + gap, w: buttonW, h: buttonH },
      };
    }

    const buttonW = Math.min(220, Math.max(150, (width - 56) / 2));
    const buttonH = 54;
    const gap = 16;
    const totalW = buttonW * 2 + gap;
    const x = width * 0.5 - totalW / 2;
    const y = Math.min(
      Math.max(height * 0.60, 24),
      height - buttonH - 42,
    );

    return {
      yes: { x, y, w: buttonW, h: buttonH },
      no: { x: x + buttonW + gap, y, w: buttonW, h: buttonH },
    };
  }

  private isCompactLayout(width: number, height: number): boolean {
    return width < 860 || height < 680;
  }

  private drawBackdrop(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(127, 224, 168, 0.08)";
    ctx.lineWidth = 1.5;

    const centerX = width * 0.5;
    const centerY = height * 0.38;
    for (const radius of [height * 0.14, height * 0.22, height * 0.31]) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255, 107, 122, 0.05)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.min(width, height) * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawStatChip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    label: string,
    value: string,
  ): void {
    const chipW = 92;
    const chipH = 36;
    const chipX = x - chipW / 2;
    const chipY = y - chipH / 2;

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    this.roundPane(ctx, chipX, chipY, chipW, chipH, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(127,224,168,0.22)";
    ctx.lineWidth = 1;
    this.roundPane(ctx, chipX, chipY, chipW, chipH, 10);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "700 8px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, x, chipY + 5);

    ctx.fillStyle = "#f7f2de";
    ctx.font = "700 13px 'Space Grotesk', sans-serif";
    ctx.fillText(value, x, chipY + 16);
  }

  private withAlpha(hex: string, alpha: number): string {
    const normalized = hex.replace("#", "");
    if (normalized.length !== 6) {
      return hex;
    }

    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private hitTest(x: number, y: number, rect: ButtonRect): boolean {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  private roundPane(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
  ): void {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

function wrapAndFillText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine.length > 0 ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    if (line !== undefined) {
      ctx.fillText(line, centerX, startY + idx * lineHeight);
    }
  }
}
