import { getScoreTier } from "../utils/scoreTitle";

export interface HudSkillSlot {
  id: string;
  name: string;
  level: number;
  ready: boolean;
  cooldownRemainingMs: number;
}

export interface HudRadarPoint {
  x: number;
  y: number;
  type?: "enemy" | "pickup";
}

/** Immutable HUD snapshot queried each render pass. */
export interface HudPresentationState {
  survivorLevel: number;
  survivorHp: number;
  survivorMaxHp: number;
  xpProgress: number;
  xpBudget: number;
  elapsedMs: number;
  score?: number;
  skillSlots?: HudSkillSlot[];
  radarPoints?: HudRadarPoint[];
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
  const safeInsetTop = compact ? 10 : tight ? 12 : 14;
  const panelH = compact ? 76 : tight ? 82 : 88;

  return {
    compact,
    tight,
    safeInsetTop,
    panelH,
    gap: compact ? 10 : 12,
    leftPanelW: compact ? 180 : 220,
    rightPanelW: compact ? 180 : 220,
    topStripBottom: safeInsetTop + panelH + 10,
  };
}

function formatClock(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function acronymForSkill(name: string): string {
  const cleaned = name.trim();
  if (cleaned.length <= 3) {
    return cleaned.toUpperCase();
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

function resolveSkillAccent(skillId: string): { border: string; glow: string; fill: string } {
  const accents: Record<string, { border: string; glow: string; fill: string }> = {
    whip: { border: "#6ee7ff", glow: "rgba(110,231,255,0.42)", fill: "rgba(11,44,55,0.82)" },
    bloody_tear: { border: "#ff8ba8", glow: "rgba(255,139,168,0.42)", fill: "rgba(51,16,27,0.84)" },
    magic_wand: { border: "#ffd36b", glow: "rgba(255,211,107,0.38)", fill: "rgba(54,42,13,0.84)" },
    holy_wand: { border: "#fff3bf", glow: "rgba(255,243,191,0.4)", fill: "rgba(58,53,24,0.84)" },
    knife: { border: "#8db5ff", glow: "rgba(141,181,255,0.38)", fill: "rgba(15,31,56,0.84)" },
    thousand_edge: { border: "#9fc6ff", glow: "rgba(159,198,255,0.42)", fill: "rgba(18,34,60,0.84)" },
    axe: { border: "#ffb86b", glow: "rgba(255,184,107,0.4)", fill: "rgba(63,31,14,0.84)" },
    death_spiral: { border: "#ffcf8d", glow: "rgba(255,207,141,0.4)", fill: "rgba(66,38,18,0.84)" },
    cross: { border: "#a7ffcf", glow: "rgba(167,255,207,0.4)", fill: "rgba(17,52,37,0.84)" },
    heaven_sword: { border: "#d9fff0", glow: "rgba(217,255,240,0.42)", fill: "rgba(24,54,45,0.84)" },
    king_bible: { border: "#c9a8ff", glow: "rgba(201,168,255,0.4)", fill: "rgba(39,25,60,0.84)" },
    unholy_vespers: { border: "#e2b9ff", glow: "rgba(226,185,255,0.42)", fill: "rgba(48,25,64,0.84)" },
    fire_wand: { border: "#ff9368", glow: "rgba(255,147,104,0.42)", fill: "rgba(66,22,12,0.84)" },
    hellfire: { border: "#ff6b5a", glow: "rgba(255,107,90,0.45)", fill: "rgba(72,16,10,0.86)" },
    garlic: { border: "#7cff9d", glow: "rgba(124,255,157,0.36)", fill: "rgba(14,47,25,0.84)" },
    soul_eater: { border: "#91ffb3", glow: "rgba(145,255,179,0.38)", fill: "rgba(20,53,29,0.84)" },
    santa_water: { border: "#66d8ff", glow: "rgba(102,216,255,0.42)", fill: "rgba(10,38,54,0.84)" },
    la_borra: { border: "#7cdfff", glow: "rgba(124,223,255,0.42)", fill: "rgba(12,42,58,0.84)" },
    runetracer: { border: "#9f8bff", glow: "rgba(159,139,255,0.4)", fill: "rgba(28,20,58,0.84)" },
    no_future: { border: "#c8a3ff", glow: "rgba(200,163,255,0.42)", fill: "rgba(39,22,64,0.84)" },
    lightning_ring: { border: "#ffe66b", glow: "rgba(255,230,107,0.42)", fill: "rgba(58,51,12,0.84)" },
    thunder_loop: { border: "#fff19a", glow: "rgba(255,241,154,0.42)", fill: "rgba(64,58,18,0.84)" },
    pentagram: { border: "#ff7ef5", glow: "rgba(255,126,245,0.42)", fill: "rgba(62,14,54,0.86)" },
    gorgeous_moon: { border: "#f9c6ff", glow: "rgba(249,198,255,0.42)", fill: "rgba(70,26,74,0.86)" },
  };
  return accents[skillId] ?? {
    border: "#7fe0a8",
    glow: "rgba(127,224,168,0.35)",
    fill: "rgba(10,20,26,0.84)",
  };
}

/** DOM HUD overlay that sits above the gameplay canvas. */
export class HudRenderer {
  private readonly root: HTMLDivElement;
  private readonly scoreValueEl: HTMLDivElement;
  private readonly rankValueEl: HTMLDivElement;
  private readonly clockEl: HTMLDivElement;
  private readonly hpBarEl: HTMLDivElement;
  private readonly hpValueEl: HTMLDivElement;
  private readonly xpBarEl: HTMLDivElement;
  private readonly xpValueEl: HTMLDivElement;
  private readonly radarCanvas: HTMLCanvasElement;
  private readonly skillBarEl: HTMLDivElement;
  private hpKickRemainMs = 0;

  constructor() {
    this.root = document.createElement("div");
    this.root.className = "ritual-hud";
    this.root.innerHTML = `
      <div class="ritual-hud__score">
        <div class="ritual-hud__rank"></div>
        <div class="ritual-hud__scoreValue"></div>
      </div>
      <div class="ritual-hud__bars">
        <div class="ritual-hud__clock"></div>
        <div class="ritual-hud__bar ritual-hud__bar--hp">
          <div class="ritual-hud__barFill ritual-hud__barFill--hp"></div>
          <div class="ritual-hud__barLabel ritual-hud__barLabel--hp">HP</div>
          <div class="ritual-hud__barValue ritual-hud__barValue--hp"></div>
        </div>
        <div class="ritual-hud__bar ritual-hud__bar--xp">
          <div class="ritual-hud__barFill ritual-hud__barFill--xp"></div>
          <div class="ritual-hud__barLabel ritual-hud__barLabel--xp">XP</div>
          <div class="ritual-hud__barValue ritual-hud__barValue--xp"></div>
        </div>
      </div>
      <div class="ritual-hud__radar">
        <canvas class="ritual-hud__radarCanvas" width="128" height="128"></canvas>
      </div>
      <div class="ritual-hud__skills"></div>
    `;

    this.scoreValueEl = this.root.querySelector(".ritual-hud__scoreValue") as HTMLDivElement;
    this.rankValueEl = this.root.querySelector(".ritual-hud__rank") as HTMLDivElement;
    this.clockEl = this.root.querySelector(".ritual-hud__clock") as HTMLDivElement;
    this.hpBarEl = this.root.querySelector(".ritual-hud__barFill--hp") as HTMLDivElement;
    this.hpValueEl = this.root.querySelector(".ritual-hud__barValue--hp") as HTMLDivElement;
    this.xpBarEl = this.root.querySelector(".ritual-hud__barFill--xp") as HTMLDivElement;
    this.xpValueEl = this.root.querySelector(".ritual-hud__barValue--xp") as HTMLDivElement;
    this.radarCanvas = this.root.querySelector(".ritual-hud__radarCanvas") as HTMLCanvasElement;
    this.skillBarEl = this.root.querySelector(".ritual-hud__skills") as HTMLDivElement;

    document.body.appendChild(this.root);
  }

  notifyHit(): void {
    this.hpKickRemainMs = 220;
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "block" : "none";
  }

  dispose(): void {
    this.root.remove();
  }

  draw(
    _ctx: CanvasRenderingContext2D,
    _viewportWidth: number,
    _viewportHeight: number,
    snapshot: HudPresentationState,
  ): void {
    this.hpKickRemainMs = Math.max(0, this.hpKickRemainMs - 16);
    const scoreValue = snapshot.score ?? 0;
    const tier = getScoreTier(scoreValue);
    const hpRatio = snapshot.survivorMaxHp > 0
      ? Math.max(0, Math.min(1, snapshot.survivorHp / snapshot.survivorMaxHp))
      : 0;
    const xpRatio = snapshot.xpBudget > 0
      ? Math.max(0, Math.min(1, snapshot.xpProgress / snapshot.xpBudget))
      : 0;

    this.scoreValueEl.textContent = scoreValue.toLocaleString();
    this.rankValueEl.textContent = tier.title;
    this.clockEl.textContent = formatClock(snapshot.elapsedMs);
    this.hpBarEl.style.width = `${Math.round(hpRatio * 100)}%`;
    this.hpValueEl.textContent = `${Math.max(0, Math.floor(snapshot.survivorHp))} / ${Math.max(1, Math.floor(snapshot.survivorMaxHp))}`;
    this.xpBarEl.style.width = `${Math.round(xpRatio * 100)}%`;
    this.xpValueEl.textContent = `${Math.floor(snapshot.xpProgress)} / ${Math.floor(snapshot.xpBudget)}`;

    this.root.dataset.tierColor = tier.color.toLowerCase();
    this.root.classList.toggle("is-hit", this.hpKickRemainMs > 0);

    this.renderRadar(snapshot.radarPoints ?? []);
    this.renderSkillBar(snapshot.skillSlots ?? []);
  }

  private renderRadar(points: HudRadarPoint[]): void {
    const ctx = this.radarCanvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, this.radarCanvas.width, this.radarCanvas.height);
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.46;

    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (const ratio of [0.35, 0.68, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * ratio, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(180, 201, 255, 0.12)";
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();

    for (const point of points.slice(0, 18)) {
      const px = cx + point.x * r;
      const py = cy + point.y * r;
      ctx.fillStyle = point.type === "pickup" ? "#7fe0a8" : "#ff7878";
      ctx.beginPath();
      ctx.arc(px, py, point.type === "pickup" ? 2.5 : 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(cx, cy, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderSkillBar(skills: HudSkillSlot[]): void {
    const currentKeys = new Set(skills.map((skill) => skill.id));

    Array.from(this.skillBarEl.children).forEach((child) => {
      const el = child as HTMLDivElement;
      const key = el.dataset.skillId;
      if (!key || !currentKeys.has(key)) {
        el.remove();
      }
    });

    for (const skill of skills) {
      let slot = this.skillBarEl.querySelector(`[data-skill-id="${skill.id}"]`) as HTMLDivElement | null;
      if (!slot) {
        slot = document.createElement("div");
        slot.className = "ritual-hud__skill";
        slot.dataset.skillId = skill.id;
        slot.innerHTML = `
          <div class="ritual-hud__skillIcon"></div>
          <div class="ritual-hud__skillMeta">
            <div class="ritual-hud__skillName"></div>
            <div class="ritual-hud__skillLevel"></div>
          </div>
        `;
        this.skillBarEl.appendChild(slot);
      }

      const accent = resolveSkillAccent(skill.id);
      slot.style.setProperty("--hud-skill-border", accent.border);
      slot.style.setProperty("--hud-skill-glow", accent.glow);
      slot.style.setProperty("--hud-skill-fill", accent.fill);
      slot.classList.toggle("is-ready", skill.ready);

      const iconEl = slot.querySelector(".ritual-hud__skillIcon") as HTMLDivElement;
      const nameEl = slot.querySelector(".ritual-hud__skillName") as HTMLDivElement;
      const levelEl = slot.querySelector(".ritual-hud__skillLevel") as HTMLDivElement;
      iconEl.textContent = acronymForSkill(skill.name);
      nameEl.textContent = skill.name;
      levelEl.textContent = `Lv ${skill.level}`;
      slot.title = skill.ready
        ? `${skill.name} ready`
        : `${skill.name} cooling down (${Math.ceil(skill.cooldownRemainingMs / 100) / 10}s)`;
    }
  }
}
