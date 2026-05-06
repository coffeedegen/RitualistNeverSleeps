import {
  buildRunCardExportName,
  buildXShareText,
  measureRunCard,
  renderRunCard,
  type RunCardSummary,
} from "./RunCardRenderer";

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
      const cardButtons = this.getCardActions(width, height);
      if (this.summary !== null && this.hitTest(mouseX, mouseY, cardButtons.mint)) {
        event.preventDefault();
        this.markPressed("card-mint");
        this.callbacks.onMintCard(this.summary);
        return;
      }

      if (this.summary !== null && this.hitTest(mouseX, mouseY, cardButtons.share)) {
        event.preventDefault();
        this.markPressed("card-share");
        void this.shareRunCard();
        return;
      }

      if (this.summary !== null && this.hitTest(mouseX, mouseY, cardButtons.download)) {
        event.preventDefault();
        this.markPressed("card-download");
        void this.downloadRunCard();
        return;
      }

      const buttons = this.getMainButtons(width, height);
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

  private avatarImage: HTMLImageElement | null = null;

  private avatarLoadSerial = 0;

  constructor(private readonly callbacks: GameOverUICallbacks) {
    window.addEventListener("mousedown", this.clickListener, true);
  }

  dispose(): void {
    window.removeEventListener("mousedown", this.clickListener, true);
    this.overlayMode = "hidden";
    this.actionLocked = false;
    this.shareBusy = false;
    this.summary = null;
    this.avatarImage = null;
    this.pressedButton = null;
    this.pressedUntilMs = 0;
  }

  present(summary: RunCardSummary): void {
    this.summary = summary;
    this.overlayMode = "gameOver";
    this.actionLocked = false;
    this.shareBusy = false;
    this.pressedButton = null;
    this.pressedUntilMs = 0;
    this.loadAvatar(summary);
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
    backdrop.addColorStop(0, "rgba(34, 18, 28, 0.92)");
    backdrop.addColorStop(0.45, "rgba(8, 11, 22, 0.94)");
    backdrop.addColorStop(1, "rgba(2, 3, 7, 0.98)");
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    this.drawBackdrop(ctx, width, height);
    this.drawTitle(ctx, width, height);

    if (this.overlayMode === "confirmQuit") {
      this.drawQuitConfirmation(ctx, width, height);
    } else {
      if (this.summary !== null) {
        const frame = measureRunCard(width, height);
        renderRunCard(ctx, this.summary, width, height, this.avatarImage, { mode: "screen" });
        this.drawCardActions(ctx, frame, width, height);
      }
      this.drawMainButtons(ctx, width, height);
    }

    ctx.restore();
  }

  private drawTitle(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const compact = this.isCompactLayout(width, height);
    ctx.fillStyle = "#ff6b7a";
    ctx.font = `900 ${compact ? 46 : 68}px 'Cinzel', 'Times New Roman', serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("THE RITUAL ARCHIVE", width * 0.5, height * (compact ? 0.17 : 0.16));

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `600 ${compact ? 10 : 12}px 'JetBrains Mono', monospace`;
    ctx.fillText("MINT-READY RUN CARD", width * 0.5, height * (compact ? 0.23 : 0.21));
  }

  private drawMainButtons(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const compact = this.isCompactLayout(width, height);
    const layout = this.getMainButtons(width, height);
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
    const buttonH = compact ? 34 : 38;
    const buttonW = compact ? Math.min(230, frame.w * 0.34) : 200;
    const gap = compact ? 12 : 16;
    const rowY = frame.y - (compact ? 50 : 56);
    const totalW = buttonW * 3 + gap * 2;
    const startX = width * 0.5 - totalW / 2;
    const mint = { x: startX, y: rowY, w: buttonW, h: buttonH };
    const share = { x: mint.x + buttonW + gap, y: rowY, w: buttonW, h: buttonH };
    const download = { x: share.x + buttonW + gap, y: rowY, w: buttonW, h: buttonH };

    this.drawButton(ctx, mint, "Mint this Card", "#41d37c", compact ? 13 : 14, true, this.isPressed("card-mint"));
    this.drawButton(ctx, share, "Share to X", "#41d37c", compact ? 13 : 14, true, this.isPressed("card-share"));
    this.drawButton(ctx, download, "Download Card", "#41d37c", compact ? 13 : 14, true, this.isPressed("card-download"));
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
  ): void {
    const pressOffset = pressed ? 2 : 0;
    const drawX = rect.x;
    const drawY = rect.y + pressOffset;
    const drawH = Math.max(10, rect.h - pressOffset);

    const fillGradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    fillGradient.addColorStop(0, pressed ? "rgba(18, 26, 20, 0.98)" : "rgba(22, 28, 46, 0.98)");
    fillGradient.addColorStop(1, pressed ? "rgba(5, 14, 9, 0.98)" : "rgba(7, 9, 15, 0.98)");
    ctx.fillStyle = fillGradient;
    this.roundPane(ctx, drawX, drawY, rect.w, drawH, 8);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = pressed ? 2 : (highlight ? 4 : 3);
    this.roundPane(ctx, drawX, drawY, rect.w, drawH, 8);
    ctx.stroke();

    ctx.fillStyle = this.withAlpha(accent, pressed ? 0.26 : 0.14);
    this.roundPane(ctx, drawX + 4, drawY + 4, rect.w - 8, drawH - 8, 6);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${fontSize}px 'Space Grotesk', ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, drawX + rect.w / 2, drawY + drawH / 2 + (pressed ? 0.5 : 0));
  }

  private getMainButtons(width: number, height: number): {
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
      const topY = Math.min(Math.max(height * 0.925, 24), height - buttonH * 2 - gapY - 10);
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
    const y = Math.min(Math.max(height * 0.88, 24), height - buttonH - 14);

    return {
      start: { x, y, w: buttonW, h: buttonH },
      menu: { x: x + buttonW + gap, y, w: buttonW, h: buttonH },
      quit: { x: x + (buttonW + gap) * 2, y, w: buttonW, h: buttonH },
    };
  }

  private getCardActions(width: number, height: number): {
    mint: ButtonRect;
    share: ButtonRect;
    download: ButtonRect;
  } {
    const compact = this.isCompactLayout(width, height);
    const frame = measureRunCard(width, height);
    const buttonH = compact ? 34 : 38;
    const buttonW = compact ? Math.min(230, frame.w * 0.34) : 200;
    const gap = compact ? 12 : 16;
    const rowY = frame.y - (compact ? 50 : 56);
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

  private markPressed(buttonId: string): void {
    this.pressedButton = buttonId;
    this.pressedUntilMs = performance.now() + 120;
  }

  private isPressed(buttonId: string): boolean {
    return this.pressedButton === buttonId && performance.now() <= this.pressedUntilMs;
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
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

  private async shareRunCard(): Promise<void> {
    if (this.summary === null || this.shareBusy) {
      return;
    }

    this.shareBusy = true;
    try {
      const { blob, file } = await this.buildExportFile();
      const text = buildXShareText(this.summary.score);
      const url = URL.createObjectURL(blob);
      const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      const shareWindow = window.open(url, "_blank", "noopener,noreferrer");
      if (shareWindow) {
        setTimeout(() => {
          window.open(shareUrl, "_blank", "noopener,noreferrer");
        }, 150);
        return;
      }

      if (navigator.share && file !== null) {
        const canShareFiles = typeof navigator.canShare === "function"
          ? navigator.canShare({ files: [file] })
          : true;
        if (canShareFiles) {
          await navigator.share({
            text,
            title: "Ritualist Never Sleeps",
            files: [file],
          });
          return;
        }
      }

      await navigator.clipboard.writeText(text);
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to share run card:", error);
      void this.downloadRunCard();
    } finally {
      this.shareBusy = false;
    }
  }

  private async downloadRunCard(): Promise<void> {
    if (this.summary === null) {
      return;
    }

    const { blob } = await this.buildExportFile();
    await this.downloadBlob(blob, buildRunCardExportName(this.summary.displayName, this.summary.score));
  }

  private async buildExportFile(): Promise<{ blob: Blob; file: File | null }> {
    if (this.summary === null) {
      throw new Error("Run summary is unavailable.");
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 1600;
    exportCanvas.height = 2000;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) {
      throw new Error("Canvas export context unavailable.");
    }

    renderRunCard(
      exportCtx,
      this.summary,
      exportCanvas.width,
      exportCanvas.height,
      this.avatarImage,
      { mode: "export" },
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      exportCanvas.toBlob((value) => {
        if (value) {
          resolve(value);
        } else {
          reject(new Error("Failed to export run card."));
        }
      }, "image/png");
    });

    const file = typeof File !== "undefined"
      ? new File(
          [blob],
          buildRunCardExportName(this.summary.displayName, this.summary.score),
          { type: "image/png" },
        )
      : null;

    return { blob, file };
  }

  private async downloadBlob(blob: Blob, filename: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private loadAvatar(summary: RunCardSummary): void {
    const handle = summary.xHandle?.trim();
    if (!handle) {
      this.avatarImage = null;
      return;
    }

    const src = `https://unavatar.io/x/${encodeURIComponent(handle)}`;
    const img = new Image();
    const serial = ++this.avatarLoadSerial;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (serial === this.avatarLoadSerial) {
        this.avatarImage = img;
      }
    };
    img.onerror = () => {
      if (serial === this.avatarLoadSerial) {
        this.avatarImage = null;
      }
    };
    img.src = src;
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
