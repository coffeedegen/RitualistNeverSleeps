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
const SCREEN_CARD_BASE_WIDTH = 1040;
const SCREEN_CARD_BASE_HEIGHT = 700;
const RUN_CARD_MAX_SKILLS = 3;
const RUN_CARD_MAX_ENEMIES = 3;
const RITUAL_WATERMARK_SRC = "/assets/ui/translucent.png";
let ritualWatermarkImage: HTMLImageElement | null = null;
let ritualWatermarkRequested = false;

export function buildXShareText(score: number): string {
  return [
    `I just played Ritualist Never Sleeps and dropped this high score ${score.toLocaleString()}.`,
    "",
    "You think you can beat it?",
    "Let's see who's really locked in!",
    "gRitual!",
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
  const compactCard = false;
  const innerPad = compactCard
    ? Math.max(16, Math.floor(cardW * 0.024))
    : Math.max(24, Math.floor(cardW * 0.032));
  const accent = theme.primary;
  const warm = theme.secondary;
  const gold = theme.gold;
  const blue = theme.blue;

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
  shadow.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, width, height);

  const cardFill = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardFill.addColorStop(0, theme.cardTop);
  cardFill.addColorStop(0.33, theme.cardMid);
  cardFill.addColorStop(0.72, "rgba(6, 7, 13, 0.995)");
  cardFill.addColorStop(1, theme.cardBottom);

  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fillStyle = cardFill;
  ctx.fill();

  ctx.strokeStyle = "rgba(127,224,168,0.26)";
  ctx.lineWidth = 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.stroke();

  // Collectible-frame corner accents.
  const cornerLen = Math.max(18, Math.floor(cardW * 0.028));
  ctx.strokeStyle = withAlpha(accent, 0.62);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 16, cardY + 16);
  ctx.lineTo(cardX + 16 + cornerLen, cardY + 16);
  ctx.moveTo(cardX + 16, cardY + 16);
  ctx.lineTo(cardX + 16, cardY + 16 + cornerLen);
  ctx.moveTo(cardX + cardW - 16, cardY + 16);
  ctx.lineTo(cardX + cardW - 16 - cornerLen, cardY + 16);
  ctx.moveTo(cardX + cardW - 16, cardY + 16);
  ctx.lineTo(cardX + cardW - 16, cardY + 16 + cornerLen);
  ctx.moveTo(cardX + 16, cardY + cardH - 16);
  ctx.lineTo(cardX + 16 + cornerLen, cardY + cardH - 16);
  ctx.moveTo(cardX + 16, cardY + cardH - 16);
  ctx.lineTo(cardX + 16, cardY + cardH - 16 - cornerLen);
  ctx.moveTo(cardX + cardW - 16, cardY + cardH - 16);
  ctx.lineTo(cardX + cardW - 16 - cornerLen, cardY + cardH - 16);
  ctx.moveTo(cardX + cardW - 16, cardY + cardH - 16);
  ctx.lineTo(cardX + cardW - 16, cardY + cardH - 16 - cornerLen);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  roundRect(ctx, cardX + 6, cardY + 6, cardW - 12, cardH - 12, 22);
  ctx.stroke();

  const topWash = ctx.createLinearGradient(cardX, cardY, cardX, cardY + 180);
  topWash.addColorStop(0, withAlpha(accent, 0.14));
  topWash.addColorStop(0.48, withAlpha(accent, 0.06));
  topWash.addColorStop(1, withAlpha(accent, 0));
  ctx.fillStyle = topWash;
  roundRect(ctx, cardX + 1, cardY + 1, cardW - 2, 180, 28);
  ctx.fill();

  if (exportMode) {
    // Metallic top trim reserved for exported card art.
    const trimW = Math.min(cardW * 0.42, 380);
    const trimH = 22;
    const trimX = cardX + (cardW - trimW) / 2;
    const trimY = cardY + 10;
    const trimGrad = ctx.createLinearGradient(trimX, trimY, trimX + trimW, trimY + trimH);
    trimGrad.addColorStop(0, "rgba(220,230,255,0.55)");
    trimGrad.addColorStop(0.5, withAlpha(accent, 0.5));
    trimGrad.addColorStop(1, "rgba(220,230,255,0.55)");
    ctx.fillStyle = trimGrad;
    roundRect(ctx, trimX, trimY, trimW, trimH, 8);
    ctx.fill();
  }

  const cornerBloom = ctx.createRadialGradient(
    cardX + cardW * 0.12,
    cardY + cardH * 0.12,
    8,
    cardX + cardW * 0.12,
    cardY + cardH * 0.12,
    cardW * 0.42,
  );
  cornerBloom.addColorStop(0, theme.paperTint);
  cornerBloom.addColorStop(0.38, withAlpha(accent, 0.04));
  cornerBloom.addColorStop(1, withAlpha(accent, 0));
  ctx.fillStyle = cornerBloom;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  const deepShadow = ctx.createRadialGradient(
    cardX + cardW * 0.74,
    cardY + cardH * 0.76,
    40,
    cardX + cardW * 0.74,
    cardY + cardH * 0.76,
    cardW * 0.64,
  );
  deepShadow.addColorStop(0, withAlpha(warm, 0.05));
  deepShadow.addColorStop(0.6, withAlpha(warm, 0.02));
  deepShadow.addColorStop(1, "rgba(255,107,122,0)");
  ctx.fillStyle = deepShadow;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  drawPaperGrain(ctx, cardX, cardY, cardW, cardH, summary.serialNumber, theme, exportMode);
  drawCardWatermark(ctx, cardX, cardY, cardW, cardH);

  // Header
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowBlur = 0;
  if (exportMode) {
    ctx.fillStyle = "rgba(230,239,255,0.95)";
    ctx.font = `900 ${compactCard ? 11 : 14}px 'Space Grotesk', 'Segoe UI', sans-serif`;
    ctx.fillText("MINTABLE CARD", cardX + cardW * 0.5, cardY + innerPad - (compactCard ? 7 : 10));
    ctx.fillStyle = withAlpha(gold, 0.88);
    ctx.font = `800 ${compactCard ? 9 : 11}px 'JetBrains Mono', monospace`;
    ctx.fillText("LEGENDARY ACHIEVEMENT", cardX + cardW * 0.5, cardY + innerPad + (compactCard ? 5 : 6));
  }

  const titleY = cardY + innerPad + (exportMode ? (compactCard ? 22 : 30) : (compactCard ? 20 : 22));
  const cardTitleFill = ctx.createLinearGradient(0, titleY - 22, 0, titleY + 10);
  cardTitleFill.addColorStop(0, "rgba(246,252,255,0.96)");
  cardTitleFill.addColorStop(0.58, "rgba(228,244,255,0.92)");
  cardTitleFill.addColorStop(1, "rgba(194,230,215,0.9)");
  ctx.fillStyle = cardTitleFill;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(65, 211, 124, 0.42)";
  ctx.shadowBlur = exportMode ? 16 : (compactCard ? 9 : 12);
  fitCenteredTitle(
    ctx,
    "RITUALIST NEVER SLEEPS",
    cardX + cardW * 0.5,
    titleY,
    cardW - innerPad * 2 - 20,
    compactCard ? Math.max(24, Math.min(34, Math.floor(cardW * 0.035))) : Math.max(30, Math.min(44, Math.floor(cardW * 0.0415))),
    compactCard ? 18 : 21,
  );
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(246,252,255,0.26)";
  ctx.strokeText("RITUALIST NEVER SLEEPS", cardX + cardW * 0.5, titleY);
  ctx.shadowBlur = 0;

  const titleRuleY = titleY + (compactCard ? 14 : 16);
  ctx.strokeStyle = withAlpha(accent, 0.22);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + cardW * 0.2, titleRuleY);
  ctx.lineTo(cardX + cardW * 0.8, titleRuleY);
  ctx.stroke();

  const avatarSize = compactCard
    ? Math.max(116, Math.min(158, Math.floor(cardW * 0.16)))
    : Math.max(156, Math.min(205, Math.floor(cardW * 0.184)));
  const avatarX = cardX + innerPad;
  const avatarY = titleRuleY + (compactCard ? 10 : 16);
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

  const scoreBlockW = compactCard ? Math.min(250, Math.floor(cardW * 0.31)) : Math.min(308, Math.floor(cardW * 0.31));
  const scoreBlockH = compactCard ? 104 : 126;
  const scoreBlockX = cardX + cardW - innerPad - scoreBlockW;
  const scoreBlockY = avatarY + (compactCard ? 6 : 8);
  const scoreFill = ctx.createLinearGradient(scoreBlockX, scoreBlockY, scoreBlockX, scoreBlockY + scoreBlockH);
  scoreFill.addColorStop(0, withAlpha(accent, 0.20));
  scoreFill.addColorStop(1, "rgba(11, 16, 20, 0.92)");
  ctx.fillStyle = scoreFill;
  roundRect(ctx, scoreBlockX, scoreBlockY, scoreBlockW, scoreBlockH, compactCard ? 16 : 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(127,224,168,0.28)";
  ctx.lineWidth = 1;
  roundRect(ctx, scoreBlockX, scoreBlockY, scoreBlockW, scoreBlockH, compactCard ? 16 : 20);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  roundRect(ctx, scoreBlockX + 1, scoreBlockY + 1, scoreBlockW - 2, scoreBlockH - 2, compactCard ? 15 : 19);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.stroke();

  const scorePad = compactCard ? 12 : 16;
  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.font = `700 ${compactCard ? 9 : 10}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "left";
  ctx.fillText("FINAL SCORE", scoreBlockX + scorePad, scoreBlockY + (compactCard ? 19 : 24));

  const scoreText = summary.score.toLocaleString();
  const scoreFontSize = fitTextWidth(
    ctx,
    scoreText,
    scoreBlockW - scorePad * 2,
    compactCard ? 26 : 32,
    compactCard ? 15 : 18,
    "900",
    "'Space Grotesk', 'Segoe UI', sans-serif",
  );
  ctx.fillStyle = "#f9fbff";
  ctx.font = `900 ${scoreFontSize}px 'Space Grotesk', 'Segoe UI', sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(scoreText, scoreBlockX + scoreBlockW - scorePad, scoreBlockY + (compactCard ? 49 : 60));

  const killsValue = summary.kills.toLocaleString();
  const killsY = scoreBlockY + (compactCard ? 84 : 92);
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.font = `700 ${compactCard ? 9 : 10}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "left";
  ctx.fillText("KILLS", scoreBlockX + scorePad, killsY);
  ctx.fillStyle = withAlpha(accent, 0.95);
  ctx.font = `800 ${compactCard ? 13 : 15}px 'Space Grotesk', 'Segoe UI', sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(killsValue, scoreBlockX + scoreBlockW - scorePad, killsY);

  const identityX = avatarX + avatarSize + (compactCard ? 18 : 28);
  const identityMaxW = Math.max(120, scoreBlockX - identityX - (compactCard ? 14 : 18));
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(247,242,222,0.96)";
  const nameFont = compactCard ? "800 19px 'Space Grotesk', 'Segoe UI', sans-serif" : "800 25px 'Space Grotesk', 'Segoe UI', sans-serif";
  ctx.font = nameFont;
  const safeDisplayName = clampTextTail(ctx, summary.displayName, identityMaxW, nameFont);
  ctx.fillText(safeDisplayName, identityX, avatarY + (compactCard ? 27 : 34));

  ctx.fillStyle = "rgba(219,228,255,0.66)";
  const handleFont = compactCard ? "600 10px 'JetBrains Mono', monospace" : "600 12px 'JetBrains Mono', monospace";
  ctx.font = handleFont;
  const handleLine = summary.xHandle ? `@${summary.xHandle}` : "No X handle linked";
  ctx.fillText(clampTextTail(ctx, handleLine, identityMaxW, handleFont), identityX, avatarY + (compactCard ? 45 : 56));

  ctx.fillStyle = "rgba(219,228,255,0.58)";
  const walletFont = compactCard ? "500 9px 'JetBrains Mono', monospace" : "500 11px 'JetBrains Mono', monospace";
  ctx.font = walletFont;
  ctx.fillText(clampTextTail(ctx, shortenWallet(summary.walletAddress), identityMaxW, walletFont), identityX, avatarY + (compactCard ? 61 : 76));

  ctx.fillStyle = "#ffffff";
  const rankFont = compactCard ? "900 18px 'Space Grotesk', 'Segoe UI', sans-serif" : "900 22px 'Space Grotesk', 'Segoe UI', sans-serif";
  ctx.font = rankFont;
  ctx.fillText(clampTextTail(ctx, summary.rankTitle, identityMaxW, rankFont), identityX, avatarY + (compactCard ? 84 : 106));

  const headerRuleY = Math.max(avatarY + avatarSize, scoreBlockY + scoreBlockH) + (compactCard ? 8 : 10);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + innerPad, headerRuleY);
  ctx.lineTo(cardX + cardW - innerPad, headerRuleY);
  ctx.stroke();

  const statsY = headerRuleY + (compactCard ? 12 : 18);
  const statGap = compactCard ? 8 : 12;
  const pillWidth = Math.floor((cardW - innerPad * 2 - statGap * 2) / 3);
  drawStatPill(ctx, cardX + innerPad, statsY, pillWidth, "☠ KILLS", `${summary.kills}`, accent, compactCard);
  drawStatPill(
    ctx,
    cardX + innerPad + pillWidth + statGap,
    statsY,
    pillWidth,
    "◷ TIME",
    formatRunDuration(summary.survivedMs),
    blue,
    compactCard,
  );
  drawStatPill(
    ctx,
    cardX + innerPad + (pillWidth + statGap) * 2,
    statsY,
    pillWidth,
    "✦ LEVEL",
    `${summary.level}`,
    gold,
    compactCard,
  );

  const statPillH = compactCard ? 42 : 48;
  const contentBandY = statsY + statPillH + (compactCard ? 8 : 10);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + innerPad, contentBandY - (compactCard ? 8 : 12));
  ctx.lineTo(cardX + cardW - innerPad, contentBandY - (compactCard ? 8 : 12));
  ctx.stroke();

  const footerY = cardY + cardH - (compactCard ? 30 : 48);
  const serialY = footerY - (compactCard ? 20 : 28);
  const metaChipH = compactCard ? 34 : 44;
  const metaBandY = serialY - metaChipH - (compactCard ? 12 : 18);

  const contentTop = contentBandY + (compactCard ? 8 : 10);
  const contentBottom = metaBandY - (compactCard ? 14 : 18);
  const contentHeight = Math.max(compactCard ? 84 : 118, contentBottom - contentTop);
  const leftColW = Math.floor((cardW - innerPad * 2 - (compactCard ? 12 : 18)) * 0.56);
  const rightColW = cardW - innerPad * 2 - (compactCard ? 12 : 18) - leftColW;
  const leftX = cardX + innerPad;
  const rightX = leftX + leftColW + (compactCard ? 12 : 18);

  drawSectionLabel(ctx, leftX, contentTop, "SKILLS", accent, compactCard);
  drawSectionLabel(ctx, rightX, contentTop, "ENEMY BREAKDOWN", warm, compactCard);

  const dividerX = leftX + leftColW + (compactCard ? 6 : 9);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(dividerX, contentTop + 4);
  ctx.lineTo(dividerX, contentTop + contentHeight - 8);
  ctx.stroke();

  const skillStartY = contentTop + (compactCard ? 18 : 24);
  drawSkillGrid(ctx, summary.skills, leftX, skillStartY, leftColW, contentHeight - (compactCard ? 18 : 24), compactCard);
  drawEnemyBreakdown(
    ctx,
    summary.enemyKills,
    rightX,
    skillStartY,
    rightColW,
    contentHeight - (compactCard ? 18 : 24),
    warm,
    compactCard,
  );

  drawRunSigil(ctx, cardX, cardY, cardW, cardH, theme);

  drawMetadataBand(ctx, summary, cardX, cardW, metaBandY, metaChipH, serialY, theme, compactCard);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(cardX + innerPad, footerY - (compactCard ? 10 : 14));
  ctx.lineTo(cardX + cardW - innerPad, footerY - (compactCard ? 10 : 14));
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.64)";
  ctx.font = `600 ${compactCard ? 8 : 10}px 'JetBrains Mono', monospace`;
  ctx.fillText(exportMode ? "EXPORT EDITION / PRINT READY" : "MINTABLE CARD / SHARE READY", cardX + innerPad, footerY);

  ctx.fillStyle = "rgba(219,228,255,0.5)";
  ctx.font = `600 ${compactCard ? 8 : 9}px 'JetBrains Mono', monospace`;
  ctx.fillText("gRitual", cardX + cardW - innerPad - (compactCard ? 38 : 46), footerY);

  ctx.restore();
}

