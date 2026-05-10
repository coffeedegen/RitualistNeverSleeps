import {
  buildRunCardExportName,
  buildXShareText,
  measureRunCard,
  type RunCardSummary,
} from "./RunCardRenderer";
import { formatRunDuration } from "../utils/time";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { toBlob } from "html-to-image";
import MintableCard from "../ui/MintableCard.jsx";

const EXPORT_CARD_WIDTH_PX = 1080;
const EXPORT_CARD_HEIGHT_PX = 900; // export wrapper; actual capture hugs content

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
  onMintCard: (summary: RunCardSummary) => void;
  isMintEnabled?: () => boolean;
  isMintBusy?: () => boolean;
  getMintButtonLabel?: () => string;
  getMintDisabledReason?: () => string | null;
}

type OverlayMode = "hidden" | "gameOver" | "confirmQuit";

/**
 * Canvas overlay shown after the survivor dies.
 *
 * The overlay now centers on a mint-ready run card with share/export actions,
 * while keeping the restart / menu controls available in the same layer.
 */
export class GameOverUI {
  private overlayMode: OverlayMode = "hidden";

  private actionLocked = false;

  private shareBusy = false;
  private pressedButton: string | null = null;
  private pressedUntilMs = 0;

  private readonly clickListener = (event: MouseEvent): void => {
    if (this.overlayMode === "hidden" || this.actionLocked) {
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    if (this.overlayMode === "gameOver") {
      const frame = this.summary !== null ? this.getAnimatedCardFrame(width, height) : null;
      const cardButtons = frame ? this.getCardActions(width, height, frame) : null;
      if (cardButtons && this.summary !== null && this.hitTest(mouseX, mouseY, cardButtons.mint)) {
        event.preventDefault();
        if (!this.canMintCard() || this.isMintBusy()) {
          console.warn("[mint-disabled]", this.getMintDisabledReason());
          return;
        }
        this.markPressed("card-mint");
        this.callbacks.onMintCard(this.summary);
        return;
      }

      if (cardButtons && this.summary !== null && this.hitTest(mouseX, mouseY, cardButtons.share)) {
        event.preventDefault();
        this.markPressed("card-share");
        void this.shareRunCard();
        return;
      }

      if (cardButtons && this.summary !== null && this.hitTest(mouseX, mouseY, cardButtons.download)) {
        event.preventDefault();
        this.markPressed("card-download");
        void this.downloadRunCard();
        return;
      }

      const buttons = this.getMainButtons(width, height, frame);
      if (this.hitTest(mouseX, mouseY, buttons.start)) {
        event.preventDefault();
        this.markPressed("main-start");
        this.actionLocked = true;
        this.callbacks.onStartNewGame();
        return;
      }

      if (this.hitTest(mouseX, mouseY, buttons.menu)) {
        event.preventDefault();
        this.markPressed("main-menu");
        this.actionLocked = true;
        this.callbacks.onBackToMainMenu();
        return;
      }

      if (this.hitTest(mouseX, mouseY, buttons.quit)) {
        event.preventDefault();
        this.markPressed("main-quit");
        this.overlayMode = "confirmQuit";
      }
      return;
    }

    const buttons = this.getQuitButtons(width, height);
    if (this.hitTest(mouseX, mouseY, buttons.yes)) {
      event.preventDefault();
      this.markPressed("quit-yes");
      this.actionLocked = true;
      this.callbacks.onQuitConfirmed();
      return;
    }

    if (this.hitTest(mouseX, mouseY, buttons.no)) {
      event.preventDefault();
      this.markPressed("quit-no");
      this.overlayMode = "gameOver";
    }
  };

  private summary: RunCardSummary | null = null;

  private avatarDataUrl: string | null = null;

  private avatarLoadSerial = 0;
  private walletPanelHidden = false;
  private cardHost: HTMLDivElement | null = null;
  private cardRoot: Root | null = null;

  constructor(private readonly callbacks: GameOverUICallbacks) {
    window.addEventListener("mousedown", this.clickListener, true);
  }

  dispose(): void {
    window.removeEventListener("mousedown", this.clickListener, true);
    this.overlayMode = "hidden";
    this.actionLocked = false;
    this.shareBusy = false;
    this.summary = null;
    this.avatarDataUrl = null;
    this.pressedButton = null;
    this.pressedUntilMs = 0;
    this.destroyReactCard();
    this.setWalletPanelVisible(true);
  }

  present(summary: RunCardSummary): void {
    this.summary = summary;
    this.overlayMode = "gameOver";
    this.actionLocked = false;
    this.shareBusy = false;
    this.pressedButton = null;
    this.pressedUntilMs = 0;
    this.avatarDataUrl = null;
    this.loadAvatar(summary);
    this.setWalletPanelVisible(false);
  }

  isBannerOpen(): boolean {
    return this.overlayMode !== "hidden";
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.overlayMode === "hidden") {
      this.destroyReactCard();
      return;
    }
    this.setWalletPanelVisible(false);

    ctx.save();
    const backdrop = ctx.createRadialGradient(
      width * 0.5,
      height * 0.22,
      10,
      width * 0.5,
      height * 0.45,
      Math.max(width, height) * 0.95,
    );
    backdrop.addColorStop(0, "rgba(34, 18, 28, 0.92)");
    backdrop.addColorStop(0.45, "rgba(8, 11, 22, 0.94)");
    backdrop.addColorStop(1, "rgba(2, 3, 7, 0.98)");
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    this.drawBackdrop(ctx, width, height);

    if (this.overlayMode === "confirmQuit") {
      this.destroyReactCard();
      this.drawTitle(ctx, width, height, null);
      this.drawQuitConfirmation(ctx, width, height);
    } else {
      if (this.summary !== null) {
        const frame = this.getAnimatedCardFrame(width, height);
        this.drawTitle(ctx, width, height, frame);
        this.renderReactMintableCard(frame);
        this.drawCardActions(ctx, frame, width, height);
        this.drawMainButtons(ctx, width, height, frame);
      } else {
        this.destroyReactCard();
        this.drawTitle(ctx, width, height, null);
        this.drawMainButtons(ctx, width, height, null);
      }
    }

    ctx.restore();
  }

