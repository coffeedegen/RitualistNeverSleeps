/** Immutable HUD snapshot queried each render pass. */
export interface HudPresentationState {
  survivorLevel: number;
  survivorHp: number;
  survivorMaxHp: number;
  xpProgress: number;
  xpBudget: number;
  elapsedMs: number;
  score?: number;
}

/** Canvas-space HUD overlays (never inside the gameplay camera stack). */
export class HudRenderer {
  /**
   * Paints authoritative run stats after world rendering completes.
   * @param viewportWidth Logical canvas width (`clientWidth`).
   * @param viewportHeight Logical canvas height (`clientHeight`).
   */
  draw(
    ctx: CanvasRenderingContext2D,
    viewportWidth: number,
    _viewportHeight: number,
    snapshot: HudPresentationState,
  ): void {
    const compact = viewportWidth < 900;
    const outerX = 14;
    const outerY = 12;
    const outerH = compact ? 92 : 96;
    const leftPanelW = compact ? 170 : 194;
    const rightPanelW = compact ? 170 : 202;
    const panelH = compact ? 68 : 72;
    const panelY = outerY + 10;
    const leftX = outerX + 10;
    const rightX = viewportWidth - outerX - rightPanelW - 10;
    const centerX = leftX + leftPanelW + 18;
    const centerW = Math.max(160, rightX - centerX - 18);

    ctx.save();

    this.drawShell(ctx, outerX, outerY, viewportWidth - outerX * 2, outerH);

    this.drawInfoPanel(
      ctx,
      leftX,
      panelY,
      leftPanelW,
      panelH,
      snapshot.survivorLevel,
      snapshot.elapsedMs,
      snapshot.survivorHp,
      snapshot.survivorMaxHp,
    );

    this.drawXpBar(ctx, centerX, panelY + 14, centerW, 18, snapshot.xpProgress, snapshot.xpBudget);

    this.drawScorePanel(
      ctx,
      rightX,
      panelY,
      rightPanelW,
      panelH,
      snapshot.score,
    );

    ctx.restore();
  }

  /** Renders centered gradient XP bar respecting logical canvas sizing. */
  private drawXpBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    xpValue: number,
    xpBudget: number,
  ): void {
    const ratioRaw = xpBudget > 0 ? xpValue / xpBudget : 0;
    const ratio = Math.max(0, Math.min(1, ratioRaw));

    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, "#58d6ff");
    gradient.addColorStop(0.5, "#7b8cff");
    gradient.addColorStop(1, "#b97cff");

    ctx.fillStyle = "rgba(8,12,25,0.95)";
    this.roundRect(ctx, x - 4, y - 4, width + 8, height + 8, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(6,10,24,1)";
    this.roundRect(ctx, x, y, width, height, 8);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    this.roundRect(ctx, x, y, width * ratio, height, 8);
    ctx.clip();
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width * ratio, height);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, width, height, 8);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 10px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      `XP ${Math.floor(xpValue)} / ${Math.floor(xpBudget)}`,
      x + 8,
      y - 2,
    );
  }

  private drawInfoPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    level: number,
    elapsedMs: number,
    hpValue: number,
    hpMax: number,
  ): void {
    ctx.save();
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, "rgba(28, 34, 52, 0.95)");
    gradient.addColorStop(1, "rgba(12, 15, 26, 0.95)");

    ctx.fillStyle = gradient;
    this.roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(127, 224, 168, 0.36)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();

    ctx.fillStyle = "rgba(127, 224, 168, 0.12)";
    this.roundRect(ctx, x + 8, y + 8, 48, 48, 12);
    ctx.fill();

    ctx.fillStyle = "#f7f2de";
    ctx.font = "800 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${level}`, x + 32, y + 28);

    ctx.fillStyle = "rgba(247, 242, 222, 0.55)";
    ctx.font = "700 9px 'JetBrains Mono', monospace";
    ctx.fillText("LEVEL", x + 32, y + 44);

    ctx.fillStyle = "#f8f6ff";
    ctx.font = "700 14px 'Space Grotesk', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Run Clock", x + 70, y + 14);

    ctx.fillStyle = "rgba(219, 228, 255, 0.86)";
    ctx.font = "600 13px 'JetBrains Mono', monospace";
    ctx.fillText(formatClock(elapsedMs), x + 70, y + 35);

    this.drawHpBar(ctx, x + 68, y + 48, w - 80, 14, hpValue, hpMax);
    ctx.restore();
  }

  private drawHpBar(
    ctx: CanvasRenderingContext2D,
    barX: number,
    barY: number,
    barW: number,
    barH: number,
    hpValue: number,
    hpMax: number,
  ): void {
    const ratioRaw = hpMax > 0 ? hpValue / hpMax : 0;
    const ratio = Math.max(0, Math.min(1, ratioRaw));

    ctx.fillStyle = "rgba(10,12,20,0.96)";
    this.roundRect(ctx, barX - 2, barY - 2, barW + 4, barH + 4, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(5, 8, 14, 1)";
    this.roundRect(ctx, barX, barY, barW, barH, 6);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    this.roundRect(ctx, barX, barY, barW * ratio, barH, 6);
    ctx.clip();
    const gradient = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    gradient.addColorStop(0, "#ff5c7a");
    gradient.addColorStop(1, "#ff9a5c");
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, barX, barY, barW, barH, 6);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "600 9px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("HP", barX, barY - 1);
  }

  private drawScorePanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    score: number | undefined,
  ): void {
    ctx.save();
    const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, "rgba(17, 24, 31, 0.95)");
    gradient.addColorStop(1, "rgba(8, 10, 15, 0.95)");
    ctx.fillStyle = gradient;
    this.roundRect(ctx, x, y, w, h, 12);
    ctx.fill();

    ctx.strokeStyle = "rgba(127, 224, 168, 0.28)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();

    ctx.fillStyle = "rgba(127, 224, 168, 0.12)";
    this.roundRect(ctx, x + w - 58, y + 10, 40, 40, 10);
    ctx.fill();

    ctx.fillStyle = "#f8f6ff";
    ctx.font = "700 14px 'Space Grotesk', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Score", x + 14, y + 12);

    ctx.fillStyle = "#7fe0a8";
    ctx.font = "800 18px 'JetBrains Mono', monospace";
    ctx.fillText(score !== undefined ? score.toLocaleString() : "0", x + 14, y + 34);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 9px 'JetBrains Mono', monospace";
    ctx.fillText("Ritual Progress", x + 14, y + 55);
    ctx.restore();
  }

  private drawShell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    ctx.save();
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, "rgba(9, 12, 23, 0.72)");
    gradient.addColorStop(1, "rgba(4, 7, 14, 0.4)");
    ctx.fillStyle = gradient;
    this.roundRect(ctx, x, y, w, h, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, w, h, 18);
    ctx.stroke();

    ctx.strokeStyle = "rgba(127,224,168,0.16)";
    ctx.lineWidth = 2;
    this.roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 17);
    ctx.stroke();

    ctx.restore();
  }

  private roundRect(
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

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatClock(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${pad2(seconds)}`;
}
