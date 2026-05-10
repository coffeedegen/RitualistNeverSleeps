import { LEVEL_CARD_OFFER_COUNT } from "../utils/constants";
import { SpriteRegistry } from "../render/SpriteRegistry";

export interface SurvivorLevelCardOffer {
  title: string;
  effect: string;
  details?: string;
  accent: string;
  iconSpriteId?: string;
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
 * Activated entirely from canvas redraw + keyboard shortcuts (digits `1–3`).
 */
export class LevelUpUI {
  private overlayActive = false;

  private draftedCards: SurvivorLevelCardOffer[] = [];
  private readonly sprites = new SpriteRegistry();
  private spriteReady = false;
  private readonly iconScratch = document.createElement("canvas");

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
    void this.primeSprites();
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
    backgroundGradient.addColorStop(0, "rgba(44, 14, 22, 0.92)");
    backgroundGradient.addColorStop(0.42, "rgba(16, 8, 18, 0.94)");
    backgroundGradient.addColorStop(1, "rgba(3, 4, 8, 0.98)");

    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, width, height);

    this.drawBackdropRings(ctx, width, height);
    this.drawBackdropSigils(ctx, width, height);

    const compactHeader = height < 720 || width < 980;
    ctx.fillStyle = "#fdf7ff";
    ctx.font = compactHeader
      ? "900 40px 'Cinzel', 'Times New Roman', serif"
      : "900 52px 'Cinzel', 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("LEVEL UP", width * 0.5, compactHeader ? Math.max(92, height * 0.13) : Math.max(126, height * 0.15));

    if (!compactHeader) {
      ctx.font = "700 14px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(239, 225, 232, 0.82)";
      ctx.fillText("Choose one blessing to continue the ritual.", width * 0.5, Math.max(168, height * 0.205));

      ctx.font = "700 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(255, 185, 205, 0.78)";
      ctx.fillText("PRESS 1 - 3 OR CLICK A CARD", width * 0.5, Math.max(198, height * 0.235));
    }

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
    const isCenterCard = index === 1 && this.draftedCards.length === 3;
    const radius = 16;
    const fillGradient = ctx.createLinearGradient(x, y, x, y + h);
    fillGradient.addColorStop(0, isCenterCard ? "rgba(40, 15, 30, 0.98)" : "rgba(16, 11, 21, 0.97)");
    fillGradient.addColorStop(1, "rgba(7, 7, 12, 0.99)");
    ctx.fillStyle = fillGradient;
    this.roundPane(ctx, x, y, w, h, radius);
    ctx.fill();

    ctx.strokeStyle = this.mixAccent(entry.accent, isCenterCard ? 0.6 : 0.44);
    ctx.lineWidth = isCenterCard ? 3.2 : 2.4;
    this.roundPane(ctx, x, y, w, h, radius);
    ctx.stroke();

    ctx.strokeStyle = this.mixAccent(entry.accent, 0.2);
    ctx.lineWidth = 1;
    this.roundPane(ctx, x + 6, y + 6, w - 12, h - 12, radius - 5);
    ctx.stroke();

    const padX = Math.max(20, Math.floor(w * 0.07));
    const padTop = Math.max(18, Math.floor(h * 0.045));
    const padBottom = Math.max(18, Math.floor(h * 0.05));
    let sectionGap = Math.max(8, Math.floor(h * 0.02));
    const contentX = x + padX;
    const contentY = y + padTop;
    const contentW = w - padX * 2;
    const contentH = h - padTop - padBottom;

    let titleZoneH = Math.floor(contentH * 0.2);
    let iconZoneH = Math.floor(contentH * 0.31);
    let effectZoneH = Math.floor(contentH * 0.22);
    let detailsZoneH = contentH - titleZoneH - iconZoneH - effectZoneH - sectionGap * 3;

    const minTitleZoneH = Math.max(40, Math.floor(contentH * 0.14));
    const minIconZoneH = Math.max(56, Math.floor(contentH * 0.2));
    const minEffectZoneH = Math.max(46, Math.floor(contentH * 0.16));
    const minDetailsZoneH = Math.max(42, Math.floor(contentH * 0.2));

