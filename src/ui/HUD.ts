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

interface HudSpriteSource {
  drawSprite: (
    ctx: CanvasRenderingContext2D,
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => boolean;
}

export interface HudTopStripMetrics {
  compact: boolean;
  tight: boolean;
  safeInsetTop: number;
  panelH: number;
  gap: number;
  leftPanelW: number;
  rightPanelW: number;
  topStripBottom: number;
}

export function computeHudTopStripMetrics(
  viewportWidth: number,
  viewportHeight: number,
): HudTopStripMetrics {
  const compact = viewportWidth < 980 || viewportHeight < 700;
  const tight = !compact && (viewportWidth <= 1440 || viewportHeight <= 820);

  const safeInsetTop = compact
    ? clampNumber(Math.floor(viewportHeight * 0.016), 8, 14)
    : tight
      ? clampNumber(Math.floor(viewportHeight * 0.014), 8, 13)
      : clampNumber(Math.floor(viewportHeight * 0.016), 10, 18);
  const panelH = compact ? 80 : tight ? 84 : 90;
  const gap = compact ? 10 : tight ? 12 : 14;
  const leftPanelW = compact ? 192 : tight ? 220 : 232;
  const rightPanelW = compact ? 206 : tight ? 236 : 254;
  const topStripBottom = safeInsetTop + panelH + 6;

  return {
    compact,
    tight,
    safeInsetTop,
    panelH,
    gap,
    leftPanelW,
    rightPanelW,
    topStripBottom,
  };
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
    viewportHeight: number,
    snapshot: HudPresentationState,
    sprites?: HudSpriteSource,
  ): void {
    this.hpKickRemainMs = Math.max(0, this.hpKickRemainMs - 16);
    const scoreValue = snapshot.score ?? 0;
    const tier = getScoreTitle(scoreValue);
    const palette = getHudTierPalette(tier.color);
    const layout = computeHudTopStripMetrics(viewportWidth, viewportHeight);
    const compact = layout.compact;
    const tight = layout.tight;
    const safeInsetX = clampNumber(Math.floor(viewportWidth * 0.022), 12, 28);
    const safeInsetTop = layout.safeInsetTop;
    const marginX = compact ? safeInsetX : safeInsetX + 2;
    const panelY = safeInsetTop;
    const gap = layout.gap;
    const panelH = layout.panelH;
    const totalW = viewportWidth - marginX * 2;

    let leftPanelW = layout.leftPanelW;
    let rightPanelW = layout.rightPanelW;
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
    this.drawTopStripBackdrop(
      ctx,
      marginX - 8,
      panelY - 6,
      viewportWidth - marginX * 2 + 16,
      panelH + 12,
      palette,
    );

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
      tight,
      sprites,
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
      tight,
      sprites,
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
      tight,
      sprites,
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

    ctx.strokeStyle = "rgba(186, 212, 255, 0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + h - 16);
    ctx.lineTo(x + w - 12, y + h - 16);
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
    tight: boolean,
    sprites?: HudSpriteSource,
  ): void {
    this.drawPanelFrame(ctx, x, y, width, height, palette.glow);
    const ratioRaw = xpBudget > 0 ? xpValue / xpBudget : 0;
    const ratio = Math.max(0, Math.min(1, ratioRaw));

    const barX = x + 14;
    const barY = y + Math.floor(height * 0.48);
    const barW = width - 28;
    const barH = compactBarHeight(width);

    const gradient = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    gradient.addColorStop(0, "#58d6ff");
    gradient.addColorStop(0.5, "#7b8cff");
    gradient.addColorStop(1, "#b97cff");

    const drewIcon = this.drawHudIcon(ctx, sprites, "hud_xp", barX, y + 11, 12);

    ctx.fillStyle = "rgba(220,233,255,0.95)";
    ctx.font = `700 ${tight ? 8 : 9}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("XP TRACK", barX + (drewIcon ? 16 : 0), y + (tight ? 11 : 12));

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(214,224,246,0.84)";
    ctx.font = `700 ${tight ? 8 : 9}px 'JetBrains Mono', monospace`;
    ctx.fillText(`${Math.floor(xpValue)} / ${Math.floor(xpBudget)}`, x + width - 14, y + (tight ? 11 : 12));

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
    tight: boolean,
    sprites?: HudSpriteSource,
  ): void {
    ctx.save();
    this.drawPanelFrame(ctx, x, y, w, h, palette.glow);

    ctx.fillStyle = "#f7f2de";
    ctx.font = `800 ${tight ? 20 : 23}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${level}`, x + 32, y + (tight ? 26 : 28));

    ctx.fillStyle = "rgba(247, 242, 222, 0.62)";
    ctx.font = `700 ${tight ? 8 : 9}px 'JetBrains Mono', monospace`;
    ctx.fillText("LEVEL", x + 32, y + (tight ? 43 : 46));

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, x + 8, y + 8, 48, 48, 12);
    ctx.stroke();

    const drewRunIcon = this.drawHudIcon(ctx, sprites, "hud_hp", x + 70, y + 12, 12);

    ctx.fillStyle = "#f8f6ff";
    ctx.font = `700 ${tight ? 11 : 12}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Run Clock", x + 70 + (drewRunIcon ? 16 : 0), y + (tight ? 12 : 13));

    ctx.fillStyle = "rgba(219, 228, 255, 0.9)";
    ctx.font = `600 ${tight ? 11 : 12}px 'JetBrains Mono', monospace`;
    ctx.fillText(formatClock(elapsedMs), x + 70, y + (tight ? 30 : 33));

    this.drawHpBar(ctx, x + 68, y + h - 26, w - 84, tight ? 12 : 13, hpValue, hpMax, tight);

    const kick = Math.min(1, this.hpKickRemainMs / 180);
    if (kick > 0) {
      ctx.fillStyle = `rgba(255, 94, 117, ${0.12 * kick})`;
      this.roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 13);
      ctx.fill();
    }
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
    tight: boolean,
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
    ctx.font = `600 ${tight ? 8 : 9}px 'JetBrains Mono', monospace`;
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
    tight: boolean,
    sprites?: HudSpriteSource,
  ): void {
    ctx.save();
    this.drawPanelFrame(ctx, x, y, w, h, palette.glow);

    const drewScoreIcon = this.drawHudIcon(ctx, sprites, "hud_score", x + 14, y + 10, 12);

    ctx.fillStyle = "#f8f6ff";
    ctx.font = `700 ${tight ? 11 : 12}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Score", x + 14 + (drewScoreIcon ? 16 : 0), y + (tight ? 9 : 10));

    const scoreText = scoreValue.toLocaleString();
    const scoreFont = fitFontPx(
      ctx,
      scoreText,
      w - 28,
      tight
        ? Math.max(15, Math.min(18, Math.floor(w * 0.072)))
        : Math.max(16, Math.min(20, Math.floor(w * 0.084))),
      tight ? 11 : 12,
      "800",
      "'JetBrains Mono', monospace",
    );
    ctx.fillStyle = palette.accent;
    ctx.font = `800 ${scoreFont}px 'JetBrains Mono', monospace`;
    ctx.fillText(scoreText, x + 14, y + (tight ? 27 : 30));

    const tierX = x + 12;
    const tierY = y + (tight ? 46 : 52);
    const tierW = w - 24;
    const tierH = Math.max(tight ? 22 : 24, h - (tight ? 52 : 60));
    ctx.fillStyle = palette.chipFill;
    this.roundRect(ctx, tierX, tierY, tierW, tierH, 10);
    ctx.fill();
    ctx.strokeStyle = palette.chipStroke;
    ctx.lineWidth = 1;
    this.roundRect(ctx, tierX, tierY, tierW, tierH, 10);
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    ctx.font = "700 8px 'JetBrains Mono', monospace";
    ctx.fillText("TITLE TIER", tierX + 10, tierY + 5);

    const tierLabel = tierTitle.toUpperCase();
    const tierFont = fitFontPx(
      ctx,
      tierLabel,
      tierW - 20,
      tight
        ? Math.max(9, Math.min(10, Math.floor(tierW * 0.058)))
        : Math.max(10, Math.min(11, Math.floor(tierW * 0.065))),
      9,
      "900",
      "'Space Grotesk', sans-serif",
    );
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${tierFont}px 'Space Grotesk', sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(tierLabel, tierX + 10, tierY + (tight ? 13 : 14));
    ctx.restore();
  }

  private drawTopStripBackdrop(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    palette: HudTierPalette,
  ): void {
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, "rgba(6, 10, 20, 0.52)");
    gradient.addColorStop(1, "rgba(4, 7, 15, 0.38)");
    ctx.fillStyle = gradient;
    this.roundRect(ctx, x, y, w, h, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, w, h, 18);
    ctx.stroke();

    ctx.strokeStyle = palette.glow;
    ctx.lineWidth = 1;
    this.roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 17);
    ctx.stroke();
  }

  private drawHudIcon(
    ctx: CanvasRenderingContext2D,
    sprites: HudSpriteSource | undefined,
    id: string,
    x: number,
    y: number,
    size: number,
  ): boolean {
    if (sprites === undefined) {
      return false;
    }
    ctx.save();
    ctx.globalAlpha = 0.92;
    const drew = sprites.drawSprite(ctx, id, x, y, size, size);
    ctx.restore();
    return drew;
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

function getHudTierPalette(tierColor: string): HudTierPalette {
  const normalized = tierColor.toLowerCase();
  if (normalized === "gold") {
    return {
      accent: "#d7ba6a",
      glow: "rgba(215,186,106,0.32)",
      chipFill: "rgba(215,186,106,0.08)",
      chipStroke: "rgba(215,186,106,0.24)",
    };
  }
  if (normalized === "indigo") {
    return {
      accent: "#8b8fd6",
      glow: "rgba(139,143,214,0.3)",
      chipFill: "rgba(139,143,214,0.08)",
      chipStroke: "rgba(139,143,214,0.24)",
    };
  }
  if (normalized === "green") {
    return {
      accent: "#90c59a",
      glow: "rgba(144,197,154,0.32)",
      chipFill: "rgba(144,197,154,0.08)",
      chipStroke: "rgba(144,197,154,0.24)",
    };
  }
  if (normalized === "purple") {
    return {
      accent: "#ad94db",
      glow: "rgba(173,148,219,0.3)",
      chipFill: "rgba(173,148,219,0.08)",
      chipStroke: "rgba(173,148,219,0.24)",
    };
  }
  if (normalized === "blue") {
    return {
      accent: "#8eb2e4",
      glow: "rgba(142,178,228,0.3)",
      chipFill: "rgba(142,178,228,0.08)",
      chipStroke: "rgba(142,178,228,0.24)",
    };
  }
  return {
    accent: "#b58a65",
    glow: "rgba(181,138,101,0.28)",
    chipFill: "rgba(181,138,101,0.08)",
    chipStroke: "rgba(181,138,101,0.22)",
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

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
