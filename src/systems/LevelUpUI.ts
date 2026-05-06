import { LEVEL_CARD_OFFER_COUNT } from "../utils/constants";

export interface SurvivorLevelCardOffer {
  title: string;
  effect: string;
  details?: string;
  accent: string;
  /** Applies the perk after the survivor selects this row. */
  applySelection: () => void;
}

interface LevelCardLayout {
  cardWidth: number;
  cardHeight: number;
  gapX: number;
  gapY: number;
  originX: number;
  originY: number;
  columns: number;
}

/**
 * Lightweight pause overlay presenting {@link SurvivorLevelCardOffer} bundles.
 *
 * Activated entirely from canvas redraw + keyboard shortcuts (digits `1–4`).
 */
export class LevelUpUI {
  private overlayActive = false;

  private draftedCards: SurvivorLevelCardOffer[] = [];

  private readonly keyboardListener = (event: KeyboardEvent): void => {
    if (!this.overlayActive) {
      return;
    }

    switch (event.code) {
      case "Digit1":
      case "Numpad1":
        event.preventDefault();
        this.resolveSelectionAt(0);
        break;
      case "Digit2":
      case "Numpad2":
        event.preventDefault();
        this.resolveSelectionAt(1);
        break;
      case "Digit3":
      case "Numpad3":
        event.preventDefault();
        this.resolveSelectionAt(2);
        break;
      case "Digit4":
      case "Numpad4":
        event.preventDefault();
        this.resolveSelectionAt(3);
        break;
      default:
        break;
    }
  };

  private readonly clickListener = (event: MouseEvent): void => {
    if (!this.overlayActive || this.draftedCards.length === 0) {
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const layout = this.getLayout(width, height);

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    for (let idx = 0; idx < this.draftedCards.length; idx += 1) {
      const rect = this.getCardRect(layout, idx);
      if (
        mouseX >= rect.x &&
        mouseX <= rect.x + rect.w &&
        mouseY >= rect.y &&
        mouseY <= rect.y + rect.h
      ) {
        event.preventDefault();
        this.resolveSelectionAt(idx);
        break;
      }
    }
  };

  constructor(
    /** Fired immediately after perks apply — used to chain queued promotions. */
    private readonly notifySelectionResolved: (
      resolvedCard: SurvivorLevelCardOffer,
    ) => void,
  ) {
    window.addEventListener("keydown", this.keyboardListener, true);
    window.addEventListener("mousedown", this.clickListener, true);
  }

  /** Tear down listeners (hot reload disposal). */
  dispose(): void {
    window.removeEventListener("keydown", this.keyboardListener, true);
    window.removeEventListener("mousedown", this.clickListener, true);
    this.overlayActive = false;
    this.draftedCards.length = 0;
  }

  /** Returns whether gameplay simulation should halt for card input. */
  isBannerOpen(): boolean {
    return this.overlayActive;
  }

  /**
   * Opens the banner with trimmed / padded offerings respecting {@link LEVEL_CARD_OFFER_COUNT}.
   */
  presentOffers(offers: SurvivorLevelCardOffer[]): void {
    this.draftedCards = offers.slice(0, LEVEL_CARD_OFFER_COUNT);
    if (this.draftedCards.length === 0) {
      this.overlayActive = false;
      return;
    }
    this.overlayActive = true;
  }

  /** Renders the translucent pause banner + selectable cards using screen-space coordinates. */
  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.overlayActive) {
      return;
    }

    ctx.save();

