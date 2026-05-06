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
      <div class="hp-connect-box">
        <img class="hp-connect-logo" src="/assets/ui/ritual_logo.png" alt="Ritual Logo"
             onerror="this.style.display='none'" />
        <div class="hp-connect-title">RITUAL SURVIVAL</div>
        <div class="hp-connect-sub">
          Bind a real MetaMask wallet to awaken the ritual.<br>
          Your progress and score are anchored on-chain.
        </div>
        <button class="hp-connect-btn" id="hp-connect-metamask">
          <span class="hp-wallet-icon">🦊</span>
          Connect with MetaMask
        </button>
        <button class="hp-connect-btn" id="hp-connect-walletconnect"
          style="background: linear-gradient(135deg, #1a1a40 0%, #2a2a60 100%); border-color: rgba(100,100,255,0.5);">
          <span class="hp-wallet-icon">🔗</span>
          Connect with WalletConnect
        </button>
        <div class="hp-connect-divider"></div>
        <div class="hp-connect-footer">
          By connecting, you agree to the Terms of Service.<br>
          Ritual Survival requires a real wallet connection.
        </div>
      </div>
    `;

  overlay.querySelector("#hp-connect-metamask")?.addEventListener("click", () => {
    onConnect("metamask");
  });
  overlay.querySelector("#hp-connect-walletconnect")?.addEventListener("click", () => {
    onConnect("walletconnect");
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

      <!-- Navbar -->
      <nav class="hp-navbar">
        <div class="hp-logo-group">
          <img class="hp-logo-img" src="/assets/ui/ritual_logo.png" alt="Ritual"
               onerror="this.style.cssText='display:none'" />
          <span class="hp-logo-name">RITUAL</span>
        </div>
        <div class="hp-wallet-badge" aria-label="Wallet menu">
          <div class="hp-wallet-dot"></div>
          Ritual Wallet &nbsp;
          <span style="color:#00ff50;font-family:monospace;letter-spacing:1px">${shortened}</span>
        </div>
      </nav>

      <!-- Title -->
      <h1 class="hp-title">
        Ritualist Never Sleeps
        <span class="hp-title-sub">Blockchain Survival</span>
      </h1>

      <!-- Buttons -->
      <nav class="hp-menu">
        <button class="hp-btn hp-btn-primary" id="hp-btn-play">⚔ &nbsp;Initiate Ritual</button>
        <button class="hp-btn" id="hp-btn-settings">⚙ &nbsp;Settings</button>
        <button class="hp-btn" id="hp-btn-leaderboard">🏆 &nbsp;Leaderboard</button>
        <button class="hp-btn hp-btn-exit" id="hp-btn-exit">✕ &nbsp;Exit Game</button>
      </nav>
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
