import { formatRunDuration } from "../../utils/time";
import {
  loadLeaderboard,
  type LeaderboardEntry,
} from "../../platform/leaderboard/LeaderboardStore";

export function openSettingsModal(): HTMLDivElement {
  const backdrop = document.createElement("div");
  backdrop.className = "hp-modal-backdrop";
  backdrop.innerHTML = `
      <div class="hp-modal">
        <button class="hp-modal-close" id="hp-settings-close">✕</button>
        <div class="hp-modal-title">⚙ SETTINGS</div>
        <div class="hp-setting-row">
          <label class="hp-setting-label">
            <span>Master Volume</span>
            <span id="hp-lbl-master">80%</span>
          </label>
          <input class="hp-slider" type="range" min="0" max="100" value="80" id="hp-slider-master" />
        </div>
        <div class="hp-setting-row">
          <label class="hp-setting-label">
            <span>SFX</span>
            <span id="hp-lbl-sfx">70%</span>
          </label>
          <input class="hp-slider" type="range" min="0" max="100" value="70" id="hp-slider-sfx" />
        </div>
        <div class="hp-setting-row">
          <label class="hp-setting-label">
            <span>Music</span>
            <span id="hp-lbl-music">60%</span>
          </label>
          <input class="hp-slider" type="range" min="0" max="100" value="60" id="hp-slider-music" />
        </div>
      </div>
    `;
  document.body.appendChild(backdrop);

  for (const [id, lblId] of [
    ["hp-slider-master", "hp-lbl-master"],
    ["hp-slider-sfx", "hp-lbl-sfx"],
    ["hp-slider-music", "hp-lbl-music"],
  ] as const) {
    backdrop.querySelector(`#${id}`)?.addEventListener("input", (e) => {
      const lbl = backdrop.querySelector(`#${lblId}`);
      if (lbl) {
        lbl.textContent = `${(e.target as HTMLInputElement).value}%`;
      }
    });
  }

  backdrop.querySelector("#hp-settings-close")?.addEventListener("click", () => {
    backdrop.remove();
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      backdrop.remove();
    }
  });

  return backdrop;
}

export function openLeaderboardModal(): HTMLDivElement {
  const board = loadLeaderboard();
  const medals = ["🥇", "🥈", "🥉"];
  const rowColors = ["#ffd700", "#c0c0c0", "#cd7f32"];

  const rows = board
    .map((entry: LeaderboardEntry, i) => {
      const color = rowColors[i] ?? "rgba(255,255,255,0.8)";
      const shortWallet =
        entry.wallet.length > 14
          ? `${entry.wallet.slice(0, 6)}...${entry.wallet.slice(-4)}`
          : entry.wallet;
      const rank = medals[i] ?? `#${i + 1}`;
      return `
        <tr style="color:${color}">
          <td class="hp-lb-rank" style="color:${color}">${rank}</td>
          <td style="font-family:monospace;color:${color}">${shortWallet}</td>
          <td style="text-align:center;color:rgba(255,255,255,0.5);font-size:12px">${entry.kills ?? "—"}</td>
          <td style="text-align:center;color:rgba(255,255,255,0.5);font-size:12px">${formatRunDuration(entry.survivedMs ?? 0)}</td>
          <td style="text-align:right;color:${color};font-weight:700">${entry.score.toLocaleString()}</td>
        </tr>
      `;
    })
    .join("");

  const backdrop = document.createElement("div");
  backdrop.className = "hp-modal-backdrop";
  backdrop.innerHTML = `
      <div class="hp-modal" style="max-width:560px">
        <button class="hp-modal-close" id="hp-lb-close">✕</button>
        <div class="hp-modal-title">🏆 LEADERBOARD</div>
        <table class="hp-lb-table" style="font-size:13px">
          <thead>
            <tr>
              <th>#</th>
              <th>Wallet</th>
              <th style="text-align:center">Kills</th>
              <th style="text-align:center">Time</th>
              <th style="text-align:right">Score</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:11px;color:rgba(255,255,255,0.25);text-align:center;margin-top:16px">
          Scores are saved locally. On-chain sync coming soon.
        </p>
      </div>
    `;
  document.body.appendChild(backdrop);

  backdrop.querySelector("#hp-lb-close")?.addEventListener("click", () => {
    backdrop.remove();
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      backdrop.remove();
    }
  });

  return backdrop;
}
