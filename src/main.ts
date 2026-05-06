import "./style.css";
import { Game } from "./Game";
import { Debug } from "./utils/debug";
import { Homepage } from "./ui/Homepage";
import { Web3Manager, WalletConnectUI, WalletContext, type Web3WalletData } from "./web3";

const canvas = document.getElementById("game");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Expected a single <canvas id="game"> in index.html.');
}

const root: HTMLCanvasElement = canvas;

let homepage: Homepage | null = null;
let game: Game | null = null;
let walletConnectModal: WalletConnectUI | null = null;
let currentWallet: Web3WalletData | null = null;
let web3Manager: Web3Manager | null = null;

// Web3 wallet configuration
const WALLET_STORAGE_KEY = "ritual_wallet_data";

function initializeWeb3(): void {
  web3Manager = Web3Manager.getInstance({
    onAccountChanged: (accounts) => {
      Debug.log(`Account changed: ${accounts[0]}`);
      if (accounts.length === 0) {
        disconnectWallet();
      }
    },
    onChainChanged: (chainId) => {
      Debug.log(`Chain changed: ${chainId}`);
    },
    onDisconnected: () => {
      disconnectWallet();
    },
  });
}

function connectWallet(): void {
  if (!walletConnectModal) {
    walletConnectModal = new WalletConnectUI({
      onConnect: (walletData) => {
        currentWallet = walletData;
        localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(walletData));
        WalletContext.setWallet(walletData, web3Manager);
        Debug.log(`Wallet connected: ${walletData.address}`);
        updateUIWithWalletInfo();
        mountHomepage();
      },
      onError: (error) => {
        Debug.log(`Wallet connection error: ${error.message}`);
      },
    });
  }

  const modal = walletConnectModal.render();
  document.body.appendChild(modal);
  walletConnectModal.show();
}

function disconnectWallet(): void {
  currentWallet = null;
  localStorage.removeItem(WALLET_STORAGE_KEY);
  WalletContext.reset();
  if (web3Manager) {
    web3Manager.disconnect();
  }
  Debug.log("Wallet disconnected");
  updateUIWithWalletInfo();
  mountHomepage();
}

function updateUIWithWalletInfo(): void {
  // Remove existing wallet info display if any
  const existingWalletInfo = document.getElementById("wallet-info-header");
  if (existingWalletInfo) {
    existingWalletInfo.remove();
  }

  // Add wallet info header if connected
  if (currentWallet) {
    const headerDiv = document.createElement("div");
    headerDiv.id = "wallet-info-header";
    headerDiv.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      border: 1px solid rgba(246, 133, 27, 0.5);
      border-radius: 8px;
      padding: 12px 16px;
      color: #a0aec0;
      font-size: 12px;
      z-index: 9999;
      font-family: 'JetBrains Mono', monospace;
    `;

    const address = currentWallet.address.substring(0, 6) + "..." + currentWallet.address.substring(38);
    const chainName = currentWallet.chainId === 1 ? "Ethereum" : currentWallet.chainId === 11155111 ? "Sepolia" : `Chain ${currentWallet.chainId}`;

    headerDiv.innerHTML = `
      <div style="display: flex; gap: 12px; align-items: center;">
        <div>
          <div style="color: #f6851b; font-weight: 600;">Connected</div>
          <div>${address}</div>
          <div style="color: #7fe0a8; font-size: 11px;">${chainName}</div>
        </div>
        <button id="disconnect-wallet-btn" style="
          background: rgba(246, 133, 27, 0.2);
          border: 1px solid rgba(246, 133, 27, 0.5);
          color: #f6851b;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          transition: all 0.2s;
        ">Disconnect</button>
      </div>
    `;

    document.body.appendChild(headerDiv);

    const disconnectBtn = document.getElementById("disconnect-wallet-btn");
    if (disconnectBtn) {
      disconnectBtn.addEventListener("click", disconnectWallet);
      disconnectBtn.addEventListener("mouseover", function() {
        this.style.background = "rgba(246, 133, 27, 0.3)";
      });
      disconnectBtn.addEventListener("mouseout", function() {
        this.style.background = "rgba(246, 133, 27, 0.2)";
      });
    }
  }
}

function restoreWalletConnection(): void {
  const storedWallet = localStorage.getItem(WALLET_STORAGE_KEY);
  if (storedWallet) {
    try {
      const walletData = JSON.parse(storedWallet);
      currentWallet = walletData;
      WalletContext.setWallet(walletData, web3Manager);
      Debug.log(`Wallet restored from localStorage: ${walletData.address}`);
      updateUIWithWalletInfo();
    } catch (error) {
      Debug.log("Failed to restore wallet from localStorage");
      localStorage.removeItem(WALLET_STORAGE_KEY);
    }
  }
}

function mountHomepage(): void {
  game?.dispose();
  game = null;

  // Check if wallet is connected before showing homepage
  if (!currentWallet) {
    connectWallet();
    return;
  }

  homepage?.dispose();
  homepage = new Homepage({
    onInitiateRitual: () => {
      mountGame();
    },
  });

  Debug.log("homepage mounted");
}

function mountGame(): void {
  homepage?.dispose();
  homepage = null;

  game?.dispose();
  game = new Game(root, {
    onStartNewGame: () => {
      mountGame();
    },
    onBackToMainMenu: () => {
      mountHomepage();
    },
    onQuitConfirmed: () => {
      requestQuit();
    },
  });
  game.start();
  Debug.log("game started");
}

function requestQuit(): void {
  homepage?.dispose();
  homepage = null;

  game?.dispose();
  game = null;

  window.close();
  setTimeout(() => {
    if (!window.closed) {
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;
          background:#000;color:#00ff50;font-family:monospace;font-size:18px;text-align:center;padding:24px;">
          You may now close this tab.
        </div>`;
    }
  }, 0);
}

// Show homepage first. Game starts only after "Initiate Ritual" is clicked.
initializeWeb3();
restoreWalletConnection();
mountHomepage();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    homepage?.dispose();
    game?.dispose();
  });
}
