import { getScoreTitle } from "../utils/scoreTitle";

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

interface HudTierPalette {
  accent: string;
  glow: string;
  chipFill: string;
  chipStroke: string;
}

/** Canvas-space HUD overlays (never inside the gameplay camera stack). */
export class HudRenderer {
  private hpKickRemainMs = 0;

  notifyHit(): void {
    this.hpKickRemainMs = 180;
  }
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
    this.hpKickRemainMs = Math.max(0, this.hpKickRemainMs - 16);
    const scoreValue = snapshot.score ?? 0;
    const tier = getScoreTitle(scoreValue);
    const palette = getHudTierPalette(tier.title);
    const compact = viewportWidth < 900;
    const marginX = compact ? 14 : 18;
    const panelY = compact ? 14 : 18;
    const gap = compact ? 10 : 14;
    const panelH = compact ? 84 : 92;
    const totalW = viewportWidth - marginX * 2;

    let leftPanelW = compact ? 198 : 232;
    let rightPanelW = compact ? 214 : 254;
    let centerW = totalW - leftPanelW - rightPanelW - gap * 2;
    if (centerW < 170) {
      const deficit = 170 - centerW;
      leftPanelW = Math.max(164, leftPanelW - deficit * 0.5);
      rightPanelW = Math.max(176, rightPanelW - deficit * 0.5);
      centerW = totalW - leftPanelW - rightPanelW - gap * 2;
    }

    const leftX = marginX;
    const centerX = leftX + leftPanelW + gap;
    const rightX = centerX + centerW + gap;

