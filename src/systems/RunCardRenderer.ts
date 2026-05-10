import { formatRunDuration } from "../utils/time";

export type RunCardMode = "screen" | "export";

export interface RunCardSkill {
  label: string;
  level: number;
  kind: "weapon" | "passive";
}

export interface RunCardEnemyKill {
  label: string;
  count: number;
}

export interface RunCardSummary {
  displayName: string;
  walletAddress: string;
  xHandle: string | null;
  serialNumber: string;
  capturedAt: number;
  rankTitle: string;
  score: number;
  kills: number;
  survivedMs: number;
  level: number;
  skills: RunCardSkill[];
  enemyKills: RunCardEnemyKill[];
}

export interface RunCardFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RunCardRenderOptions {
  mode?: RunCardMode;
}

interface RunCardTheme {
  id: string;
  primary: string;
  secondary: string;
  gold: string;
  blue: string;
  titleGlow: string;
  cardTop: string;
  cardMid: string;
  cardBottom: string;
  paperTint: string;
  sigilTint: string;
  badgeFill: string;
  badgeStroke: string;
  badgeLabel: string;
}

const RUN_CARD_THEMES: RunCardTheme[] = [
  {
    id: "gray",
    primary: "#b7bcc7",
    secondary: "#8b909a",
    gold: "#d6d9df",
    blue: "#a6acb7",
    titleGlow: "rgba(183,188,199,0.18)",
    cardTop: "rgba(21, 22, 26, 0.995)",
    cardMid: "rgba(12, 13, 16, 0.99)",
    cardBottom: "rgba(5, 5, 7, 0.998)",
    paperTint: "rgba(183,188,199,0.04)",
    sigilTint: "rgba(183,188,199,0.08)",
    badgeFill: "rgba(18, 19, 22, 0.96)",
    badgeStroke: "rgba(183,188,199,0.45)",
    badgeLabel: "INITIATE",
  },
  {
    id: "blue",
    primary: "#8eb2e4",
    secondary: "#687ea1",
    gold: "#d0dced",
    blue: "#7697d1",
    titleGlow: "rgba(142,178,228,0.18)",
    cardTop: "rgba(16, 24, 40, 0.995)",
    cardMid: "rgba(10, 14, 24, 0.99)",
    cardBottom: "rgba(4, 5, 9, 0.998)",
    paperTint: "rgba(142,178,228,0.04)",
    sigilTint: "rgba(142,178,228,0.08)",
    badgeFill: "rgba(12, 18, 30, 0.96)",
    badgeStroke: "rgba(142,178,228,0.45)",
    badgeLabel: "BITTY",
  },
  {
    id: "purple",
    primary: "#ad94db",
    secondary: "#7b659e",
    gold: "#ddd3ef",
    blue: "#8f83b2",
    titleGlow: "rgba(173,148,219,0.18)",
    cardTop: "rgba(24, 18, 42, 0.995)",
    cardMid: "rgba(13, 10, 24, 0.99)",
    cardBottom: "rgba(4, 4, 8, 0.998)",
    paperTint: "rgba(173,148,219,0.04)",
    sigilTint: "rgba(173,148,219,0.08)",
    badgeFill: "rgba(18, 14, 30, 0.96)",
    badgeStroke: "rgba(173,148,219,0.45)",
    badgeLabel: "RITTY",
  },
  {
    id: "green",
    primary: "#90c59a",
    secondary: "#67826d",
    gold: "#c8dccf",
    blue: "#88a591",
    titleGlow: "rgba(144,197,154,0.18)",
    cardTop: "rgba(16, 28, 20, 0.995)",
    cardMid: "rgba(9, 16, 12, 0.99)",
    cardBottom: "rgba(4, 6, 5, 0.998)",
    paperTint: "rgba(144,197,154,0.04)",
    sigilTint: "rgba(144,197,154,0.08)",
    badgeFill: "rgba(12, 20, 14, 0.96)",
    badgeStroke: "rgba(144,197,154,0.45)",
    badgeLabel: "RITUALIST",
  },
  {
    id: "indigo",
    primary: "#8b8fd6",
    secondary: "#676b9f",
    gold: "#dadbf5",
    blue: "#7a82c1",
    titleGlow: "rgba(139,143,214,0.18)",
    cardTop: "rgba(18, 18, 38, 0.995)",
    cardMid: "rgba(10, 10, 22, 0.99)",
    cardBottom: "rgba(4, 4, 8, 0.998)",
    paperTint: "rgba(139,143,214,0.04)",
    sigilTint: "rgba(139,143,214,0.08)",
    badgeFill: "rgba(12, 12, 24, 0.96)",
    badgeStroke: "rgba(139,143,214,0.45)",
    badgeLabel: "ZEALOT",
  },
  {
    id: "gold",
    primary: "#d7ba6a",
    secondary: "#a88c54",
    gold: "#f2e0ab",
    blue: "#c4b58a",
    titleGlow: "rgba(215,186,106,0.22)",
    cardTop: "rgba(40, 32, 12, 0.995)",
    cardMid: "rgba(22, 17, 8, 0.99)",
    cardBottom: "rgba(5, 4, 8, 0.998)",
    paperTint: "rgba(215,186,106,0.05)",
    sigilTint: "rgba(215,186,106,0.1)",
    badgeFill: "rgba(28, 22, 10, 0.96)",
    badgeStroke: "rgba(215,186,106,0.55)",
    badgeLabel: "RADIANT",
  },
];