  private drawTitle(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frame: { x: number; y: number; w: number; h: number } | null,
  ): void {
    const compact = this.isCompactLayout(width, height);
    const titleY = frame
      ? clamp(frame.y - (compact ? 74 : 82), compact ? 48 : 54, frame.y - (compact ? 32 : 38))
      : height * (compact ? 0.14 : 0.13);
    const subtitleY = titleY + (compact ? 18 : 22);
    const titleMaxWidth = frame ? Math.min(width * 0.86, frame.w + 190) : width * 0.8;
    const titleSize = fitHeadlineFont(
      ctx,
      "RITUAL RUN ARCHIVE",
      titleMaxWidth,
      compact ? 26 : 34,
      compact ? 17 : 21,
      "900",
      "'Cinzel', 'Times New Roman', serif",
    );
    const titleFill = ctx.createLinearGradient(0, titleY - 28, 0, titleY + 8);
    titleFill.addColorStop(0, "rgba(244,255,249,0.96)");
    titleFill.addColorStop(0.62, "rgba(202,245,225,0.93)");
    titleFill.addColorStop(1, "rgba(136,223,181,0.92)");
    ctx.fillStyle = titleFill;
    ctx.shadowColor = "rgba(87, 224, 166, 0.28)";
    ctx.shadowBlur = compact ? 6 : 9;
    ctx.font = `900 ${titleSize}px 'Cinzel', 'Times New Roman', serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("RITUAL RUN ARCHIVE", width * 0.5, titleY);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(216,233,255,0.52)";
    ctx.font = `600 ${compact ? 9 : 10}px 'JetBrains Mono', monospace`;
    ctx.fillText("MINT / SHARE / DOWNLOAD", width * 0.5, subtitleY);
  }

  private drawMainButtons(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frame: { x: number; y: number; w: number; h: number } | null,
  ): void {
    const compact = this.isCompactLayout(width, height);
    const layout = this.getMainButtons(width, height, frame);
    const accentFont = compact ? 14 : 16;

    this.drawButton(ctx, layout.start, "Start a New Game", "#41d37c", accentFont, true, this.isPressed("main-start"));
    this.drawButton(ctx, layout.menu, "Back to Main Menu", "#41d37c", accentFont, false, this.isPressed("main-menu"));
    this.drawButton(ctx, layout.quit, "Quit", "#41d37c", accentFont, false, this.isPressed("main-quit"));
  }

  private drawCardActions(
    ctx: CanvasRenderingContext2D,
    frame: { x: number; y: number; w: number; h: number },
    width: number,
    height: number,
  ): void {
    const compact = this.isCompactLayout(width, height);
    const { mint, share, download } = this.getCardActions(width, height, frame);
    const mintEnabled = this.canMintCard();
    const mintBusy = this.isMintBusy();
    const mintLabel = mintBusy
      ? "Connecting wallet..."
      : (this.callbacks.getMintButtonLabel?.()
        ?? (mintEnabled ? "Mint this Card" : "Mint Unavailable"));

    this.drawButton(
      ctx,
      mint,
      mintLabel,
      "#41d37c",
      compact ? 13 : 14,
      true,
      this.isPressed("card-mint"),
      !mintEnabled || mintBusy,
    );
    this.drawButton(ctx, share, "Share to X", "#41d37c", compact ? 13 : 14, true, this.isPressed("card-share"));
    this.drawButton(ctx, download, "Download Card", "#41d37c", compact ? 13 : 14, true, this.isPressed("card-download"));

    if (!mintEnabled && !mintBusy) {
      const reason = this.callbacks.getMintDisabledReason?.();
      if (reason) {
        const hintMaxWidth = mint.w * 2 + 14;
        ctx.fillStyle = "rgba(245, 174, 126, 0.92)";
        ctx.font = `600 ${compact ? 10 : 11}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const hintY = Math.min(frame.y - 8, mint.y + mint.h + (compact ? 8 : 10));
        wrapAndFillText(
          ctx,
          `Mint disabled: ${reason}`,
          width * 0.5,
          hintY,
          hintMaxWidth,
          compact ? 12 : 13,
        );
      }
    }
  }

  private drawQuitConfirmation(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const compact = this.isCompactLayout(width, height);
    const questionY = height * (compact ? 0.40 : 0.42);

    const panelW = Math.min(width * 0.86, 620);
    const panelH = compact ? 100 : 108;
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
    ctx.font = `700 ${compact ? 17 : 20}px 'Space Grotesk', 'Segoe UI', sans-serif`;
    wrapAndFillText(
      ctx,
      "Are you sure you want to quit the game?",
      width * 0.5,
      panelY + panelH / 2,
      panelW - 36,
      compact ? 24 : 28,
    );

    const buttons = this.getQuitButtons(width, height);
    const accentFont = compact ? 14 : 16;
    this.drawButton(ctx, buttons.yes, "Yes", "#41d37c", accentFont, false, this.isPressed("quit-yes"));
    this.drawButton(ctx, buttons.no, "No", "#41d37c", accentFont, false, this.isPressed("quit-no"));
  }

  private drawButton(
    ctx: CanvasRenderingContext2D,
    rect: ButtonRect,
    text: string,
    accent: string,
    fontSize: number,
    highlight = false,
    pressed = false,
    disabled = false,
  ): void {
    const pressOffset = pressed && !disabled ? 2 : 0;
    const drawX = rect.x;
    const drawY = rect.y + pressOffset;
    const drawH = Math.max(10, rect.h - pressOffset);

    const fillGradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    if (disabled) {
      fillGradient.addColorStop(0, "rgba(28, 31, 41, 0.96)");
      fillGradient.addColorStop(1, "rgba(16, 18, 26, 0.95)");
    } else {
      fillGradient.addColorStop(0, pressed ? "rgba(18, 26, 20, 0.98)" : "rgba(22, 28, 46, 0.98)");
      fillGradient.addColorStop(1, pressed ? "rgba(5, 14, 9, 0.98)" : "rgba(7, 9, 15, 0.98)");
    }
    ctx.fillStyle = fillGradient;
    this.roundPane(ctx, drawX, drawY, rect.w, drawH, 8);
    ctx.fill();

    ctx.strokeStyle = disabled ? "rgba(138, 146, 166, 0.55)" : accent;
    ctx.lineWidth = disabled ? 2 : (pressed ? 2 : (highlight ? 4 : 3));
    this.roundPane(ctx, drawX, drawY, rect.w, drawH, 8);
    ctx.stroke();

    ctx.fillStyle = disabled ? "rgba(160, 174, 192, 0.08)" : this.withAlpha(accent, pressed ? 0.26 : 0.14);
    this.roundPane(ctx, drawX + 4, drawY + 4, rect.w - 8, drawH - 8, 6);
    ctx.fill();

    ctx.fillStyle = disabled ? "rgba(204, 213, 225, 0.8)" : "#ffffff";
    ctx.font = `700 ${fontSize}px 'Space Grotesk', ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, drawX + rect.w / 2, drawY + drawH / 2 + (pressed && !disabled ? 0.5 : 0));
  }

  private getMainButtons(
    width: number,
    height: number,
    frame: { x: number; y: number; w: number; h: number } | null,
  ): {
    start: ButtonRect;
    menu: ButtonRect;
    quit: ButtonRect;
  } {
    if (this.isCompactLayout(width, height)) {
      const buttonW = Math.min(284, Math.max(180, (width - 38) / 2));
      const buttonH = height < 420 ? 36 : 38;
      const gapX = 12;
      const gapY = 10;
      const totalW = buttonW * 2 + gapX;
      const x = width * 0.5 - totalW / 2;
      const preferredY = frame ? frame.y + frame.h + 34 : height * 0.925;
      const topY = Math.min(Math.max(preferredY, 24), height - buttonH * 2 - gapY - 10);
      return {
        start: { x, y: topY, w: buttonW, h: buttonH },
        menu: { x: x + buttonW + gapX, y: topY, w: buttonW, h: buttonH },
        quit: { x, y: topY + buttonH + gapY, w: totalW, h: buttonH },
      };
    }

    const buttonW = Math.min(236, Math.max(206, width * 0.22));
    const buttonH = 60;
    const gap = Math.max(20, Math.min(30, width * 0.03));
    const totalW = buttonW * 3 + gap * 2;
    const x = width * 0.5 - totalW / 2;
    const preferredY = frame ? frame.y + frame.h + 36 : height * 0.88;
    const y = Math.min(Math.max(preferredY, 24), height - buttonH - 14);

    return {
      start: { x, y, w: buttonW, h: buttonH },
      menu: { x: x + buttonW + gap, y, w: buttonW, h: buttonH },
      quit: { x: x + (buttonW + gap) * 2, y, w: buttonW, h: buttonH },
    };
  }

  private getCardActions(
    width: number,
    height: number,
    frame: { x: number; y: number; w: number; h: number },
  ): {
    mint: ButtonRect;
    share: ButtonRect;
    download: ButtonRect;
  } {
    const compact = this.isCompactLayout(width, height);
    const buttonH = compact ? 32 : 36;
    const buttonW = compact
      ? Math.min(198, Math.max(142, frame.w * 0.27))
      : Math.min(206, Math.max(164, frame.w * 0.212));
    const gap = compact ? 8 : 12;
    const rowY = Math.max(12, frame.y - (compact ? 46 : 50));
    const totalW = buttonW * 3 + gap * 2;
    const startX = width * 0.5 - totalW / 2;
    return {
      mint: { x: startX, y: rowY, w: buttonW, h: buttonH },
      share: { x: startX + buttonW + gap, y: rowY, w: buttonW, h: buttonH },
      download: { x: startX + (buttonW + gap) * 2, y: rowY, w: buttonW, h: buttonH },
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
    const y = Math.min(Math.max(height * 0.60, 24), height - buttonH - 42);

    return {
      yes: { x, y, w: buttonW, h: buttonH },
      no: { x: x + buttonW + gap, y, w: buttonW, h: buttonH },
    };
  }

  private isCompactLayout(width: number, height: number): boolean {
    return width < 860 || height < 680;
  }

  private getAnimatedCardFrame(width: number, height: number): { x: number; y: number; w: number; h: number } {
    const base = measureRunCard(width, height);
    const t = performance.now() / 1000;
    const bobX = Math.sin(t * 0.6) * 1.2;
    const bobY = Math.sin(t * 1.2) * 2.4;
    const minX = 12;
    const maxX = Math.max(minX, width - base.w - 12);
    const topSpace = this.isCompactLayout(width, height) ? 110 : 120;
    const bottomSpace = this.isCompactLayout(width, height) ? 104 : 92;
    const minY = topSpace;
    const maxY = height - bottomSpace - base.h;
    const unclampedY = base.y + bobY;
    const y = maxY >= minY
      ? clamp(unclampedY, minY, maxY)
      : clamp(unclampedY, 12, Math.max(12, height - base.h - 12));
    return {
      x: Math.floor(clamp(base.x + bobX, minX, maxX)),
      y: Math.floor(y),
      w: base.w,
      h: base.h,
    };
  }

  private renderReactMintableCard(frame: { x: number; y: number; w: number; h: number }): void {
    if (this.summary === null) {
      this.destroyReactCard();
      return;
    }

    const host = this.ensureCardHost();
    host.style.left = `${frame.x}px`;
    host.style.top = `${frame.y}px`;
    host.style.width = `${frame.w}px`;
    host.style.height = `${frame.h}px`;
    host.style.aspectRatio = "3 / 2";
    host.style.maxWidth = "none";

    if (!this.cardRoot) {
      this.cardRoot = createRoot(host);
    }

    this.cardRoot.render(createElement(MintableCard, this.buildMintableCardProps()));
  }

  private markPressed(buttonId: string): void {
    this.pressedButton = buttonId;
    this.pressedUntilMs = performance.now() + 120;
  }

  private isPressed(buttonId: string): boolean {
    return this.pressedButton === buttonId && performance.now() <= this.pressedUntilMs;
  }

  private setWalletPanelVisible(visible: boolean): void {
    if (this.walletPanelHidden === !visible) {
      return;
    }
    const panel = document.getElementById("wallet-info-header");
    if (panel) {
      panel.style.visibility = visible ? "visible" : "hidden";
      panel.style.pointerEvents = visible ? "auto" : "none";
    }
    this.walletPanelHidden = !visible;
  }

  private ensureCardHost(): HTMLDivElement {
    if (this.cardHost && this.cardHost.isConnected) {
      return this.cardHost;
    }

    const existing = document.getElementById("mintable-card-react-host");
    if (existing instanceof HTMLDivElement) {
      this.cardHost = existing;
      return existing;
    }

    const host = document.createElement("div");
    host.id = "mintable-card-react-host";
    host.style.position = "fixed";
    host.style.zIndex = "8";
    host.style.pointerEvents = "none";
    host.style.left = "0px";
    host.style.top = "0px";
    host.style.transform = "translateZ(0)";
    host.style.willChange = "transform, left, top, width";
    document.body.appendChild(host);
    this.cardHost = host;
    return host;
  }

  private destroyReactCard(): void {
    if (this.cardRoot) {
      this.cardRoot.unmount();
      this.cardRoot = null;
    }
    if (this.cardHost && this.cardHost.isConnected) {
      this.cardHost.remove();
    }
    this.cardHost = null;
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(127, 224, 168, 0.07)";
    ctx.lineWidth = 1.5;

    const centerX = width * 0.5;
    const centerY = height * 0.38;
    for (const radius of [height * 0.14, height * 0.22, height * 0.31]) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(127, 224, 168, 0.035)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.min(width, height) * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private async shareRunCard(): Promise<void> {
    if (this.summary === null || this.shareBusy) {
      return;
    }

    this.shareBusy = true;
    try {
      const gameUrl = `${window.location.origin}/`;
      const text = buildXShareText(this.summary.score, gameUrl);
      const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to share run card:", error);
    } finally {
      this.shareBusy = false;
    }
  }

  private async downloadRunCard(): Promise<void> {
    if (this.summary === null) {
      return;
    }

    const { blob, filename } = await this.buildExportFile();
    await this.downloadBlob(blob, filename);
  }

  private async buildExportFile(): Promise<{ blob: Blob; file: File | null; filename: string }> {
    if (this.summary === null) {
      throw new Error("Run summary is unavailable.");
    }

    const host = document.createElement("div");
    host.id = "mintable-card-export-host";
    host.style.position = "fixed";
    host.style.left = "-20000px";
    host.style.top = "0px";
    host.style.width = `${EXPORT_CARD_WIDTH_PX}px`;
    host.style.height = `${EXPORT_CARD_HEIGHT_PX}px`;
    host.style.pointerEvents = "none";
    host.style.overflow = "hidden";
    host.style.zIndex = "-1";
    host.style.background = "transparent";
    host.style.contain = "layout paint style";

    const mount = document.createElement("div");
    mount.style.width = `${EXPORT_CARD_WIDTH_PX}px`;
    mount.style.display = "block";
    host.appendChild(mount);
    document.body.appendChild(host);

    const root = createRoot(mount);
    flushSync(() => {
      root.render(
        createElement(MintableCard, this.buildMintableCardProps({
          className: "h-full w-full",
          avatarUrl: this.getAvatarSourceForExport(),
          exportMode: true,
        })),
      );
    });

    try {
      await this.waitForExportReady(mount);
      const captureTarget = mount.firstElementChild instanceof HTMLElement ? mount.firstElementChild : mount;
      const captureWidth = Math.ceil(captureTarget.getBoundingClientRect().width || EXPORT_CARD_WIDTH_PX);
      const captureHeight = Math.ceil(captureTarget.getBoundingClientRect().height || EXPORT_CARD_HEIGHT_PX);
      const blob = await toBlob(captureTarget, {
        cacheBust: true,
        backgroundColor: "rgba(0,0,0,0)",
        pixelRatio: 1,
        width: captureWidth,
        height: captureHeight,
        canvasWidth: captureWidth,
        canvasHeight: captureHeight,
        skipAutoScale: true,
      });

      if (!blob) {
        throw new Error("Failed to export run card.");
      }

      const filename = buildRunCardExportName(this.summary.displayName, this.summary.score);
      const file = typeof File !== "undefined"
        ? new File([blob], filename, { type: "image/png" })
        : null;

      return { blob, file, filename };
    } finally {
      root.unmount();
      host.remove();
    }
  }

  private async downloadBlob(blob: Blob, filename: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  private loadAvatar(summary: RunCardSummary): void {
    const handle = summary.xHandle?.trim();
    if (!handle) {
      this.avatarDataUrl = null;
      return;
    }

    const src = `https://unavatar.io/x/${encodeURIComponent(handle)}`;
    const img = new Image();
    const serial = ++this.avatarLoadSerial;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (serial === this.avatarLoadSerial) {
        this.avatarDataUrl = this.tryBuildAvatarDataUrl(img);
      }
    };
    img.onerror = () => {
      if (serial === this.avatarLoadSerial) {
        this.avatarDataUrl = null;
      }
    };
    img.src = src;
  }

  private buildMintableCardProps(
    overrides: { className?: string; avatarUrl?: string; exportMode?: boolean } = {},
  ): Record<string, unknown> {
    if (this.summary === null) {
      return {};
    }

    const handle = this.summary.xHandle?.trim() ?? "";
    const displayHandle = handle
      ? (handle.startsWith("@") ? handle : `@${handle}`)
      : this.summary.displayName;

    return {
      twitterHandle: displayHandle,
      walletAddress: this.summary.walletAddress,
      tier: this.summary.rankTitle,
      finalScore: this.summary.score,
      kills: this.summary.kills,
      duration: formatRunDuration(this.summary.survivedMs),
      level: this.summary.level,
      rank: this.summary.rankTitle,
      score: this.summary.score,
      dateMinted: formatMintDateStamp(this.summary.capturedAt),
      timeUTC: formatMintTimeStamp(this.summary.capturedAt),
      avatarUrl:
        overrides.avatarUrl
        ?? this.getAvatarSourceForDisplay(),
      className: overrides.className,
      exportMode: overrides.exportMode ?? false,
    };
  }

  private getAvatarSourceForDisplay(): string {
    if (this.avatarDataUrl) {
      return this.avatarDataUrl;
    }
    return "";
  }

  private getAvatarSourceForExport(): string {
    if (this.avatarDataUrl) {
      return this.avatarDataUrl;
    }
    return "";
  }

  private tryBuildAvatarDataUrl(image: HTMLImageElement): string | null {
    try {
      const canvas = document.createElement("canvas");
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) {
        return null;
      }
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        return null;
      }
      context.drawImage(image, 0, 0);
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }

  private async waitForExportReady(host: HTMLElement): Promise<void> {
    if (typeof document.fonts?.ready?.then === "function") {
      try {
        await document.fonts.ready;
      } catch {
        // Ignore font loading failures and continue with capture.
      }
    }

    await this.waitForFrame();
    await this.waitForFrame();
    await this.waitForImages(host);
    await this.waitForFrame();
    await this.waitForPaintDelay();
  }

  private async waitForImages(host: HTMLElement): Promise<void> {
    const images = Array.from(host.querySelectorAll("img"));
    await Promise.all(
      images.map((image) => {
        if (image.complete && image.naturalWidth > 0) {
          return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }),
    );
  }

  private waitForFrame(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  private waitForPaintDelay(): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, 60);
    });
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

  private canMintCard(): boolean {
    return this.callbacks.isMintEnabled?.() ?? true;
  }

  private isMintBusy(): boolean {
    return this.callbacks.isMintBusy?.() ?? false;
  }

  private getMintDisabledReason(): string {
    return this.callbacks.getMintDisabledReason?.()
      ?? "Mint is currently unavailable due to invalid app configuration.";
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

function formatMintDateStamp(epochMs: number): string {
  const date = new Date(epochMs);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMintTimeStamp(epochMs: number): string {
  const date = new Date(epochMs);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes} UTC`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fitHeadlineFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  weight: string,
  family: string,
): number {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) {
      break;
    }
    size -= 1;
  }
  return size;
}
