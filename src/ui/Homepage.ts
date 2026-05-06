import "./homepage/homepage.css";
import {
  openLeaderboardModal,
  openSettingsModal,
} from "./homepage/homepageModals";
import {
  renderMainMenuScreen,
} from "./homepage/homepageScreens";
import { WalletContext } from "../web3/WalletContext";

export interface HomepageCallbacks {
  onInitiateRitual: () => void;
  onDisconnectWallet: () => void;
}

export class Homepage {
  private readonly overlay: HTMLDivElement;
  private walletAddress: string | null = null;
  private callbacks: HomepageCallbacks;
  private readonly openModals: HTMLDivElement[] = [];
  private walletMenu: HTMLDivElement | null = null;
  private readonly onDocumentClick = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (this.walletMenu && target && !this.walletMenu.contains(target)) {
      const badge = this.overlay.querySelector(".hp-wallet-badge");
      if (badge && !badge.contains(target)) {
        this.closeWalletMenu();
      }
    }
  };

  constructor(callbacks: HomepageCallbacks) {
    this.callbacks = callbacks;
    this.overlay = document.createElement("div");
    this.overlay.id = "homepage-overlay";
    this.walletAddress = WalletContext.getAddress() ?? null;
    this.renderMainMenu();
    document.body.appendChild(this.overlay);
    this.attachWalletMenu();
  }

  private renderMainMenu(): void {
    renderMainMenuScreen(this.overlay, this.walletAddress ?? "", {
      onPlay: () => {
        this.startGame();
      },
      onSettings: () => {
        this.openSettings();
      },
      onLeaderboard: () => {
        this.openLeaderboard();
      },
      onExit: () => {
        this.exitGame();
      },
    });
  }

  private openSettings(): void {
    this.trackModal(openSettingsModal());
  }

  private openLeaderboard(): void {
    this.trackModal(openLeaderboardModal());
  }

  refreshWalletAddress(): void {
    this.walletAddress = WalletContext.getAddress() ?? null;
    this.renderMainMenu();
    this.attachWalletMenu();
  }

  private closeWalletMenu(): void {
    this.walletMenu?.remove();
    this.walletMenu = null;
  }

  private attachWalletMenu(): void {
    const walletBadge = this.overlay.querySelector(".hp-wallet-badge");
    if (!(walletBadge instanceof HTMLElement)) return;

    walletBadge.setAttribute("role", "button");
    walletBadge.setAttribute("tabindex", "0");
    walletBadge.style.cursor = "pointer";

    const openMenu = () => {
      if (this.walletMenu) {
        this.closeWalletMenu();
        return;
      }

      const menu = document.createElement("div");
      menu.className = "hp-wallet-menu";
      menu.innerHTML = `
        <div class="hp-wallet-menu-header">
          <div class="hp-wallet-menu-title">Ritual Wallet</div>
          <div class="hp-wallet-menu-subtitle">Account controls</div>
        </div>
        <div class="hp-wallet-menu-preview">
          <span class="hp-wallet-menu-pill">Active</span>
          <span class="hp-wallet-menu-address">${this.walletAddress ?? "0xGuest"}</span>
        </div>
        <button class="hp-wallet-menu-item" id="hp-wallet-disconnect">
          Disconnect wallet
        </button>
      `;
      document.body.appendChild(menu);

      const rect = walletBadge.getBoundingClientRect();
      menu.style.left = `${Math.max(12, rect.left)}px`;
      menu.style.top = `${rect.bottom + 10}px`;

      menu.querySelector("#hp-wallet-disconnect")?.addEventListener("click", () => {
        this.closeWalletMenu();
        this.callbacks.onDisconnectWallet();
      });

      this.walletMenu = menu;
      requestAnimationFrame(() => {
        menu.classList.add("hp-wallet-menu-open");
      });
    };

    walletBadge.addEventListener("click", (event) => {
      event.stopPropagation();
      openMenu();
    });

    document.removeEventListener("click", this.onDocumentClick);
    document.addEventListener("click", this.onDocumentClick);
  }

  private startGame(): void {
    this.closeModals();
    this.overlay.style.transition = "opacity 0.5s ease";
    this.overlay.style.opacity = "0";
    setTimeout(() => {
      this.overlay.remove();
      this.callbacks.onInitiateRitual();
    }, 500);
  }

  private exitGame(): void {
    this.closeModals();
    window.close();
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;
        background:#000;color:#00ff50;font-family:monospace;font-size:18px;">
        You may now close this tab.
      </div>`;
  }

  private trackModal(backdrop: HTMLDivElement): void {
    this.openModals.push(backdrop);
    this.openModals.splice(
      0,
      this.openModals.length,
      ...this.openModals.filter((modal) => modal.isConnected),
    );
  }

  private closeModals(): void {
    for (const modal of this.openModals) {
      modal.remove();
    }
    this.openModals.length = 0;
  }

  dispose(): void {
    this.closeModals();
    document.removeEventListener("click", this.onDocumentClick);
    this.closeWalletMenu();
    this.overlay.remove();
  }
}