const grainTileCache = new Map<string, HTMLCanvasElement>();
const RUN_CARD_ASPECT_RATIO = 3 / 2;
const SCREEN_CARD_BASE_WIDTH = 1050;
const SCREEN_CARD_BASE_HEIGHT = 700;
const RITUAL_WATERMARK_SRC = "/assets/ui/translucent.png";
const UI_FRAMES_SHEET_SRC = "/assets/ui/ui_frames_sheet.png";
let ritualWatermarkImage: HTMLImageElement | null = null;
let ritualWatermarkRequested = false;
let uiFramesSheetImage: HTMLImageElement | null = null;
let uiFramesSheetRequested = false;

export function buildXShareText(score: number, gameUrl: string): string {
  return [
    `What an awesome game made by @coffeedegen, I have scored ${score.toLocaleString()}. Can you beat it?`,
    `Play the game here: ${gameUrl}`,
    "@ritualnet | @ritualfnd",
  ].join("\n");
}

export function buildRunCardExportName(displayName: string, score: number): string {
  const cleaned = displayName.replace(/^@+/, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `ritualist-never-sleeps_${cleaned || "run"}_${score}.png`;
}

export function renderRunCard(
  ctx: CanvasRenderingContext2D,
  summary: RunCardSummary,
  width: number,
  height: number,
  avatarImage: CanvasImageSource | null = null,
  options: RunCardRenderOptions = {},
): void {
  const theme = pickRunCardTheme(summary);
  const exportMode = options.mode === "export";
  const frame = measureRunCard(width, height, exportMode ? "export" : "screen");
  const cardX = frame.x;
  const cardY = frame.y;
  const cardW = frame.w;
  const cardH = frame.h;
  const exportWideCard = exportMode && cardW / cardH >= 1.45;
  const compactCard = false;
  const innerPad = exportWideCard
    ? Math.max(26, Math.min(40, Math.floor(cardW * 0.024)))
    : compactCard
      ? Math.max(16, Math.floor(cardW * 0.024))
      : Math.max(24, Math.floor(cardW * 0.032));
  const accent = theme.primary;

  ctx.save();

  const shadow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    40,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.6,
  );
  shadow.addColorStop(0, "rgba(0,0,0,0.0)");
  shadow.addColorStop(1, "rgba(0,0,0,0.58)");
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, width, height);

  const cardFill = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardFill.addColorStop(0, theme.cardTop);
  cardFill.addColorStop(0.26, theme.cardMid);
  cardFill.addColorStop(0.68, "rgba(7, 8, 13, 0.995)");
  cardFill.addColorStop(1, theme.cardBottom);
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fillStyle = cardFill;
  ctx.fill();

  const brassBorder = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  brassBorder.addColorStop(0, "rgba(218, 182, 102, 0.62)");
  brassBorder.addColorStop(0.45, "rgba(127, 224, 168, 0.26)");
  brassBorder.addColorStop(1, "rgba(92, 61, 24, 0.72)");
  ctx.strokeStyle = brassBorder;
  ctx.lineWidth = 2.4;
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  roundRect(ctx, cardX + 6, cardY + 6, cardW - 12, cardH - 12, 22);
  ctx.stroke();

  drawPaperGrain(ctx, cardX, cardY, cardW, cardH, summary.serialNumber, theme, exportMode);
  drawCardWatermark(ctx, cardX, cardY, cardW, cardH, {
    opacity: exportMode ? 0.10 : 0.08,
    scale: exportMode ? 0.84 : 0.78,
    centerXRatio: 0.5,
    centerYRatio: 0.19,
  });

  ctx.save();
  ctx.globalAlpha = 0.12;
  drawRunSigil(ctx, cardX, cardY, cardW, cardH, theme);
  ctx.restore();

  drawRunicCorners(ctx, cardX, cardY, cardW, cardH, theme, accent);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const titleY = cardY + Math.floor(cardH * 0.12);
  const titleMaxW = cardW - innerPad * 2 - Math.floor(cardW * 0.06);
  const titleSize = fitTextWidth(
    ctx,
    "RITUALIST NEVER SLEEPS",
    titleMaxW,
    exportMode ? 50 : 46,
    exportMode ? 28 : 24,
    "900",
    "'Cinzel', 'Times New Roman', serif",
  );
  const titleFill = ctx.createLinearGradient(0, titleY - titleSize, 0, titleY + 10);
  titleFill.addColorStop(0, "rgba(252, 248, 228, 0.98)");
  titleFill.addColorStop(0.48, "rgba(220, 243, 223, 0.98)");
  titleFill.addColorStop(1, "rgba(208, 175, 98, 0.95)");
  ctx.fillStyle = titleFill;
  ctx.shadowColor = "rgba(68, 214, 145, 0.28)";
  ctx.shadowBlur = exportMode ? 18 : 14;
  ctx.font = `900 ${titleSize}px 'Cinzel', 'Times New Roman', serif`;
  ctx.fillText("RITUALIST NEVER SLEEPS", cardX + cardW * 0.5, titleY);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 240, 204, 0.18)";
  ctx.lineWidth = 1;
  ctx.strokeText("RITUALIST NEVER SLEEPS", cardX + cardW * 0.5, titleY);

  const titleRuleY = titleY + Math.max(14, Math.floor(titleSize * 0.34));
  const ruleGrad = ctx.createLinearGradient(cardX + cardW * 0.21, titleRuleY, cardX + cardW * 0.79, titleRuleY);
  ruleGrad.addColorStop(0, "rgba(218, 182, 102, 0)");
  ruleGrad.addColorStop(0.2, "rgba(218, 182, 102, 0.54)");
  ruleGrad.addColorStop(0.5, "rgba(127, 224, 168, 0.26)");
  ruleGrad.addColorStop(0.8, "rgba(218, 182, 102, 0.54)");
  ruleGrad.addColorStop(1, "rgba(218, 182, 102, 0)");
  ctx.strokeStyle = ruleGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + cardW * 0.21, titleRuleY);
  ctx.lineTo(cardX + cardW * 0.79, titleRuleY);
  ctx.stroke();

  const middleTop = cardY + Math.floor(cardH * 0.20);
  const leftColW = Math.floor(cardW * 0.36);
  const leftX = cardX + innerPad;
  const avatarSize = exportMode
    ? Math.max(208, Math.min(268, Math.floor(cardW * 0.185)))
    : Math.max(180, Math.min(238, Math.floor(cardW * 0.176)));
  const avatarX = leftX + Math.floor((leftColW - avatarSize) * 0.05);
  const avatarY = middleTop + 10;
  drawAvatar(
    ctx,
    avatarX,
    avatarY,
    avatarSize,
    summary.displayName,
    avatarImage,
    accent,
    theme,
  );
  drawWaxSealPlaceholder(ctx, avatarX + avatarSize * 0.72, avatarY + avatarSize * 0.80, avatarSize * 0.24, theme);

  const handle = summary.xHandle ? `@${summary.xHandle}` : summary.displayName;
  const walletShort = shortenWallet(summary.walletAddress);
  const tier = summary.rankTitle;
  const identityX = leftX + Math.floor(cardW * 0.005);
  const identityY = avatarY + avatarSize + Math.max(14, Math.floor(cardH * 0.016));
  const identityRowGap = Math.max(32, Math.floor(cardH * 0.05));
  const identityW = leftColW - Math.floor(cardW * 0.02);
  drawIdentityLine(
    ctx,
    null,
    handle,
    identityX,
    identityY,
    identityW,
    theme.primary,
    0,
    exportMode ? 18 : 16,
    0,
  );
  drawIdentityLine(
    ctx,
    null,
    walletShort,
    identityX,
    identityY + identityRowGap,
    identityW,
    "rgba(198, 209, 225, 0.9)",
    0,
    exportMode ? 12 : 11,
    0,
  );
  drawIdentityLine(
    ctx,
    null,
    tier,
    identityX,
    identityY + identityRowGap * 2,
    identityW,
    "#ffffff",
    0,
    exportMode ? 20 : 18,
    0,
  );

  const plaqueW = Math.max(Math.floor(cardW * 0.28), exportMode ? 420 : 340);
  const plaqueH = exportMode ? 160 : 138;
  const plaqueX = cardX + cardW - innerPad - plaqueW;
  const plaqueY = middleTop + Math.max(8, Math.floor(cardH * 0.014));
  drawStatsPlaque(ctx, plaqueX, plaqueY, plaqueW, plaqueH, summary, exportMode);

  const gridTop = cardY + Math.floor(cardH * 0.55);
  const gridBottom = cardY + Math.floor(cardH * 0.80);
  const gridH = Math.max(118, gridBottom - gridTop);
  const gridGapX = Math.max(14, Math.floor(cardW * 0.014));
  const gridGapY = Math.max(12, Math.floor(cardH * 0.016));
  const gridW = cardW - innerPad * 2;
  const cellW = Math.floor((gridW - gridGapX * 2) / 3);
  const cellH = Math.floor((gridH - gridGapY) / 2);
  const gridLabelsRow1 = [
    ["KILLS", `${summary.kills.toLocaleString()}`, `Enemies defeated`],
    ["DURATION", formatRunDuration(summary.survivedMs), `UTC survival`],
    ["LEVEL", `${summary.level}`, `Survivor level`],
  ] as const;
  const gridLabelsRow2 = [
    ["RANK", summary.rankTitle, `Current ritual rank`],
    ["SCORE", summary.score.toLocaleString(), `Final score`],
    ["TWITTER", handle, `Wallet ${walletShort}`],
  ] as const;
  for (let col = 0; col < 3; col += 1) {
    const x = cardX + innerPad + col * (cellW + gridGapX);
    drawCompactSummaryTile(
      ctx,
      x,
      gridTop,
      cellW,
      cellH,
      gridLabelsRow1[col]![0],
      gridLabelsRow1[col]![1],
      gridLabelsRow1[col]![2],
      "#5fdaf2",
      exportMode,
      undefined,
      false,
    );
    drawCompactSummaryTile(
      ctx,
      x,
      gridTop + cellH + gridGapY,
      cellW,
      cellH,
      gridLabelsRow2[col]![0],
      gridLabelsRow2[col]![1],
      gridLabelsRow2[col]![2],
      "#5fdaf2",
      exportMode,
      undefined,
      false,
    );
  }

  const footerCenterX = cardX + cardW * 0.5;
  const scriptY = cardY + cardH - Math.max(74, Math.floor(cardH * 0.08));
  const scriptPrefix = "Made by ";
  const scriptName = "coffeedegen";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `italic 700 ${exportMode ? 16 : 14}px 'Cormorant Garamond', 'Times New Roman', serif`;
  ctx.fillStyle = "rgba(235, 210, 148, 0.94)";
  const scriptPrefixW = ctx.measureText(scriptPrefix).width;
  ctx.font = `italic 800 ${exportMode ? 17 : 15}px 'Cormorant Garamond', 'Times New Roman', serif`;
  const scriptNameW = ctx.measureText(scriptName).width;
  const scriptStartX = footerCenterX - (scriptPrefixW + scriptNameW) / 2;
  ctx.fillText(scriptPrefix, scriptStartX + scriptPrefixW / 2, scriptY);
  ctx.fillStyle = "#45efd6";
  ctx.shadowColor = "rgba(69, 239, 214, 0.82)";
  ctx.shadowBlur = exportMode ? 16 : 10;
  ctx.fillText(scriptName, scriptStartX + scriptPrefixW + scriptNameW / 2, scriptY);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(210, 232, 226, 0.82)";
  ctx.font = `700 ${exportMode ? 12 : 10}px 'JetBrains Mono', monospace`;
  ctx.fillText("Official Run Card", footerCenterX, scriptY + (exportMode ? 18 : 16));

  const stripH = exportMode ? 34 : 30;
  const stripY = cardY + cardH - stripH - 12;
  const stripGrad = ctx.createLinearGradient(cardX, stripY, cardX, stripY + stripH);
  stripGrad.addColorStop(0, "rgba(184, 122, 57, 0.82)");
  stripGrad.addColorStop(0.5, "rgba(124, 79, 35, 0.92)");
  stripGrad.addColorStop(1, "rgba(68, 43, 19, 0.94)");
  ctx.fillStyle = stripGrad;
  roundRect(ctx, cardX + innerPad, stripY, cardW - innerPad * 2, stripH, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(241, 201, 147, 0.28)";
  ctx.lineWidth = 1;
  roundRect(ctx, cardX + innerPad, stripY, cardW - innerPad * 2, stripH, 10);
  ctx.stroke();
  drawSummaryFrameOverlay(
    ctx,
    cardX + innerPad + 2,
    stripY + 2,
    cardW - innerPad * 2 - 4,
    stripH - 4,
    8,
  );
  const serialDate = formatCardDateStamp(summary.capturedAt);
  const mintedStamp = formatCardMintedStamp(summary.capturedAt);
  const serialText = `SERIAL 001-${serialDate} • MINTED ${mintedStamp}`;
  ctx.fillStyle = "rgba(255, 246, 222, 0.94)";
  ctx.font = `700 ${exportMode ? 11 : 9}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(serialText, footerCenterX, stripY + Math.floor(stripH / 2) + 4);

  ctx.restore();
}

export function measureRunCard(width: number, height: number, mode: RunCardMode = "screen"): RunCardFrame {
  if (mode === "export") {
    const maxW = width * 0.94;
    const maxH = height * 0.92;
    let cardW = maxW;
    let cardH = cardW / RUN_CARD_ASPECT_RATIO;
    if (cardH > maxH) {
      cardH = maxH;
      cardW = cardH * RUN_CARD_ASPECT_RATIO;
    }
    return {
      x: Math.floor((width - cardW) / 2),
      y: Math.floor((height - cardH) / 2),
      w: Math.floor(cardW),
      h: Math.floor(cardH),
    };
  }

  const sidePad = clamp(width * 0.024, 12, 32);
  const topInset = clamp(height * 0.17, 108, 154);
  const bottomInset = clamp(height * 0.17, 110, 152);
  const maxW = width - sidePad * 2;
  const maxH = Math.max(220, height - topInset - bottomInset);
  let cardW = maxW;
  let cardH = cardW / RUN_CARD_ASPECT_RATIO;
  if (cardH > maxH) {
    cardH = maxH;
    cardW = cardH * RUN_CARD_ASPECT_RATIO;
  }

  const minScale = 0.58;
  const minW = SCREEN_CARD_BASE_WIDTH * minScale;
  const minH = SCREEN_CARD_BASE_HEIGHT * minScale;
  if (cardW < minW || cardH < minH) {
    const scale = clamp(
      Math.min(maxW / SCREEN_CARD_BASE_WIDTH, maxH / SCREEN_CARD_BASE_HEIGHT),
      minScale,
      1,
    );
    cardW = SCREEN_CARD_BASE_WIDTH * scale;
    cardH = SCREEN_CARD_BASE_HEIGHT * scale;
  }

  cardW = Math.floor(cardW);
  cardH = Math.floor(cardH);
  const minY = Math.floor(topInset);
  const maxY = Math.max(minY, Math.floor(height - bottomInset - cardH));
  const centeredY = Math.floor((height - cardH) / 2);
  return {
    x: Math.floor((width - cardW) / 2),
    y: clamp(centeredY, minY, maxY),
    w: cardW,
    h: cardH,
  };
}

function drawCompactSummaryTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  headline: string,
  subtitle: string,
  accent: string,
  wide = false,
  kicker?: string,
  minimal = false,
): void {
  const shortTile = h < 112;
  const ultraCompactTile = h < 74;
  const fill = ctx.createLinearGradient(x, y, x, y + h);
  fill.addColorStop(0, "rgba(255,255,255,0.06)");
  fill.addColorStop(1, "rgba(255,255,255,0.02)");
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, wide ? 14 : 12);
  ctx.fill();

  ctx.strokeStyle = withAlpha(accent, 0.28);
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, wide ? 14 : 12);
  ctx.stroke();

  const padX = wide ? 14 : 11;
  const headlineMaxW = w - padX * 2;

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = withAlpha(accent, 0.92);
  ctx.font = `700 ${shortTile ? 8 : (wide ? 10 : 9)}px 'JetBrains Mono', monospace`;
  ctx.fillText(label, x + padX, y + (shortTile ? 6 : (wide ? 9 : 8)));

  if (kicker && !shortTile && !minimal) {
    ctx.fillStyle = "rgba(219,228,255,0.6)";
    ctx.font = `600 ${wide ? 9 : 8}px 'JetBrains Mono', monospace`;
    ctx.fillText(clampTextTail(ctx, kicker, headlineMaxW, ctx.font), x + padX, y + (wide ? 24 : 22));
  }

  const headlineTop = shortTile
    ? (wide ? 22 : 18)
    : kicker
      ? (minimal ? (wide ? 30 : 26) : (wide ? 40 : 36))
      : (wide ? 30 : 26);
  const headlineSize = fitTextWidth(
    ctx,
    headline,
    headlineMaxW,
    shortTile ? (wide ? 22 : 18) : (wide ? 34 : 26),
    shortTile ? (wide ? 11 : 10) : (wide ? 16 : 13),
    "900",
    "'Space Grotesk', 'Segoe UI', sans-serif",
  );
  ctx.fillStyle = "#f9fbff";
  ctx.font = `900 ${headlineSize}px 'Space Grotesk', 'Segoe UI', sans-serif`;
  ctx.fillText(headline, x + padX, y + headlineTop);

  if (!minimal && !ultraCompactTile) {
    ctx.fillStyle = "rgba(219,228,255,0.7)";
    const subtitleSize = shortTile ? (wide ? 9 : 8) : (wide ? 10 : 9);
    ctx.font = `600 ${subtitleSize}px 'JetBrains Mono', monospace`;
    const safeSubtitle = clampTextTail(ctx, subtitle, headlineMaxW, ctx.font);
    ctx.fillText(safeSubtitle, x + padX, y + h - (shortTile ? (wide ? 12 : 10) : (wide ? 18 : 14)));
  }
}

function drawRunicCorners(
  ctx: CanvasRenderingContext2D,
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
  theme: RunCardTheme,
  accent: string,
): void {
  const corners: Array<[number, number, number, number, 1 | -1, 1 | -1]> = [
    [cardX + 18, cardY + 18, 32, 32, 1, 1],
    [cardX + cardW - 50, cardY + 18, 32, 32, -1, 1],
    [cardX + 18, cardY + cardH - 50, 32, 32, 1, -1],
    [cardX + cardW - 50, cardY + cardH - 50, 32, 32, -1, -1],
  ];

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [x, y, w, h, dx, dy] of corners) {
    const grad = ctx.createLinearGradient(x, y, x + w * dx, y + h * dy);
    grad.addColorStop(0, withAlpha(accent, 0.9));
    grad.addColorStop(1, withAlpha(theme.secondary, 0.12));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.15);
    ctx.lineTo(x, y);
    ctx.lineTo(x + w * 0.15, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w * 0.35, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h * 0.35);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w * 0.15, y + h * 0.75);
    ctx.lineTo(x + w * 0.45, y + h * 0.45);
    ctx.lineTo(x + w * 0.75, y + h * 0.75);
    ctx.stroke();

    ctx.save();
    ctx.shadowColor = withAlpha(theme.primary, 0.45);
    ctx.shadowBlur = 12;
    ctx.fillStyle = withAlpha(theme.primary, 0.12);
    ctx.beginPath();
    ctx.arc(x + w * 0.52, y + h * 0.52, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawWaxSealPlaceholder(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  theme: RunCardTheme,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = withAlpha(theme.primary, 0.5);
  ctx.shadowBlur = 14;
  const fill = ctx.createRadialGradient(
    centerX - radius * 0.2,
    centerY - radius * 0.2,
    radius * 0.15,
    centerX,
    centerY,
    radius,
  );
  fill.addColorStop(0, "rgba(255,255,255,0.16)");
  fill.addColorStop(0.45, withAlpha(theme.primary, 0.42));
  fill.addColorStop(1, "rgba(10, 12, 18, 0.92)");
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = withAlpha(theme.gold, 0.72);
  ctx.lineWidth = Math.max(1.1, radius * 0.08);
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = withAlpha(theme.primary, 0.88);
  ctx.lineWidth = Math.max(1, radius * 0.055);
  ctx.beginPath();
  ctx.moveTo(centerX - radius * 0.34, centerY);
  ctx.lineTo(centerX + radius * 0.34, centerY);
  ctx.moveTo(centerX, centerY - radius * 0.34);
  ctx.lineTo(centerX, centerY + radius * 0.34);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.arc(centerX - radius * 0.26, centerY - radius * 0.26, radius * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawIdentityLine(
  ctx: CanvasRenderingContext2D,
  label: string | null,
  value: string,
  x: number,
  y: number,
  w: number,
  accent: string,
  labelSize: number,
  valueSize: number,
  lineGap: number,
): void {
  const safeValue = clampTextTail(
    ctx,
    value,
    w,
    `800 ${valueSize}px 'Space Grotesk', 'Segoe UI', sans-serif`,
  );

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const valueY = label ? y + labelSize + lineGap : y;
  if (label) {
    ctx.fillStyle = withAlpha(accent, 0.86);
    ctx.font = `700 ${labelSize}px 'JetBrains Mono', monospace`;
    ctx.fillText(label, x, y);
  }
  ctx.fillStyle = "rgba(247, 249, 255, 0.98)";
  ctx.font = `800 ${valueSize}px 'Space Grotesk', 'Segoe UI', sans-serif`;
  ctx.fillText(safeValue, x, valueY);
  ctx.restore();
}

function drawStatsPlaque(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  summary: RunCardSummary,
  exportMode: boolean,
): void {
  ctx.save();
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, "rgba(255,255,255,0.09)");
  bg.addColorStop(0.62, "rgba(255,255,255,0.045)");
  bg.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, 24);
  ctx.fill();

  const brass = ctx.createLinearGradient(x, y, x + w, y + h);
  brass.addColorStop(0, "rgba(215, 178, 107, 0.46)");
  brass.addColorStop(0.5, "rgba(120, 226, 184, 0.18)");
  brass.addColorStop(1, "rgba(93, 68, 31, 0.54)");
  ctx.strokeStyle = brass;
  ctx.lineWidth = 1.3;
  roundRect(ctx, x, y, w, h, 24);
  ctx.stroke();

  const innerGlow = ctx.createLinearGradient(x, y, x + w, y + h);
  innerGlow.addColorStop(0, "rgba(255,255,255,0.08)");
  innerGlow.addColorStop(0.5, "rgba(127,224,168,0.03)");
  innerGlow.addColorStop(1, "rgba(0,0,0,0.1)");
  ctx.fillStyle = innerGlow;
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 22);
  ctx.fill();

  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(235, 222, 196, 0.74)";
  ctx.font = `700 ${exportMode ? 15 : 14}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "left";
  ctx.fillText("FINAL SCORE", x + 22, y + 18);

  const scoreSize = fitTextWidth(
    ctx,
    summary.score.toLocaleString(),
    w - 44,
    exportMode ? 60 : 52,
    exportMode ? 34 : 30,
    "900",
    "'Space Grotesk', 'Segoe UI', sans-serif",
  );
  ctx.fillStyle = "rgba(248, 250, 255, 0.98)";
  ctx.font = `900 ${scoreSize}px 'Space Grotesk', 'Segoe UI', sans-serif`;
  ctx.textAlign = "right";
  ctx.shadowColor = "rgba(118, 245, 186, 0.4)";
  ctx.shadowBlur = exportMode ? 16 : 12;
  ctx.fillStyle = "#7cf6bf";
  ctx.fillText(summary.score.toLocaleString(), x + w - 22, y + 54);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(235, 222, 196, 0.74)";
  ctx.font = `700 ${exportMode ? 13 : 12}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "left";
  ctx.fillText("KILLS", x + 22, y + h - 56);

  ctx.fillStyle = "#7cf6bf";
  ctx.font = `900 ${exportMode ? 24 : 22}px 'Space Grotesk', 'Segoe UI', sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(summary.kills.toLocaleString(), x + w - 22, y + h - 62);

  ctx.restore();
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  displayName: string,
  avatarImage: CanvasImageSource | null,
  accent: string,
  theme: RunCardTheme,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();

  const bg = ctx.createRadialGradient(
    x + size * 0.35,
    y + size * 0.3,
    6,
    x + size / 2,
    y + size / 2,
    size / 2,
  );
  bg.addColorStop(0, withAlpha(accent, 0.95));
  bg.addColorStop(1, "rgba(8, 10, 18, 1)");
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, size, size);

  if (avatarImage) {
    ctx.drawImage(avatarImage, x, y, size, size);
  } else {
    const initials = avatarInitials(displayName);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.arc(x + size * 0.55, y + size * 0.45, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `800 ${Math.floor(size * 0.34)}px 'Space Grotesk', 'Segoe UI', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, x + size / 2, y + size / 2 + 2);
  }

  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = withAlpha(accent, 0.7);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 - 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = withAlpha(accent, 0.42);
  ctx.shadowBlur = 24;
  ctx.strokeStyle = withAlpha(accent, 0.16);
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  const auraGlow = ctx.createRadialGradient(
    x + size / 2,
    y + size / 2,
    size * 0.18,
    x + size / 2,
    y + size / 2,
    size * 0.78,
  );
  auraGlow.addColorStop(0, withAlpha(theme.primary, 0.12));
  auraGlow.addColorStop(0.6, withAlpha(theme.primary, 0.04));
  auraGlow.addColorStop(1, withAlpha(theme.primary, 0));
  ctx.fillStyle = auraGlow;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size * 0.88, 0, Math.PI * 2);
  ctx.fill();
}

function drawRunSigil(
  ctx: CanvasRenderingContext2D,
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
  theme: RunCardTheme,
): void {
  const centerX = cardX + cardW * 0.57;
  const centerY = cardY + cardH * 0.615;
  const outer = Math.min(cardW, cardH) * 0.13;
  const inner = outer * 0.56;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Hero panel behind sigil.
  const panelW = outer * 2.6;
  const panelH = outer * 1.9;
  const panelX = centerX - panelW / 2;
  const panelY = centerY - panelH / 2;
  const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  panelGrad.addColorStop(0, "rgba(22, 30, 48, 0.22)");
  panelGrad.addColorStop(1, "rgba(8, 12, 22, 0.14)");
  ctx.fillStyle = panelGrad;
  roundRect(ctx, panelX, panelY, panelW, panelH, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(220,232,255,0.08)";
  ctx.lineWidth = 1;
  roundRect(ctx, panelX, panelY, panelW, panelH, 14);
  ctx.stroke();

  ctx.strokeStyle = theme.sigilTint;
  ctx.lineWidth = 1.05;

  ctx.beginPath();
  ctx.arc(centerX, centerY, outer, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = withAlpha(theme.secondary, 0.05);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, inner, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
    const startX = centerX + Math.cos(angle) * inner * 0.9;
    const startY = centerY + Math.sin(angle) * inner * 0.9;
    const endX = centerX + Math.cos(angle) * outer * 1.18;
    const endY = centerY + Math.sin(angle) * outer * 1.18;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  ctx.fillStyle = withAlpha(theme.primary, 0.022);
  ctx.beginPath();
  ctx.arc(centerX, centerY, inner * 0.36, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPaperGrain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  theme: RunCardTheme,
  exportMode: boolean,
): void {
  const key = `${theme.id}:${seed}:${exportMode ? "export" : "screen"}`;
  let tile = grainTileCache.get(key);
  if (!tile) {
    tile = document.createElement("canvas");
    tile.width = 128;
    tile.height = 128;
    const tileCtx = tile.getContext("2d");
    if (!tileCtx) {
      return;
    }

    const rng = createSeededRng(hashString(key));
    tileCtx.clearRect(0, 0, tile.width, tile.height);
    const density = exportMode ? 0.9 : 0.65;
    for (let idx = 0; idx < 900; idx += 1) {
      if (rng() > density) {
        continue;
      }
      const px = Math.floor(rng() * tile.width);
      const py = Math.floor(rng() * tile.height);
      const alpha = (exportMode ? 0.06 : 0.04) * (0.4 + rng() * 0.6);
      tileCtx.fillStyle = idx % 5 === 0 ? theme.primary : theme.sigilTint;
      tileCtx.globalAlpha = alpha;
      tileCtx.fillRect(px, py, 1, 1);
    }
    tileCtx.globalAlpha = 1;
    grainTileCache.set(key, tile);
  }

  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = exportMode ? 0.15 : 0.08;
  ctx.fillStyle = pattern;
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 26);
  ctx.fill();
  ctx.restore();
}

function drawCardWatermark(
  ctx: CanvasRenderingContext2D,
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
  options: {
    opacity?: number;
    scale?: number;
    centerXRatio?: number;
    centerYRatio?: number;
  } = {},
): void {
  const watermark = getCardWatermarkImage();
  if (!watermark) {
    return;
  }

  const {
    opacity = 0.06,
    scale = 0.8,
    centerXRatio = 0.5,
    centerYRatio = 0.5,
  } = options;
  const maxWidth = cardW * scale;
  const maxHeight = cardH * scale;
  const imageScale = Math.min(maxWidth / watermark.naturalWidth, maxHeight / watermark.naturalHeight);
  const drawW = watermark.naturalWidth * imageScale;
  const drawH = watermark.naturalHeight * imageScale;
  const drawX = cardX + cardW * centerXRatio - drawW / 2;
  const drawY = cardY + cardH * centerYRatio - drawH / 2 + cardH * 0.015;

  ctx.save();
  roundRect(ctx, cardX + 2, cardY + 2, cardW - 4, cardH - 4, 26);
  ctx.clip();
  ctx.globalAlpha = opacity;
  ctx.drawImage(watermark, drawX, drawY, drawW, drawH);
  ctx.restore();
}

function drawSummaryFrameOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const frameSheet = getUiFramesSheetImage();
  if (!frameSheet) {
    return;
  }

  // Atlas layout from manifest: 2 columns x 1 row, each frame 1024x256.
  // Use modal_panel_frame (second cell) for subtle summary container polish.
  const srcW = 1024;
  const srcH = 256;
  const srcX = 1024;
  const srcY = 0;

  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.globalAlpha = 0.16;
  ctx.globalCompositeOperation = "screen";
  ctx.drawImage(frameSheet, srcX, srcY, srcW, srcH, x, y, w, h);
  ctx.restore();
}

function getCardWatermarkImage(): HTMLImageElement | null {
  if (typeof Image === "undefined") {
    return null;
  }
  if (!ritualWatermarkRequested) {
    ritualWatermarkRequested = true;
    const img = new Image();
    img.src = RITUAL_WATERMARK_SRC;
    ritualWatermarkImage = img;
  }
  if (!ritualWatermarkImage || !ritualWatermarkImage.complete || ritualWatermarkImage.naturalWidth <= 0) {
    return null;
  }
  return ritualWatermarkImage;
}

function getUiFramesSheetImage(): HTMLImageElement | null {
  if (typeof Image === "undefined") {
    return null;
  }
  if (!uiFramesSheetRequested) {
    uiFramesSheetRequested = true;
    const img = new Image();
    img.src = UI_FRAMES_SHEET_SRC;
    uiFramesSheetImage = img;
  }
  if (!uiFramesSheetImage || !uiFramesSheetImage.complete || uiFramesSheetImage.naturalWidth <= 0) {
    return null;
  }
  return uiFramesSheetImage;
}

function pickRunCardTheme(summary: RunCardSummary): RunCardTheme {
  const rank = summary.rankTitle.toLowerCase();
  if (rank.includes("radiant")) return RUN_CARD_THEMES[5] ?? RUN_CARD_THEMES[0]!;
  if (rank.includes("zealot")) return RUN_CARD_THEMES[4] ?? RUN_CARD_THEMES[0]!;
  if (rank.includes("ritualist")) return RUN_CARD_THEMES[3] ?? RUN_CARD_THEMES[0]!;
  if (rank.includes("ritty")) return RUN_CARD_THEMES[2] ?? RUN_CARD_THEMES[0]!;
  if (rank.includes("bitty")) return RUN_CARD_THEMES[1] ?? RUN_CARD_THEMES[0]!;
  return RUN_CARD_THEMES[0] ?? RUN_CARD_THEMES[0]!;
}

function formatCardDateStamp(epochMs: number): string {
  const date = new Date(epochMs);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  return `${day}-${month}-${year}`;
}

function formatCardMintedStamp(epochMs: number): string {
  const date = new Date(epochMs);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seed: number): () => number {
  let state = seed || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function avatarInitials(displayName: string): string {
  const cleaned = displayName.replace(/^@+/, "").trim();
  if (!cleaned) {
    return "R";
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? "R"}${parts[1]![0] ?? ""}`.toUpperCase();
  }

  return (parts[0] ?? cleaned).slice(0, 2).toUpperCase();
}

function shortenWallet(wallet: string): string {
  if (wallet.length <= 12) {
    return wallet;
  }

  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function roundRect(
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

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return hex;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fitTextWidth(
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

function clampTextTail(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  const ellipsis = "...";
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}${ellipsis}`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}${ellipsis}`;
}