    if (detailsZoneH < minDetailsZoneH) {
      let deficit = minDetailsZoneH - detailsZoneH;

      const iconTrim = Math.min(deficit, Math.max(0, iconZoneH - minIconZoneH));
      iconZoneH -= iconTrim;
      deficit -= iconTrim;

      const effectTrim = Math.min(deficit, Math.max(0, effectZoneH - minEffectZoneH));
      effectZoneH -= effectTrim;
      deficit -= effectTrim;

      const titleTrim = Math.min(deficit, Math.max(0, titleZoneH - minTitleZoneH));
      titleZoneH -= titleTrim;
      deficit -= titleTrim;

      if (deficit > 0) {
        const gapTrim = Math.min(deficit, Math.max(0, sectionGap - 6) * 3);
        sectionGap -= Math.floor(gapTrim / 3);
      }

      detailsZoneH = contentH - titleZoneH - iconZoneH - effectZoneH - sectionGap * 3;
    }

    const skillName = this.extractSkillName(entry.title);
    const normalizedTitle = `Take ${skillName}`;
    const titleCenterX = contentX + contentW * 0.5;
    ctx.fillStyle = "#f7fbff";
    ctx.font = "700 16px 'Space Grotesk', 'Segoe UI', sans-serif";
    ctx.textBaseline = "alphabetic";
    drawCenteredTextInZone(
      ctx,
      normalizedTitle,
      titleCenterX,
      contentY,
      titleZoneH,
      Math.floor(contentW * 0.96),
      19,
      2,
    );

    const iconZoneTop = contentY + titleZoneH + sectionGap;
    const iconWrapSize = Math.max(
      92,
      Math.min(Math.floor(contentW * 0.48), Math.floor(iconZoneH * 0.9)),
    );
    const iconWrapX = Math.floor(contentX + (contentW - iconWrapSize) * 0.5);
    const iconWrapY = Math.floor(iconZoneTop + (iconZoneH - iconWrapSize) * 0.5);
    const iconAccent = this.resolveIconAccent(entry);

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    this.roundPane(ctx, iconWrapX, iconWrapY, iconWrapSize, iconWrapSize, 14);
    ctx.fill();
    const iconGlow = ctx.createRadialGradient(
      iconWrapX + iconWrapSize * 0.5,
      iconWrapY + iconWrapSize * 0.44,
      iconWrapSize * 0.1,
      iconWrapX + iconWrapSize * 0.5,
      iconWrapY + iconWrapSize * 0.5,
      iconWrapSize * 0.8,
    );
    iconGlow.addColorStop(0, this.withAlpha(iconAccent, 0.2));
    iconGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = iconGlow;
    this.roundPane(ctx, iconWrapX + 2, iconWrapY + 2, iconWrapSize - 4, iconWrapSize - 4, 12);
    ctx.fill();
    ctx.strokeStyle = this.withAlpha(iconAccent, 0.52);
    ctx.lineWidth = 1.8;
    this.roundPane(ctx, iconWrapX, iconWrapY, iconWrapSize, iconWrapSize, 14);
    ctx.stroke();
    ctx.strokeStyle = this.withAlpha(iconAccent, 0.18);
    ctx.lineWidth = 1;
    this.roundPane(ctx, iconWrapX + 4, iconWrapY + 4, iconWrapSize - 8, iconWrapSize - 8, 11);
    ctx.stroke();

    this.drawOfferIconCentered(ctx, iconWrapX, iconWrapY, iconWrapSize, entry, iconAccent);

    const effectZoneTop = iconZoneTop + iconZoneH + sectionGap;
    const effectMaxWidth = Math.floor(contentW * 0.94);
    ctx.fillStyle = "rgba(244, 247, 255, 0.97)";
    ctx.font = "700 12px 'Inter', system-ui, sans-serif";
    drawCenteredTextInZone(
      ctx,
      entry.effect,
      contentX + contentW * 0.5,
      effectZoneTop,
      effectZoneH,
      effectMaxWidth,
      16,
      4,
    );

