import "./homepage/homepage.css";
import {
  connectMockWallet,
  getConnectedWalletAddress,
} from "../platform/wallet/WalletSession";
import {
  openLeaderboardModal,
  openSettingsModal,
} from "./homepage/homepageModals";
import {
  renderMainMenuScreen,
} from "./homepage/homepageScreens";

export interface HomepageCallbacks {
  onInitiateRitual: () => void;
}

export class Homepage {
  private readonly overlay: HTMLDivElement;
  private walletAddress: string | null = null;
  private callbacks: HomepageCallbacks;
  private readonly openModals: HTMLDivElement[] = [];

  constructor(callbacks: HomepageCallbacks) {
    this.callbacks = callbacks;
    this.overlay = document.createElement("div");
    this.overlay.id = "homepage-overlay";
    this.walletAddress = getConnectedWalletAddress() ?? connectMockWallet("metamask");
    this.renderMainMenu();
    document.body.appendChild(this.overlay);
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
    this.overlay.remove();
  }
}