    ctx.save();

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
      palette,
    );

    this.drawXpPanel(
      ctx,
      centerX,
      panelY,
      centerW,
      panelH,
      snapshot.xpProgress,
      snapshot.xpBudget,
      palette,
    );

    this.drawScorePanel(
      ctx,
      rightX,
      panelY,
      rightPanelW,
      panelH,
      scoreValue,
      tier.title,
      palette,
    );

    ctx.restore();
  }

  private drawPanelFrame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    glow: string,
  ): void {
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, "rgba(19, 26, 40, 0.95)");
    gradient.addColorStop(1, "rgba(9, 12, 22, 0.94)");
    ctx.fillStyle = gradient;
    this.roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1;
    this.roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 13);
    ctx.stroke();
  }

  /** Renders the center XP panel for the 3-strip HUD layout. */
  private drawXpPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    xpValue: number,
    xpBudget: number,
    palette: HudTierPalette,
  ): void {
    this.drawPanelFrame(ctx, x, y, width, height, palette.glow);
    const ratioRaw = xpBudget > 0 ? xpValue / xpBudget : 0;
    const ratio = Math.max(0, Math.min(1, ratioRaw));

    const barX = x + 14;
    const barY = y + Math.floor(height * 0.44);
    const barW = width - 28;
    const barH = compactBarHeight(width);

    const gradient = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    gradient.addColorStop(0, "#58d6ff");
    gradient.addColorStop(0.5, "#7b8cff");
    gradient.addColorStop(1, "#b97cff");

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 10px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("XP TRACK", barX, y + 12);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(219,228,255,0.9)";
    ctx.fillText(`${Math.floor(xpValue)} / ${Math.floor(xpBudget)}`, x + width - 14, y + 12);

    ctx.fillStyle = "rgba(8,12,25,0.95)";
    this.roundRect(ctx, barX - 3, barY - 3, barW + 6, barH + 6, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(6,10,24,1)";
    this.roundRect(ctx, barX, barY, barW, barH, 8);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    this.roundRect(ctx, barX, barY, barW * ratio, barH, 8);
    ctx.clip();
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    for (let tick = 1; tick < 6; tick += 1) {
      const tickX = barX + (barW * tick) / 6;
      ctx.beginPath();
      ctx.moveTo(tickX, barY + 3);
      ctx.lineTo(tickX, barY + barH - 3);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, barX, barY, barW, barH, 8);
    ctx.stroke();
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
    palette: HudTierPalette,
  ): void {
    ctx.save();
    this.drawPanelFrame(ctx, x, y, w, h, palette.glow);

    ctx.fillStyle = "#f7f2de";
    ctx.font = "800 22px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${level}`, x + 32, y + 27);

    ctx.fillStyle = "rgba(247, 242, 222, 0.55)";
    ctx.font = "700 9px 'JetBrains Mono', monospace";
    ctx.fillText("LEVEL", x + 32, y + 44);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, x + 8, y + 8, 48, 48, 12);
    ctx.stroke();

    ctx.fillStyle = "#f8f6ff";
    ctx.font = "700 13px 'Space Grotesk', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Run Clock", x + 70, y + 14);

    ctx.fillStyle = "rgba(219, 228, 255, 0.86)";
    ctx.font = "600 12px 'JetBrains Mono', monospace";
    ctx.fillText(formatClock(elapsedMs), x + 70, y + 34);

    this.drawHpBar(ctx, x + 68, y + 52, w - 84, 13, hpValue, hpMax);
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
    const kick = Math.min(1, this.hpKickRemainMs / 180);
    const nudge = kick > 0 ? Math.sin(kick * Math.PI) * 5 : 0;

    ctx.fillStyle = "rgba(10,12,20,0.96)";
    this.roundRect(ctx, barX - 2 + nudge, barY - 2, barW + 4, barH + 4, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(5, 8, 14, 1)";
    this.roundRect(ctx, barX + nudge, barY, barW, barH, 6);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    this.roundRect(ctx, barX + nudge, barY, barW * ratio, barH, 6);
    ctx.clip();
    const gradient = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    gradient.addColorStop(0, "#ff5c7a");
    gradient.addColorStop(1, "#ff9a5c");
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, barX + nudge, barY, barW, barH, 6);
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
    scoreValue: number,
    tierTitle: string,
    palette: HudTierPalette,
  ): void {
    ctx.save();
    this.drawPanelFrame(ctx, x, y, w, h, palette.glow);

    ctx.fillStyle = "#f8f6ff";
    ctx.font = "700 13px 'Space Grotesk', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Score", x + 14, y + 10);

    const scoreText = scoreValue.toLocaleString();
    const scoreFont = fitFontPx(
      ctx,
      scoreText,
      w - 28,
      Math.max(16, Math.min(20, Math.floor(w * 0.085))),
      12,
      "800",
      "'JetBrains Mono', monospace",
    );
    ctx.fillStyle = palette.accent;
    ctx.font = `800 ${scoreFont}px 'JetBrains Mono', monospace`;
    ctx.fillText(scoreText, x + 14, y + 28);

    const tierX = x + 12;
    const tierY = y + 44;
    const tierW = w - 24;
    const tierH = h - 50;
    ctx.fillStyle = palette.chipFill;
    this.roundRect(ctx, tierX, tierY, tierW, tierH, 10);
    ctx.fill();
    ctx.strokeStyle = palette.chipStroke;
    ctx.lineWidth = 1;
    this.roundRect(ctx, tierX, tierY, tierW, tierH, 10);
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    ctx.font = "700 8px 'JetBrains Mono', monospace";
    ctx.fillText("TITLE TIER", tierX + 10, tierY + 8);

    const tierLabel = tierTitle.toUpperCase();
    const tierFont = fitFontPx(
      ctx,
      tierLabel,
      tierW - 20,
      Math.max(12, Math.min(16, Math.floor(tierW * 0.085))),
      10,
      "900",
      "'Space Grotesk', sans-serif",
    );
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${tierFont}px 'Space Grotesk', sans-serif`;
    ctx.fillText(tierLabel, tierX + 10, tierY + 20);
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

function compactBarHeight(width: number): number {
  return width < 280 ? 14 : 16;
}

function getHudTierPalette(tierTitle: string): HudTierPalette {
  const normalized = tierTitle.toLowerCase();
  if (normalized.includes("radiant")) {
    return {
      accent: "#d7ba6a",
      glow: "rgba(215,186,106,0.32)",
      chipFill: "rgba(215,186,106,0.08)",
      chipStroke: "rgba(215,186,106,0.24)",
    };
  }
  if (normalized.includes("zealot")) {
    return {
      accent: "#8b8fd6",
      glow: "rgba(139,143,214,0.3)",
      chipFill: "rgba(139,143,214,0.08)",
      chipStroke: "rgba(139,143,214,0.24)",
    };
  }
  if (normalized.includes("ritualist")) {
    return {
      accent: "#90c59a",
      glow: "rgba(144,197,154,0.32)",
      chipFill: "rgba(144,197,154,0.08)",
      chipStroke: "rgba(144,197,154,0.24)",
    };
  }
  if (normalized.includes("ritty")) {
    return {
      accent: "#ad94db",
      glow: "rgba(173,148,219,0.3)",
      chipFill: "rgba(173,148,219,0.08)",
      chipStroke: "rgba(173,148,219,0.24)",
    };
  }
  if (normalized.includes("bitty")) {
    return {
      accent: "#8eb2e4",
      glow: "rgba(142,178,228,0.3)",
      chipFill: "rgba(142,178,228,0.08)",
      chipStroke: "rgba(142,178,228,0.24)",
    };
  }
  return {
    accent: "#b7bcc7",
    glow: "rgba(183,188,199,0.3)",
    chipFill: "rgba(183,188,199,0.08)",
    chipStroke: "rgba(183,188,199,0.24)",
  };
}

function fitFontPx(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  weight: string,
  family: string,
): number {
  let fontSize = maxSize;
  while (fontSize > minSize) {
    ctx.font = `${weight} ${fontSize}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) {
      break;
    }
    fontSize -= 1;
  }
  return fontSize;
}

function formatClock(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${pad2(seconds)}`;
}
