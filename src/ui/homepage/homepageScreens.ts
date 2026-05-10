import { buildRuneDecor, shortenAddress } from "./homepageDecor";

export type WalletProviderId = "metamask" | "walletconnect";

export interface HomepageMenuCallbacks {
  onPlay: () => void;
  onSettings: () => void;
  onLeaderboard: () => void;
  onExit: () => void;
}

export function renderWalletConnectScreen(
  overlay: HTMLDivElement,
  onConnect: (provider: WalletProviderId) => void,
): void {
  overlay.innerHTML = `
      ${buildRuneDecor()}
      <div class="hp-shell hp-shell-connect">
        <div class="hp-connect-box">
          <div class="hp-connect-header">
            <img class="hp-connect-logo" src="/assets/ui/ritual_logo.png" alt="Ritual Logo"
                 onerror="this.style.display='none'" />
            <div>
              <div class="hp-connect-title">Ritualist Never Sleeps</div>
              <div class="hp-connect-subtitle">Wallet Required</div>
            </div>
          </div>
          <p class="hp-connect-sub">
            Connect a real MetaMask wallet to enter the ritual.
            Your run identity is used for minting and sharing.
          </p>
          <button class="hp-connect-btn" id="hp-connect-metamask">
            <span class="hp-wallet-icon">🦊</span>
            Connect MetaMask
          </button>
          <div class="hp-connect-divider"></div>
          <div class="hp-connect-footer">
            Real wallet mode is enabled for this build.
          </div>
        </div>
      </div>
    `;

  overlay.querySelector("#hp-connect-metamask")?.addEventListener("click", () => {
    onConnect("metamask");
  });
}

export function renderMainMenuScreen(
  overlay: HTMLDivElement,
  walletAddress: string,
  callbacks: HomepageMenuCallbacks,
): void {
  const shortened = shortenAddress(walletAddress);
  overlay.innerHTML = `
      ${buildRuneDecor()}
      <div class="hp-min-shell">
        <div class="hp-wallet-badge hp-wallet-badge-min" aria-label="Wallet menu">
          <div class="hp-wallet-dot"></div>
          <div class="hp-wallet-lines">
            <span class="hp-wallet-label">Connected Wallet</span>
            <span class="hp-wallet-address">${shortened}</span>
          </div>
        </div>

        <header class="hp-min-header">
          <div class="hp-min-kicker">Ritual Testnet</div>
          <h1 class="hp-min-title">Ritualist Never Sleeps</h1>
        </header>

        <section class="hp-instructions-panel" aria-labelledby="hp-howto-title">
          <div class="hp-instructions-frame"></div>
          <div class="hp-instructions-content">
            <h2 class="hp-instructions-title" id="hp-howto-title">HOW TO PLAY &amp; SURVIVE</h2>
            <ul class="hp-instructions-list">
              <li>WSAD or directional buttons to walk</li>
              <li>Level up by picking up the green orbs to fill up the experience bar.</li>
              <li>Choose among the randomized three skills upon leveling up.</li>
              <li>Pick up Field Ration to restore a portion of health.</li>
              <li>Pick up Chrono Seal to stop time.</li>
            </ul>
            <div class="hp-goal-block">
              <span class="hp-goal-label">PRIMARY GOAL</span>
              <p class="hp-goal-text">Try to reach the rank tier of Radiant Ritualist with a high score.</p>
            </div>
          </div>
        </section>

        <nav class="hp-menu-actions" aria-label="Main menu actions">
          <button class="hp-menu-button hp-menu-button-primary" id="hp-btn-play">Initiate Ritual</button>
          <button class="hp-menu-button" id="hp-btn-settings">Settings</button>
          <button class="hp-menu-button" id="hp-btn-leaderboard">Leaderboard</button>
          <button class="hp-menu-button hp-menu-button-exit" id="hp-btn-exit">Quit Game</button>
        </nav>
      </div>
    `;

  overlay.querySelector("#hp-btn-play")?.addEventListener("click", () => {
    callbacks.onPlay();
  });
  overlay.querySelector("#hp-btn-settings")?.addEventListener("click", () => {
    callbacks.onSettings();
  });
  overlay.querySelector("#hp-btn-leaderboard")?.addEventListener("click", () => {
    callbacks.onLeaderboard();
  });
  overlay.querySelector("#hp-btn-exit")?.addEventListener("click", () => {
    callbacks.onExit();
  });
}