export function measureRunCard(width: number, height: number, mode: RunCardMode = "screen"): RunCardFrame {
  if (mode === "export") {
    const cardW = Math.min(width * 0.9, 1080);
    const cardH = Math.min(height * 0.78, 1320);
    return {
      x: Math.floor((width - cardW) / 2),
      y: Math.floor((height - cardH) / 2 - height * 0.01),
      w: cardW,
      h: cardH,
    };
  }

  const maxW = width * 0.86;
  const maxH = height * 0.68;
  const scale = clamp(
    Math.min(maxW / SCREEN_CARD_BASE_WIDTH, maxH / SCREEN_CARD_BASE_HEIGHT),
    0.58,
    1,
  );
  const cardW = Math.floor(SCREEN_CARD_BASE_WIDTH * scale);
  const cardH = Math.floor(SCREEN_CARD_BASE_HEIGHT * scale);
  const yOffset = Math.floor(height * 0.01);
  return {
    x: Math.floor((width - cardW) / 2),
    y: Math.floor((height - cardH) / 2 + yOffset),
    w: cardW,
    h: cardH,
  };
}

function drawStatPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  accent: string,
  compact = false,
): void {
  const pillH = compact ? 42 : 48;
  const radius = compact ? 13 : 16;
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  roundRect(ctx, x, y, w, pillH, radius);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.22);
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, pillH, radius);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `700 ${compact ? 7 : 8}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + (compact ? 11 : 14), y + (compact ? 7 : 8));

  ctx.fillStyle = "#f8f6ff";
  ctx.font = `800 ${compact ? 15 : 17}px 'Space Grotesk', 'Segoe UI', sans-serif`;
  ctx.fillText(value, x + (compact ? 11 : 14), y + (compact ? 19 : 22));
}

function drawSectionLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  accent: string,
  compact = false,
): void {
  ctx.fillStyle = withAlpha(accent, 0.94);
  ctx.font = `700 ${compact ? 8 : 10}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(label, x, y);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(x, y + (compact ? 5 : 6), compact ? 104 : 132, 1);
}