    const backgroundGradient = ctx.createRadialGradient(
      width * 0.5,
      height * 0.15,
      20,
      width * 0.5,
      height * 0.3,
      Math.max(width, height) * 0.9,
    );
    backgroundGradient.addColorStop(0, "rgba(28, 36, 58, 0.88)");
    backgroundGradient.addColorStop(0.48, "rgba(9, 12, 24, 0.9)");
    backgroundGradient.addColorStop(1, "rgba(3, 5, 10, 0.96)");

    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, width, height);

    this.drawBackdropRings(ctx, width, height);

    ctx.fillStyle = "#fdf7ff";
    ctx.font = "900 36px 'Cinzel', 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("LEVEL UP", width * 0.5, height * 0.15);

    ctx.font = "600 14px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(205, 214, 255, 0.8)";
    ctx.fillText("Choose one blessing to continue the ritual.", width * 0.5, height * 0.2);

    const layout = this.getLayout(width, height);

    for (let idx = 0; idx < this.draftedCards.length; idx += 1) {
      const entry = this.draftedCards[idx];
      if (entry === undefined) {
        continue;
      }

      const rect = this.getCardRect(layout, idx);

      ctx.save();
      this.drawCard(ctx, rect, entry, idx);

      ctx.restore();
    }

    ctx.restore();
  }

  private drawCard(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; w: number; h: number },
    entry: SurvivorLevelCardOffer,
    index: number,
  ): void {
    const { x, y, w, h } = rect;
    const accentGlow = this.mixAccent(entry.accent, 0.34);
    const accentFaint = this.mixAccent(entry.accent, 0.12);

    const fillGradient = ctx.createLinearGradient(x, y, x, y + h);
    fillGradient.addColorStop(0, "rgba(11, 16, 33, 0.96)");
    fillGradient.addColorStop(1, "rgba(6, 8, 14, 0.98)");

    ctx.fillStyle = fillGradient;
    this.roundPane(ctx, x, y, w, h, 18);
    ctx.fill();

    ctx.strokeStyle = accentGlow;
    ctx.lineWidth = 2.5;
    this.roundPane(ctx, x, y, w, h, 18);
    ctx.stroke();

    ctx.strokeStyle = accentFaint;
    ctx.lineWidth = 1;
    this.roundPane(ctx, x + 4, y + 4, w - 8, h - 8, 14);
    ctx.stroke();

    ctx.fillStyle = accentFaint;
    this.roundPane(ctx, x, y, w, 8, 18);
    ctx.fill();

    ctx.save();
    ctx.fillStyle = this.withAlpha(entry.accent, 0.14);
    ctx.beginPath();
    ctx.arc(x + w - 34, y + 34, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = this.withAlpha(entry.accent, 0.9);
    ctx.font = "800 16px 'Space Grotesk', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${index + 1}`, x + w - 28, y + 34);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "700 9px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("SKILL", x + 18, y + 28);

    ctx.fillStyle = "#f9fbff";
    ctx.font = "700 19px 'Space Grotesk', 'Segoe UI', sans-serif";
    drawTextBlock(ctx, entry.title, x + w * 0.5, y + 52, w - 62, 22, 2, "center");

    const effectLabelY = y + 96;
    ctx.fillStyle = this.withAlpha(entry.accent, 0.9);
    ctx.font = "700 10px 'JetBrains Mono', monospace";
    ctx.fillText("EFFECT", x + 18, effectLabelY);

    ctx.fillStyle = "rgba(245, 247, 255, 0.95)";
    const effectBottom = drawTextBlock(
      ctx,
      entry.effect,
      x + 18,
      effectLabelY + 18,
      w - 36,
      16,
      3,
      "left",
    );

    if (entry.details !== undefined && entry.details.trim().length > 0) {
      const detailsLabelY = Math.max(effectBottom + 10, y + h - 52);
      ctx.fillStyle = "rgba(205,214,255,0.8)";
      ctx.font = "700 10px 'JetBrains Mono', monospace";
      ctx.fillText("DETAILS", x + 18, detailsLabelY);

      ctx.fillStyle = "rgba(205,214,255,0.92)";
      drawTextBlock(
        ctx,
        entry.details,
        x + 18,
        detailsLabelY + 16,
        w - 36,
        14,
        2,
        "left",
      );
    }
  }

  private resolveSelectionAt(index: number): void {
    if (!this.overlayActive) {
      return;
    }

    const card = this.draftedCards[index];
    if (card === undefined) {
      return;
    }

    card.applySelection();
    this.overlayActive = false;
    this.draftedCards.length = 0;
    this.notifySelectionResolved(card);
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

  private getLayout(width: number, height: number): LevelCardLayout {
    const columns = 2;
    const gapX = Math.max(20, Math.floor(width * 0.022));
    const gapY = Math.max(14, Math.floor(height * 0.026));
    const cardWidth = Math.min(
      420,
      Math.max(280, Math.floor((width - gapX * 3) / columns)),
    );
    const cardHeight = Math.min(
      206,
      Math.max(172, Math.floor(height * 0.31)),
    );
    const rowCount = Math.ceil(Math.max(1, this.draftedCards.length) / columns);
    const totalWidth = columns * cardWidth + (columns - 1) * gapX;
    const totalHeight = rowCount * cardHeight + (rowCount - 1) * gapY;
    const originX = Math.max(16, Math.floor((width - totalWidth) / 2));
    const originY = Math.max(132, Math.floor(height * 0.28 - totalHeight * 0.15));

    return {
      cardWidth,
      cardHeight,
      gapX,
      gapY,
      originX,
      originY,
      columns,
    };
  }

  private getCardRect(
    layout: LevelCardLayout,
    index: number,
  ): { x: number; y: number; w: number; h: number } {
    const col = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    return {
      x: layout.originX + col * (layout.cardWidth + layout.gapX),
      y: layout.originY + row * (layout.cardHeight + layout.gapY),
      w: layout.cardWidth,
      h: layout.cardHeight,
    };
  }

  private drawBackdropRings(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = "rgba(127,224,168,0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.39, Math.min(width, height) * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.39, Math.min(width, height) * 0.26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private mixAccent(hex: string, alpha: number): string {
    return this.withAlpha(hex, alpha);
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
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineStep: number,
  maxLines: number,
  align: CanvasTextAlign = "center",
): number {
  if (text.trim().length === 0) {
    return startY;
  }

  const lines = wrapText(ctx, text, maxWidth, maxLines);

  ctx.textAlign = align;
  let cursor = startY;
  lines.forEach((line) => {
    ctx.fillText(line, centerX, cursor);
    cursor += lineStep;
  });

  return cursor;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current.length > 0 ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }

    if (current.length > 0) {
      lines.push(current);
    }
    current = word;

    if (lines.length >= maxLines - 1) {
      break;
    }
  }

  if (lines.length < maxLines && current.length > 0) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (lines.length === maxLines && words.length > 0) {
    const consumed = lines.join(" ").length;
    if (text.length > consumed) {
      const lastIndex = lines.length - 1;
      lines[lastIndex] = trimToWidth(ctx, lines[lastIndex] ?? "", maxWidth, true);
    }
  }

  return lines;
}

function trimToWidth(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  addEllipsis: boolean,
): string {
  const ellipsis = addEllipsis ? "…" : "";
  let text = value;
  while (text.length > 0 && ctx.measureText(`${text}${ellipsis}`).width > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text}${ellipsis}`;
}
