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
      <div class="hp-scene-shell">
        <div class="hp-scene-lamp hp-scene-lamp-left">
          <span class="hp-scene-lamp-chain"></span>
          <span class="hp-scene-lamp-bowl"></span>
          <span class="hp-scene-lamp-flame"></span>
        </div>
        <div class="hp-scene-lamp hp-scene-lamp-right">
          <span class="hp-scene-lamp-chain"></span>
          <span class="hp-scene-lamp-bowl"></span>
          <span class="hp-scene-lamp-flame"></span>
        </div>

        <div class="hp-scene-dressing hp-scene-bones-left"></div>
        <div class="hp-scene-dressing hp-scene-bones-right"></div>
        <div class="hp-scene-dressing hp-scene-coins-left"></div>
        <div class="hp-scene-dressing hp-scene-coins-right"></div>
        <div class="hp-scene-pillar hp-scene-pillar-left"></div>
        <div class="hp-scene-pillar hp-scene-pillar-right"></div>

        <section class="hp-tablet">
          <header class="hp-tablet-header">
            <div class="hp-logo-group hp-logo-group-tablet">
              <div class="hp-logo-glyph" aria-hidden="true">
                <img class="hp-logo-img" src="/assets/ui/ritual_logo.png" alt="Ritual"
                     onerror="this.style.cssText='display:none'" />
              </div>
              <div class="hp-logo-stack">
                <span class="hp-logo-name">RITUAL NETWORK</span>
                <span class="hp-logo-sub">Network Protocol</span>
              </div>
            </div>
            <div class="hp-wallet-badge hp-wallet-badge-tablet" aria-label="Wallet menu">
              <div class="hp-wallet-dot"></div>
              <div class="hp-wallet-lines">
                <span class="hp-wallet-label">Connected Wallet</span>
                <span class="hp-wallet-address">Address ${shortened}</span>
              </div>
            </div>
          </header>

          <div class="hp-tablet-body">
            <div class="hp-content-column">
              <section class="hp-title-panel">
                <div class="hp-kicker">Tech-Relic</div>
                <h1 class="hp-title">Ritualist Never Sleeps</h1>
                <p class="hp-subtitle">
                  Survive the horde. Chain your run. Mint your ritual card.
                </p>
                <div class="hp-status-row">
                  <div class="hp-status-chip">Live Chain: Ritual Testnet</div>
                  <div class="hp-status-chip">Chain 0x07bb / 1979</div>
                </div>
              </section>

              <section class="hp-radial-stage" aria-hidden="true">
                <div class="hp-radial-map">
                  <span class="hp-radial-ring hp-radial-ring-a"></span>
                  <span class="hp-radial-ring hp-radial-ring-b"></span>
                  <span class="hp-radial-ring hp-radial-ring-c"></span>
                  <span class="hp-radial-axis hp-radial-axis-h"></span>
                  <span class="hp-radial-axis hp-radial-axis-v"></span>
                  <span class="hp-radial-node hp-radial-node-1"></span>
                  <span class="hp-radial-node hp-radial-node-2"></span>
                  <span class="hp-radial-node hp-radial-node-3"></span>
                  <span class="hp-radial-node hp-radial-node-4"></span>
                  <span class="hp-radial-crack hp-radial-crack-1"></span>
                  <span class="hp-radial-crack hp-radial-crack-2"></span>
                </div>

                <div class="hp-cat-shrine">
                  <div class="hp-cat-sigil"></div>
                  <img class="hp-cat-avatar" src="/assets/characters/player/player_sprite_64x64.png" alt="Player Cat"
                       onerror="this.style.cssText='display:none'" />
                  <div class="hp-cat-eyes" aria-hidden="true"></div>
                </div>
              </section>
            </div>

            <aside class="hp-sidebar">
              <nav class="hp-menu-stack">
                <button class="hp-plinth-btn hp-plinth-btn-primary" id="hp-btn-play">
                  <span class="hp-plinth-rune">✦</span>
                  <span>Initiate Ritual</span>
                </button>
                <button class="hp-plinth-btn" id="hp-btn-settings">
                  <span class="hp-plinth-rune">⌘</span>
                  <span>Settings</span>
                </button>
                <button class="hp-plinth-btn" id="hp-btn-leaderboard">
                  <span class="hp-plinth-rune">⌬</span>
                  <span>Leaderboard</span>
                </button>
                <button class="hp-plinth-btn hp-plinth-btn-exit" id="hp-btn-exit">
                  <span class="hp-plinth-rune">✕</span>
                  <span>Exit</span>
                </button>
              </nav>

              <section class="hp-inventory-panel" aria-hidden="true">
                <div class="hp-panel-title">Arsenal</div>
                <div class="hp-grid-shell">
                  <span class="hp-grid-slot hp-weapon-lash"></span>
                  <span class="hp-grid-slot hp-weapon-arcane_bolt"></span>
                  <span class="hp-grid-slot hp-weapon-sanctum_cross"></span>
                  <span class="hp-grid-slot hp-weapon-rune_shard"></span>
                  <span class="hp-grid-slot hp-weapon-tempest_loop"></span>
                  <span class="hp-grid-slot hp-weapon-sigil_nova"></span>
                  <span class="hp-grid-slot hp-weapon-cleaver"></span>
                  <span class="hp-grid-slot hp-weapon-orbiting_tome"></span>
                  <span class="hp-grid-slot hp-weapon-inferno_burst"></span>
                  <span class="hp-grid-slot hp-weapon-deluge"></span>
                  <span class="hp-grid-slot hp-weapon-celestial_blade"></span>
                  <span class="hp-grid-slot hp-weapon-thousand_shards"></span>
                </div>
              </section>

              <section class="hp-inventory-panel" aria-hidden="true">
                <div class="hp-panel-title">Relics</div>
                <div class="hp-grid-shell">
                  <span class="hp-grid-slot hp-passive-echo_lens"></span>
                  <span class="hp-grid-slot hp-passive-graviton_seed"></span>
                  <span class="hp-grid-slot hp-passive-ascension_crown"></span>
                  <span class="hp-grid-slot hp-passive-fortune_leaf"></span>
                  <span class="hp-grid-slot hp-passive-gilded_mask"></span>
                  <span class="hp-grid-slot hp-passive-flare_lantern"></span>
                  <span class="hp-grid-slot hp-passive-hollow_tome"></span>
                  <span class="hp-grid-slot hp-passive-vessel_heart"></span>
                  <span class="hp-grid-slot hp-passive-ruby_root"></span>
                  <span class="hp-grid-slot hp-passive-bastion_plate"></span>
                  <span class="hp-grid-slot hp-passive-timeweave"></span>
                  <span class="hp-grid-slot hp-passive-ironleaf"></span>
                </div>
              </section>
            </aside>
          </div>

          <footer class="hp-tablet-footer" aria-hidden="true">
            <div class="hp-pedestal hp-pedestal-left">
              <span class="hp-pedestal-rune">ᚱ</span>
              <span class="hp-pedestal-rune">ᛟ</span>
            </div>
            <div class="hp-footer-sigil">
              <span class="hp-footer-sigil-core"></span>
              <span class="hp-footer-sigil-line hp-footer-sigil-line-a"></span>
              <span class="hp-footer-sigil-line hp-footer-sigil-line-b"></span>
            </div>
            <div class="hp-pedestal hp-pedestal-right">
              <span class="hp-pedestal-rune">ᛚ</span>
              <span class="hp-pedestal-rune">ᛞ</span>
            </div>
          </footer>
        </section>

        <div class="hp-frame-corners">
          <span class="hp-corner hp-corner-tl"></span>
          <span class="hp-corner hp-corner-tr"></span>
          <span class="hp-corner hp-corner-bl"></span>
          <span class="hp-corner hp-corner-br"></span>
        </div>
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