function drawSkillGrid(
  ctx: CanvasRenderingContext2D,
  skills: RunCardSkill[],
  x: number,
  y: number,
  width: number,
  height: number,
  compact = false,
): void {
  const cappedSkills = skills.slice(0, RUN_CARD_MAX_SKILLS);
  const chipsPerRow = compact ? 2 : (width < 330 ? 2 : 3);
  const chipGap = compact ? 8 : 12;
  const chipW = Math.floor((width - chipGap * (chipsPerRow - 1)) / chipsPerRow);
  const chipH = compact ? 40 : 46;
  const maxRows = Math.max(1, Math.floor(height / (chipH + chipGap)));
  const visible = cappedSkills.slice(0, maxRows * chipsPerRow);

  let chipIndex = 0;
  for (const skill of visible) {
    const row = Math.floor(chipIndex / chipsPerRow);
    const col = chipIndex % chipsPerRow;
    const chipX = x + col * (chipW + chipGap);
    const chipY = y + row * (chipH + chipGap);
    const accent = skill.kind === "weapon" ? "#7b8cff" : "#7fe0a8";
    drawSkillChip(ctx, chipX, chipY, chipW, chipH, skill, accent, compact);
    chipIndex += 1;
  }

  if (skills.length > visible.length) {
    const overflowRow = Math.floor(visible.length / chipsPerRow);
    const overflowY = y + overflowRow * (chipH + chipGap);
    ctx.fillStyle = "rgba(255,255,255,0.48)";
    ctx.font = `600 ${compact ? 9 : 10}px 'JetBrains Mono', monospace`;
    const remaining = skills.length - visible.length;
    ctx.fillText(`+${remaining} more`, x, overflowY + chipH + (compact ? 9 : 12));
  }
}

function drawSkillChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  skill: RunCardSkill,
  accent: string,
  compact = false,
): void {
  const fill = ctx.createLinearGradient(x, y, x, y + h);
  fill.addColorStop(0, "rgba(255,255,255,0.06)");
  fill.addColorStop(1, "rgba(255,255,255,0.02)");
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, compact ? 10 : 14);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.28);
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, compact ? 10 : 14);
  ctx.stroke();

  const glyph = glyphForSkill(skill);
  if (compact) {
    drawGlyphBadge(ctx, x + 10, y + 11, 14, glyph, accent);
  } else {
    drawGlyphBadge(ctx, x + 14, y + 14, 18, glyph, accent);
  }

  ctx.fillStyle = withAlpha(accent, 0.88);
  ctx.font = `700 ${compact ? 7 : 8}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const tagX = compact ? x + 29 : x + 38;
  ctx.fillText(skill.kind === "weapon" ? "WEAPON" : "PASSIVE", tagX, y + (compact ? 6 : 8));

  ctx.fillStyle = "#f8f6ff";
  const skillFont = compact ? "700 10px 'Space Grotesk', 'Segoe UI', sans-serif" : "700 12px 'Space Grotesk', 'Segoe UI', sans-serif";
  ctx.font = skillFont;
  const safeLabel = clampTextTail(ctx, skill.label, w - (compact ? 62 : 82), skillFont);
  ctx.fillText(safeLabel, tagX, y + (compact ? 18 : 24));

  ctx.fillStyle = "rgba(219,228,255,0.68)";
  ctx.font = `700 ${compact ? 8 : 9}px 'JetBrains Mono', monospace`;
  const levelText = `Lv ${skill.level}`;
  const levelX = x + w - (compact ? 6 : 10) - ctx.measureText(levelText).width;
  ctx.fillText(levelText, levelX, y + h - (compact ? 9 : 11));
}

function drawEnemyBreakdown(
  ctx: CanvasRenderingContext2D,
  enemies: RunCardEnemyKill[],
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string,
  compact = false,
): void {
  const cappedEnemies = enemies.slice(0, RUN_CARD_MAX_ENEMIES);
  const rowH = compact ? 34 : 38;
  const rows = Math.max(1, Math.floor(height / rowH));
  const visible = cappedEnemies.slice(0, rows);
  const maxCount = Math.max(1, ...visible.map((entry) => entry.count));

  if (visible.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.font = `600 ${compact ? 10 : 12}px 'Inter', sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("No enemy kills recorded yet.", x, y + 16);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x, y + 26, width * 0.72, 1);
    return;
  }

  visible.forEach((entry, index) => {
    const rowY = y + index * rowH;
    const rowFill = ctx.createLinearGradient(x, rowY, x, rowY + rowH - 10);
    rowFill.addColorStop(0, "rgba(255,255,255,0.06)");
    rowFill.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.fillStyle = rowFill;
    roundRect(ctx, x, rowY, width, rowH - (compact ? 8 : 10), compact ? 9 : 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,107,122,0.18)";
    ctx.lineWidth = 1;
    roundRect(ctx, x, rowY, width, rowH - (compact ? 8 : 10), compact ? 9 : 12);
    ctx.stroke();

    const glyph = glyphForEnemy(entry);
    if (compact) {
      drawGlyphBadge(ctx, x + 10, rowY + 9, 14, glyph, accent);
    } else {
      drawGlyphBadge(ctx, x + 14, rowY + 11, 18, glyph, accent);
    }

    ctx.fillStyle = "#f9fbff";
    const labelFont = compact ? "700 10px 'Inter', sans-serif" : "700 11px 'Inter', sans-serif";
    ctx.font = labelFont;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const labelMaxW = width - (compact ? 92 : 100);
    const safeEnemyLabel = clampTextTail(ctx, entry.label, labelMaxW, labelFont);
    ctx.fillText(safeEnemyLabel, x + (compact ? 30 : 40), rowY + (compact ? 11 : 12));

    const countText = entry.count.toLocaleString();
    ctx.fillStyle = "#ffd86b";
    ctx.font = `800 ${compact ? 11 : 12}px 'JetBrains Mono', monospace`;
    ctx.fillText(countText, x + width - (compact ? 10 : 14) - ctx.measureText(countText).width, rowY + (compact ? 11 : 12));

    const barX = x + (compact ? 9 : 12);
    const barY = rowY + (compact ? 23 : 27);
    const barW = width - (compact ? 18 : 24);
    const barRatio = entry.count / maxCount;
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, barX, barY, barW, compact ? 3 : 4, 99);
    ctx.fill();
    ctx.fillStyle = withAlpha("#ff6b7a", 0.58);
    roundRect(ctx, barX, barY, Math.max(compact ? 6 : 8, barW * barRatio), compact ? 3 : 4, 99);
    ctx.fill();
  });

  if (enemies.length > visible.length) {
    ctx.fillStyle = "rgba(255,255,255,0.48)";
    ctx.font = `600 ${compact ? 9 : 10}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`+${enemies.length - visible.length} more`, x, y + visible.length * rowH + (compact ? 6 : 8));
  }
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

function drawMetadataBand(
  ctx: CanvasRenderingContext2D,
  summary: RunCardSummary,
  cardX: number,
  cardW: number,
  bandY: number,
  chipH: number,
  serialY: number,
  theme: RunCardTheme,
  compact = false,
): void {
  const sideInset = compact ? 16 : 24;
  const bandX = cardX + sideInset;
  const bandW = cardW - sideInset * 2;
  const chipGap = compact ? 8 : 10;
  const chipW = Math.floor((bandW - chipGap * 2) / 3);

  const chips = [
    { label: "CHAIN", value: "Ritual Chain" },
    { label: "COLLECTION", value: "Ritualist Never Sleeps" },
    { label: "TOKEN", value: "Run Card" },
  ];

  ctx.save();
  for (let idx = 0; idx < chips.length; idx += 1) {
    const chip = chips[idx];
    if (!chip) {
      continue;
    }

    const chipX = bandX + idx * (chipW + chipGap);
    drawMetaChip(ctx, chipX, bandY, chipW, chipH, chip.label, chip.value, theme, compact);
  }

  ctx.fillStyle = "rgba(255,255,255,0.48)";
  const serialFont = compact ? "600 8px 'JetBrains Mono', monospace" : "600 10px 'JetBrains Mono', monospace";
  ctx.font = serialFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const serialText = `SERIAL ${summary.serialNumber}  •  MINTED ${formatUtcTimestamp(summary.capturedAt)}`;
  const safeSerial = clampTextTail(ctx, serialText, cardW - sideInset * 2 - 8, serialFont);
  ctx.fillText(
    safeSerial,
    cardX + cardW * 0.5,
    serialY,
  );
  ctx.restore();
}

function drawMetaChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  theme: RunCardTheme,
  compact = false,
): void {
  const fill = ctx.createLinearGradient(x, y, x, y + h);
  fill.addColorStop(0, "rgba(255,255,255,0.06)");
  fill.addColorStop(1, "rgba(255,255,255,0.025)");
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, compact ? 10 : 14);
  ctx.fill();

  ctx.strokeStyle = withAlpha(theme.primary, 0.22);
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, compact ? 10 : 14);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  const labelFont = compact ? "700 7px 'JetBrains Mono', monospace" : "700 8px 'JetBrains Mono', monospace";
  ctx.font = labelFont;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + (compact ? 9 : 12), y + (compact ? 7 : 9));

  ctx.fillStyle = "#f9fbff";
  const valueFont = compact ? "700 11px 'Space Grotesk', 'Segoe UI', sans-serif" : "700 13px 'Space Grotesk', 'Segoe UI', sans-serif";
  ctx.font = valueFont;
  const safeValue = clampTextTail(ctx, value, w - (compact ? 18 : 24), valueFont);
  ctx.fillText(safeValue, x + (compact ? 9 : 12), y + (compact ? 18 : 22));
}

function drawGlyphBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  glyph: string,
  accent: string,
): void {
  const fill = ctx.createRadialGradient(x + size * 0.35, y + size * 0.3, 2, x + size / 2, y + size / 2, size / 2);
  fill.addColorStop(0, withAlpha(accent, 0.72));
  fill.addColorStop(1, "rgba(4, 5, 8, 0.96)");
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.34);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#f9fbff";
  ctx.font = `700 ${Math.max(9, Math.floor(size * 0.58))}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, x + size / 2, y + size / 2 + 0.5);
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
): void {
  const watermark = getCardWatermarkImage();
  if (!watermark) {
    return;
  }

  const maxWidth = cardW * 1.5;
  const maxHeight = cardH * 1.5;
  const scale = Math.min(maxWidth / watermark.naturalWidth, maxHeight / watermark.naturalHeight);
  const drawW = watermark.naturalWidth * scale;
  const drawH = watermark.naturalHeight * scale;
  const drawX = cardX + (cardW - drawW) / 2;
  const drawY = cardY + (cardH - drawH) / 2 + cardH * 0.02;

  ctx.save();
  roundRect(ctx, cardX + 2, cardY + 2, cardW - 4, cardH - 4, 26);
  ctx.clip();
  ctx.globalAlpha = 0.1;
  ctx.drawImage(watermark, drawX, drawY, drawW, drawH);
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

function glyphForSkill(skill: RunCardSkill): string {
  const label = skill.label.toLowerCase();
  if (label.includes("lash") || label.includes("whip")) return "⟿";
  if (label.includes("blade") || label.includes("shard")) return "✦";
  if (label.includes("cross") || label.includes("sanct")) return "✠";
  if (label.includes("tome") || label.includes("book")) return "☍";
  if (label.includes("wand") || label.includes("bolt") || label.includes("beam")) return "⚡";
  if (label.includes("aura") || label.includes("shield") || label.includes("ward")) return "◉";
  if (label.includes("pool") || label.includes("curse") || label.includes("sigil")) return "◌";
  if (skill.kind === "passive") return "✚";
  return "✧";
}

function glyphForEnemy(entry: RunCardEnemyKill): string {
  const label = entry.label.toLowerCase();
  if (label.includes("boss") || label.includes("brute")) return "☠";
  if (label.includes("fly") || label.includes("bat") || label.includes("drone")) return "✦";
  if (label.includes("blob") || label.includes("slime")) return "◌";
  if (label.includes("mage") || label.includes("witch")) return "✠";
  if (label.includes("knight") || label.includes("guard")) return "⛨";
  if (label.includes("fast") || label.includes("stalker")) return "➤";
  return "◆";
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

function formatUtcTimestamp(epochMs: number): string {
  const date = new Date(epochMs);
  const year = date.getUTCFullYear();
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

function fitCenteredTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxFontSize: number,
  minFontSize: number,
): void {
  let fontSize = maxFontSize;
  while (fontSize > minFontSize) {
    ctx.font = `900 ${fontSize}px 'Cinzel', 'Times New Roman', serif`;
    if (ctx.measureText(text).width <= maxWidth) {
      break;
    }
    fontSize -= 1;
  }

  ctx.fillText(text, x, y);
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