    const detailsZoneTop = effectZoneTop + effectZoneH + sectionGap;
    const detailsText = entry.details ?? "No additional details available.";
    ctx.fillStyle = "rgba(214, 217, 228, 0.96)";
    ctx.font = "600 11px 'JetBrains Mono', monospace";
    drawCenteredTextInZone(
      ctx,
      detailsText,
      contentX + contentW * 0.5,
      detailsZoneTop,
      detailsZoneH,
      effectMaxWidth,
      14,
      5,
    );
  }

  private async primeSprites(): Promise<void> {
    await Promise.allSettled([
      this.sprites.loadManifest("/assets/manifests/weapon_icons_64_atlas.json"),
      this.sprites.loadManifest("/assets/manifests/passives_64_atlas.json"),
      this.sprites.loadManifest("/assets/manifests/ui_icons_atlas.json"),
    ]);
    this.spriteReady = true;
  }

  private drawOfferIconCentered(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    boxSize: number,
    entry: SurvivorLevelCardOffer,
    accent: string,
  ): void {
    const iconSize = Math.floor(boxSize * 0.7); // 200% visual scale target vs old ~32px icon.
    const iconX = Math.floor(x + (boxSize - iconSize) * 0.5);
    const iconY = Math.floor(y + (boxSize - iconSize) * 0.5);
    const spriteId = entry.iconSpriteId;
    const drew = this.spriteReady
      && spriteId !== undefined
      && this.drawIsolatedSprite(ctx, spriteId, iconX, iconY, iconSize, iconSize);
    if (!drew) {
      ctx.fillStyle = this.withAlpha(accent, 0.9);
      ctx.font = "800 24px 'Space Grotesk', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✦", x + boxSize / 2, y + boxSize / 2 + 1);
    }
  }

  private drawIsolatedSprite(
    ctx: CanvasRenderingContext2D,
    spriteId: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): boolean {
    const handle = this.sprites.getSprite(spriteId);
    if (handle === undefined) {
      return false;
    }

    const sourceW = Math.max(1, Math.floor(handle.rect.w));
    const sourceH = Math.max(1, Math.floor(handle.rect.h));
    if (this.iconScratch.width !== sourceW || this.iconScratch.height !== sourceH) {
      this.iconScratch.width = sourceW;
      this.iconScratch.height = sourceH;
    }

    const scratchCtx = this.iconScratch.getContext("2d");
    if (scratchCtx === null) {
      return false;
    }

    scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
    scratchCtx.imageSmoothingEnabled = false;
    scratchCtx.clearRect(0, 0, sourceW, sourceH);

    // Copy the exact source cell into an isolated buffer before scaling.
    // This prevents neighboring packed icons from bleeding into the draw.
    scratchCtx.drawImage(
      handle.image,
      Math.floor(handle.rect.x),
      Math.floor(handle.rect.y),
      sourceW,
      sourceH,
      0,
      0,
      sourceW,
      sourceH,
    );

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.iconScratch, 0, 0, sourceW, sourceH, x, y, w, h);
    return true;
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
    const cardCount = Math.max(1, this.draftedCards.length);
    let columns = Math.min(3, cardCount);
    if (columns === 3 && width < 1280) {
      columns = 2;
    }
    if (columns >= 2 && width < 700) {
      columns = 1;
    }

    const rowCount = Math.ceil(cardCount / columns);
    const sidePad = Math.max(20, Math.floor(width * 0.035));
    const gapX = Math.max(24, Math.min(56, Math.floor(width * 0.024)));
    const gapY = Math.max(20, Math.floor(height * 0.026));
    const availableW = width - sidePad * 2 - gapX * (columns - 1);
    const cardWidth = Math.max(260, Math.floor(availableW / columns));
    const compactHeader = height < 720 || width < 980;
    const headerClearance = compactHeader
      ? Math.max(104, Math.floor(height * 0.14))
      : Math.max(220, Math.floor(height * 0.25));
    const baseHeightRatio = rowCount > 1 ? 0.33 : 0.44;
    let cardHeight = Math.max(rowCount > 1 ? 210 : 338, Math.min(472, Math.floor(height * baseHeightRatio)));
    if (rowCount > 1) {
      const maxByViewport = Math.floor(
        (height - headerClearance - 22 - gapY * (rowCount - 1)) / rowCount,
      );
      cardHeight = Math.max(180, Math.min(cardHeight, maxByViewport));
    }
    const totalWidth = columns * cardWidth + (columns - 1) * gapX;
    const totalHeight = rowCount * cardHeight + (rowCount - 1) * gapY;
    const originX = Math.max(sidePad, Math.floor((width - totalWidth) / 2));
    const maxOriginY = Math.max(20, height - totalHeight - 22);
    const preferredOriginY = compactHeader
      ? Math.max(headerClearance, Math.floor(height * 0.16))
      : Math.max(headerClearance, Math.floor(height * 0.275));
    const originY = Math.max(20, Math.min(preferredOriginY, maxOriginY));

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

  private extractSkillName(title: string): string {
    const cleaned = title
      .replace(/^take\s+/i, "")
      .replace(/^upgrade\s+/i, "")
      .replace(/^rank up\s+/i, "")
      .replace(/^evolve\s*-\s*/i, "")
      .trim();
    return cleaned.length > 0 ? cleaned : "Unknown Blessing";
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
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = "rgba(255, 170, 196, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.39, Math.min(width, height) * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.39, Math.min(width, height) * 0.26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawBackdropSigils(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "rgba(255, 205, 220, 0.16)";
    ctx.lineWidth = 1;
    const radius = Math.min(width, height) * 0.12;
    const sigilY = height * 0.34;
    for (const offset of [-1, 0, 1]) {
      const cx = width * 0.5 + offset * radius * 1.9;
      ctx.beginPath();
      ctx.arc(cx, sigilY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - radius * 0.65, sigilY);
      ctx.lineTo(cx + radius * 0.65, sigilY);
      ctx.moveTo(cx, sigilY - radius * 0.65);
      ctx.lineTo(cx, sigilY + radius * 0.65);
      ctx.stroke();
    }
    ctx.restore();
  }

  private mixAccent(hex: string, alpha: number): string {
    return this.withAlpha(hex, alpha);
  }

  private resolveIconAccent(entry: SurvivorLevelCardOffer): string {
    const spriteId = entry.iconSpriteId ?? "";
    const accentBySpriteId: Record<string, string> = {
      lash: "#ff7d8d",
      crimson_lash: "#ff5a7a",
      arcane_bolt: "#72b8ff",
      sanctified_bolt: "#9fe1ff",
      shard_blade: "#a9b8ff",
      thousand_shards: "#d3dcff",
      cleaver: "#ffb36c",
      reaper_spiral: "#ff8f5c",
      sanctum_cross: "#8cf3d1",
      celestial_blade: "#cfe8ff",
      orbiting_tome: "#b79bff",
      nocturne_tome: "#9d83ff",
      ember_wand: "#ff9664",
      inferno_burst: "#ff6e59",
      warding_aura: "#8eff86",
      life_drain: "#63ff9d",
      sanctified_tide: "#6fdcff",
      deluge: "#55b9ff",
      rune_shard: "#8bc0ff",
      final_sigil: "#b8c7ff",
      storm_ring: "#f7ee72",
      tempest_loop: "#ffee8c",
      sigil_nova: "#ff8bf0",
      lunar_bloom: "#d6c6ff",
      ironleaf: "#8cd46b",
      bastion_plate: "#b9c2d0",
      vessel_heart: "#66ffd4",
      ruby_root: "#ff7d9b",
      hollow_tome: "#89b2ff",
      flare_lantern: "#82ffb1",
      swiftband: "#ffd48a",
      timeweave: "#c89bff",
      echo_lens: "#91f5ff",
      gale_wings: "#8edcff",
      graviton_seed: "#78f0be",
      fortune_leaf: "#8dffa0",
      ascension_crown: "#ffd96a",
      gilded_mask: "#d5ffd0",
      hud_hp: "#ff7b8d",
      hud_xp: "#79b8ff",
    };

    return accentBySpriteId[spriteId] ?? entry.accent;
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

function drawCenteredTextInZone(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  zoneY: number,
  zoneHeight: number,
  maxWidth: number,
  lineStep: number,
  preferredMaxLines: number,
): number {
  if (text.trim().length === 0) {
    return zoneY;
  }

  const zoneMaxLines = Math.max(1, Math.floor(zoneHeight / Math.max(1, lineStep)));
  const maxLines = Math.max(1, Math.min(preferredMaxLines, zoneMaxLines));
  const lines = wrapText(ctx, text, maxWidth, maxLines);
  const textBlockH = Math.max(lineStep, lines.length * lineStep);
  const startY = zoneY + Math.max(lineStep, Math.floor((zoneHeight - textBlockH) * 0.5) + lineStep);

  ctx.textAlign = "center";
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
