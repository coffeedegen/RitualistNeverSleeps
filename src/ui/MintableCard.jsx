import React, { useEffect, useRef, useState } from "react";
import { getScoreTier } from "../utils/scoreTitle";

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getInitials(handle) {
  const cleaned = String(handle ?? "").replace(/^@+/, "").trim();
  if (!cleaned) {
    return "RS";
  }
  if (/^no x handle$/i.test(cleaned) || /^0x[a-f0-9.]+$/i.test(cleaned)) {
    return "RS";
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? "R"}${parts[1][0] ?? "S"}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

function buildFallbackAvatarDataUri(handle) {
  const initials = escapeXml(getInitials(handle));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <defs>
        <radialGradient id="bg" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stop-color="#16324a" />
          <stop offset="60%" stop-color="#0b1727" />
          <stop offset="100%" stop-color="#04070c" />
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#4ade80" stop-opacity="0.32" />
          <stop offset="80%" stop-color="#22d3ee" stop-opacity="0.04" />
          <stop offset="100%" stop-color="#22d3ee" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="320" rx="32" fill="url(#bg)" />
      <rect x="16" y="16" width="288" height="288" rx="28" fill="url(#glow)" />
      <path d="M62 160h196M160 62v196M92 92l136 136M228 92 92 228" stroke="#4ade80" stroke-opacity="0.15" stroke-width="3"/>
      <circle cx="160" cy="160" r="132" fill="none" stroke="#4ade80" stroke-opacity="0.72" stroke-width="8" />
      <circle cx="160" cy="160" r="118" fill="none" stroke="#22d3ee" stroke-opacity="0.4" stroke-width="3" />
      <text x="160" y="184" text-anchor="middle" font-family="Cinzel, serif" font-size="92" font-weight="900" fill="#f8fafc">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function shortenWalletAddress(walletAddress) {
  const value = String(walletAddress ?? "").trim();
  if (!value) {
    return "0x0000...0000";
  }
  if (value.length <= 12) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatSerialDate(dateMinted) {
  const raw = String(dateMinted ?? "").trim();
  if (!raw) {
    return "01-01-1970";
  }

  const parts = raw.split("-").map((part) => part.trim());
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day}-${month}-${year}`;
  }
  if (parts.length === 3 && parts[2].length === 4) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const year = String(parsed.getUTCFullYear()).padStart(4, "0");
  return `${day}-${month}-${year}`;
}

function formatTitleTier(tier, rank) {
  const tierText = String(tier ?? "").trim();
  const rankText = String(rank ?? "").trim();
  return tierText || rankText || "Initiate";
}

function formatRankLabel(rank, tier) {
  return String(rank ?? "").trim() || formatTitleTier(tier, rank);
}

function useCardMetrics() {
  const ref = useRef(null);
  const [metrics, setMetrics] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!(node instanceof HTMLElement)) {
      return undefined;
    }

    const update = () => {
      const rect = node.getBoundingClientRect();
      setMetrics({ width: rect.width, height: rect.height });
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, metrics];
}

function StatBox({ label, value, sublabel = "", compact = false, span = false, hero = false }) {
  return (
    <div
      className={[
        "rounded-[16px] border border-emerald-500/12 bg-[linear-gradient(180deg,rgba(6,12,8,0.96),rgba(3,6,5,0.98))] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        hero ? "min-h-[104px] border-emerald-400/18 bg-[linear-gradient(180deg,rgba(12,24,16,0.98),rgba(5,10,7,0.98))]" : compact ? "min-h-[78px]" : "min-h-[92px]",
        span ? "col-span-full" : "",
      ].join(" ")}
    >
      <div className={["font-mono text-[10px] font-bold uppercase tracking-[0.16em]", hero ? "text-emerald-200/82" : "text-slate-400/95"].join(" ")}>
        {label}
      </div>
      <div
        className={[
          "mt-3 font-black leading-none tracking-[-0.04em] text-emerald-300",
          hero ? "text-[clamp(1.8rem,3.1vw,2.75rem)] drop-shadow-[0_0_16px_rgba(74,222,128,0.2)]" : "text-[clamp(1.12rem,1.8vw,1.65rem)]",
        ].join(" ")}
      >
        {value}
      </div>
      {sublabel ? (
        <div className={["mt-2.5 font-mono text-[9px] uppercase tracking-[0.12em]", hero ? "text-emerald-300/56" : "text-slate-500/90"].join(" ")}>
          {sublabel}
        </div>
      ) : null}
    </div>
  );
}

function MetaPill({ children, tone = "default" }) {
  const toneClass =
    tone === "accent"
      ? "border-emerald-400/30 bg-emerald-500/6 text-emerald-300 shadow-[0_0_18px_rgba(74,222,128,0.12)]"
      : "border-slate-500/24 bg-slate-800/32 text-slate-300";

  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
        toneClass,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function getTierAccentClasses(color) {
  const normalized = String(color ?? "").toLowerCase();
  switch (normalized) {
    case "gold":
      return {
        rank: "text-yellow-300",
        pill: "border-yellow-400/30 bg-yellow-500/8 text-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.12)]",
      };
    case "indigo":
      return {
        rank: "text-indigo-300",
        pill: "border-indigo-400/30 bg-indigo-500/8 text-indigo-200 shadow-[0_0_18px_rgba(129,140,248,0.12)]",
      };
    case "green":
      return {
        rank: "text-emerald-300",
        pill: "border-emerald-400/30 bg-emerald-500/8 text-emerald-200 shadow-[0_0_18px_rgba(74,222,128,0.12)]",
      };
    case "purple":
      return {
        rank: "text-violet-300",
        pill: "border-violet-400/30 bg-violet-500/8 text-violet-200 shadow-[0_0_18px_rgba(167,139,250,0.12)]",
      };
    case "blue":
      return {
        rank: "text-sky-300",
        pill: "border-sky-400/30 bg-sky-500/8 text-sky-200 shadow-[0_0_18px_rgba(56,189,248,0.12)]",
      };
    default:
      return {
        rank: "text-amber-300",
        pill: "border-amber-500/28 bg-amber-500/8 text-amber-100 shadow-[0_0_18px_rgba(180,120,55,0.12)]",
      };
  }
}

export default function MintableCard({
  twitterHandle,
  walletAddress,
  tier,
  finalScore,
  kills,
  duration,
  level,
  rank,
  score,
  dateMinted,
  timeUTC,
  avatarUrl = "",
  className = "",
  exportMode = false,
}) {
  const [cardRef, metrics] = useCardMetrics();
  const handleText = String(twitterHandle ?? "").startsWith("@")
    ? String(twitterHandle ?? "")
    : `@${String(twitterHandle ?? "").replace(/^@+/, "")}`;
  const handleSeed = String(twitterHandle ?? "").replace(/^@+/, "").trim();
  const handleLooksLikeWallet = /^0x[a-f0-9.]+$/i.test(handleSeed);
  const displayHandle = handleLooksLikeWallet ? "@Unlinked" : handleText;
  const displayTier = formatTitleTier(tier, rank);
  const avatarSrc = avatarUrl || buildFallbackAvatarDataUri(handleText);
  const serialDate = formatSerialDate(dateMinted);
  const mintedStamp = `${String(dateMinted ?? "").trim()} ${String(timeUTC ?? "").trim()}`.trim();
  const resolvedTier = getScoreTier(Number(score ?? finalScore ?? 0));
  const tierAccent = getTierAccentClasses(resolvedTier.color);

  const aspect = metrics.width > 0 && metrics.height > 0 ? metrics.width / metrics.height : 1.5;
  const compact = metrics.width > 0 ? metrics.width < 760 || aspect < 1.34 : false;
  const narrow = metrics.width > 0 ? metrics.width < 560 : false;
  const mobileGrid = exportMode ? "grid-cols-2" : narrow ? "grid-cols-1" : compact ? "grid-cols-2" : "grid-cols-2";
  const bodyGrid = exportMode
    ? "grid grid-cols-[minmax(320px,0.94fr)_minmax(420px,1.06fr)] items-start gap-4"
    : compact
      ? "grid gap-4"
      : "grid grid-cols-[minmax(288px,0.88fr)_minmax(352px,1.12fr)] items-start gap-4";
  const heroHeight = exportMode
    ? "min-h-[118px]"
    : narrow
      ? "min-h-[84px]"
      : compact
        ? "min-h-[100px]"
        : "min-h-[118px]";
  const avatarSize = exportMode ? "h-32 w-32" : narrow ? "h-22 w-22" : compact ? "h-26 w-26" : "h-30 w-30";
  const rootSizeClass = exportMode ? "w-full" : "h-full w-full aspect-[3/2]";
  const outerPaddingClass = exportMode ? "p-4 sm:p-5" : "p-4 sm:p-4";
  const shellHeightClass = exportMode ? "flex flex-col" : "flex h-full flex-col";
  const footerSpacingClass = exportMode ? "pt-4" : "mt-auto pt-3";

  return (
    <div
      ref={cardRef}
      className={[
        "relative isolate flex flex-col overflow-hidden rounded-[28px] border border-emerald-500/24 bg-[#050806] text-slate-100 shadow-[0_0_0_1px_rgba(74,222,128,0.12),0_0_42px_rgba(34,197,94,0.12)]",
        rootSizeClass,
        outerPaddingClass,
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(74,222,128,0.08),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.08),transparent_26%),linear-gradient(180deg,rgba(4,8,6,0.98),rgba(1,3,2,1))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(74,222,128,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(74,222,128,0.12)_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,transparent_56%,rgba(74,222,128,0.06)_100%)]" />

      <div className={["relative z-10", shellHeightClass].join(" ")}>
        <section
          className={[
            "relative overflow-hidden rounded-[22px] border border-emerald-500/18 bg-[linear-gradient(135deg,rgba(24,8,44,0.92),rgba(3,18,13,0.98)_52%,rgba(5,9,7,0.98))]",
            heroHeight,
          ].join(" ")}
        >
          <div className="absolute inset-y-0 right-0 w-[42%] bg-[radial-gradient(circle_at_40%_36%,rgba(103,232,249,0.22),transparent_34%),radial-gradient(circle_at_58%_42%,rgba(74,222,128,0.2),transparent_28%)]" />
          <div className="absolute left-[43%] top-1/2 h-[72%] w-[18%] -translate-x-1/2 -translate-y-1/2 opacity-18">
            <div className="flex h-full items-center justify-center font-serif text-[clamp(4rem,9vw,8rem)] font-black text-emerald-400/18">
              ◈
            </div>
          </div>
          <div className="absolute right-[9%] top-[20%] h-8 w-8 rotate-45 border border-emerald-300/20 shadow-[0_0_12px_rgba(74,222,128,0.08)]" />
          <div className="absolute right-[11.8%] top-[25%] h-3 w-3 rotate-45 bg-emerald-300/78 shadow-[0_0_12px_rgba(74,222,128,0.16)]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

          <div className={["relative flex h-full flex-col justify-between", exportMode ? "p-4.5" : "p-4 sm:p-4"].join(" ")}>
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-[78%]">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/72">
                  Ritual Run Archive
                </div>
                <div
                  className={[
                    "mt-1 bg-gradient-to-b from-emerald-200 via-emerald-400 to-emerald-700 bg-clip-text font-sans font-black text-transparent drop-shadow-[0_0_14px_rgba(74,222,128,0.13)]",
                    exportMode
                      ? "text-[clamp(1.9rem,4vw,3.35rem)] leading-[0.88] tracking-[-0.045em]"
                      : "text-[clamp(1.75rem,5.2vw,4.15rem)] leading-[0.84] tracking-[-0.055em]",
                  ].join(" ")}
                >
                  RITUALIST NEVER SLEEP
                </div>
              </div>
              <MetaPill tone="accent">Run Card</MetaPill>
            </div>
          </div>
        </section>

        <div className={["mt-3 flex flex-col", exportMode ? "" : "min-h-0 flex-1"].join(" ")}>
          <section className={bodyGrid}>
            <div className="self-start rounded-[22px] border border-emerald-500/12 bg-[linear-gradient(180deg,rgba(7,11,9,0.9),rgba(3,5,4,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className={exportMode ? "grid grid-cols-[148px_minmax(0,1fr)] gap-4" : compact ? "grid gap-3.5" : "grid grid-cols-[138px_minmax(0,1fr)] gap-4"}>
                <div className="relative">
                  <div className="absolute inset-0 rounded-[20px] bg-emerald-400/16 blur-lg" />
                  <div className="absolute inset-[-5px] rounded-[24px] border border-emerald-400/15" />
                  <div className="absolute left-2 top-2 h-4 w-4 border-l border-t border-emerald-200/48" />
                  <div className="absolute bottom-2 right-2 h-4 w-4 border-b border-r border-emerald-200/48" />
                  <div className="relative overflow-hidden rounded-[20px] border border-emerald-400/28 bg-slate-200/92 p-1">
                    <img
                      src={avatarSrc}
                      alt={`${displayHandle} profile picture`}
                      className={[avatarSize, "w-full rounded-[16px] object-cover"].join(" ")}
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className={["font-sans font-black leading-none tracking-[-0.035em] text-violet-300", exportMode ? "text-[clamp(1.55rem,2.45vw,2.2rem)]" : "text-[clamp(1.4rem,2.25vw,2rem)]"].join(" ")}>
                    {displayHandle}
                  </div>
                  <div className={["mt-1.5 font-sans font-semibold text-slate-300/90", exportMode ? "text-[0.98rem]" : "text-[clamp(0.92rem,1.2vw,1.05rem)]"].join(" ")}>
                    {handleLooksLikeWallet ? "@ritualist" : displayHandle.replace(/^@/, "@")}
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className={["inline-flex rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]", tierAccent.pill].join(" ")}>
                      {displayTier}
                    </span>
                    <MetaPill>{shortenWalletAddress(walletAddress)}</MetaPill>
                    <MetaPill tone="accent">gRitual</MetaPill>
                  </div>

                  <div className={["mt-3.5 grid grid-cols-2 gap-2.5 border-t border-emerald-500/12", exportMode ? "pt-4" : "pt-3.5"].join(" ")}>
                    <div>
                      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500/92">
                        Rank
                      </div>
                      <div className={["mt-1 font-black leading-none tracking-[-0.04em]", tierAccent.rank, exportMode ? "text-[clamp(1.55rem,2.2vw,2.15rem)]" : "text-[clamp(1.4rem,2vw,2.1rem)]"].join(" ")}>
                        {formatRankLabel(rank, tier)}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500/92">
                        Level
                      </div>
                      <div className={["mt-1 font-black leading-none tracking-[-0.04em] text-emerald-300", exportMode ? "text-[clamp(1.55rem,2.2vw,2.15rem)]" : "text-[clamp(1.4rem,2vw,2.1rem)]"].join(" ")}>
                        {level}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="self-start rounded-[22px] border border-emerald-500/12 bg-[linear-gradient(180deg,rgba(7,11,9,0.9),rgba(3,5,4,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className={["flex items-center justify-between gap-3 border-b border-emerald-500/10", exportMode ? "mb-3.5 pb-3" : "mb-3 pb-2.5"].join(" ")}>
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Ritual Proof Matrix
                </div>
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/74">
                  Live Run Data
                </div>
              </div>
              <div className={["grid", mobileGrid, exportMode ? "gap-3" : "gap-2.5"].join(" ")}>
                <StatBox label="Final Score" value={finalScore} sublabel="Run output" compact={compact} hero />
                <StatBox label="Total Kills" value={kills} sublabel="Enemies defeated" compact={compact} hero />
                <StatBox label="Duration" value={duration} sublabel="Survival time" compact={compact} />
                <StatBox label="Level" value={level} sublabel="Peak ritual level" compact={compact} />
                <StatBox label="Rank" value={formatRankLabel(rank, tier)} sublabel="Tier reached" compact={compact} />
                <StatBox
                  label="Identity"
                  value={displayHandle}
                  sublabel={shortenWalletAddress(walletAddress)}
                  compact={compact}
                  span={narrow}
                />
              </div>
            </div>
          </section>

          <footer className={footerSpacingClass}>
            <div className="flex items-center justify-between gap-4 border-t border-emerald-500/14 pt-3">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Proof Preview
              </div>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {walletAddress ? walletAddress.slice(-4).toUpperCase() : "RNS"}
              </div>
            </div>

            <div className={["rounded-[18px] border border-emerald-500/18 bg-black/40 px-4 text-center", exportMode ? "mt-2 py-2" : "mt-2.5 py-2.5"].join(" ")}>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-400">
                Exclusively in Ritual Chain
              </div>
              <div className={["mt-1 font-mono uppercase tracking-[0.13em] text-slate-300/88", exportMode ? "text-[9px]" : "text-[10px]"].join(" ")}>
                Reminder: Ritualists Actually Sleep
              </div>
            </div>

            <div className="mt-3 flex flex-col items-center gap-1 text-center">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Made by
                {" "}
                <span className="text-emerald-300">coffeedegen</span>
              </div>
            </div>

            <div className={["rounded-[16px] border border-emerald-500/18 bg-[linear-gradient(180deg,rgba(19,42,28,0.92),rgba(8,17,11,0.96))] px-4 text-center font-mono font-semibold uppercase text-emerald-100/92 shadow-[0_0_26px_rgba(74,222,128,0.08)]", exportMode ? "mt-2 py-1.5 text-[8px] tracking-[0.14em]" : "mt-2.5 py-2 text-[8.5px] tracking-[0.16em]"].join(" ")}>
              SERIAL 001-{serialDate} • MINTED {mintedStamp}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
