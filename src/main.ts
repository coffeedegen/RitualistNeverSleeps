import "./style.css";
import { Game } from "./Game";
import { Debug } from "./utils/debug";
import { Homepage } from "./ui/Homepage";
import { computeHudTopStripMetrics } from "./ui/HUD";
import { BrowserProvider } from "ethers";
import { createAppKit } from "@reown/appkit";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain } from "viem";
import { Web3Manager, WalletConnectUI, WalletContext, type Web3WalletData } from "./web3";
import { clearWalletSession, setWalletSession } from "./platform/wallet/WalletSession";
import {
  loadPlayerProfile,
  savePlayerProfile,
} from "./platform/profile/ProfileStore";
import {
  getMintPreflightIssue,
  submitRunCardMintOnRitual,
} from "./platform/mint/RitualMint";

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
let mintInFlight = false;
let mintPreflightIssue: string | null = null;
let walletHeaderResizeRaf = 0;
type DebugLaunchMode = "none" | "gameover" | "levelup";
function resolveDebugLaunchMode(): DebugLaunchMode {
  if (!import.meta.env.DEV) {
    return "none";
  }
  const mode = new URLSearchParams(window.location.search).get("debug")?.trim().toLowerCase();
  if (mode === "gameover") {
    return "gameover";
  }
  if (mode === "levelup") {
    return "levelup";
  }
  return "none";
}
const DEBUG_LAUNCH_MODE = resolveDebugLaunchMode();
const WALLETCONNECT_PROJECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "").trim();

// Ritual Testnet definition used by Reown AppKit + Wagmi adapter.
export const ritualTestnet = defineChain({
  id: 1979,
  name: "Ritual",
  nativeCurrency: {
    decimals: 18,
    name: "RITUAL",
    symbol: "RITUAL",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.ritualfoundation.org"],
      webSocket: ["wss://rpc.ritualfoundation.org/ws"],
    },
    public: {
      http: ["https://rpc.ritualfoundation.org"],
    },
  },
  blockExplorers: {
    default: { name: "Ritual Explorer", url: "https://explorer.ritualfoundation.org" },
  },
  testnet: true,
});

// Web3 wallet configuration
const WALLET_STORAGE_KEY = "ritual_wallet_data";
type PersistedWalletData = Pick<Web3WalletData, "address" | "chainId" | "balance"> & {
  mode: "metamask";
  xHandle?: string | null;
};

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getConnectedWalletPanelTopOffset(): number {
  const layout = computeHudTopStripMetrics(window.innerWidth, window.innerHeight);
  const gapByBucket = layout.compact ? 8 : layout.tight ? 10 : 12;
  return clampInt(layout.topStripBottom + gapByBucket, 96, 220);
}

function showUiNotice(message: string, tone: "info" | "success" | "error" = "info"): void {
  const existing = document.getElementById("ritual-ui-notice");
  if (existing) {
    existing.remove();
  }

  const notice = document.createElement("div");
  notice.id = "ritual-ui-notice";
  const palette = tone === "success"
    ? { border: "rgba(65, 211, 124, 0.65)", text: "#9af3bf", bg: "rgba(8, 22, 14, 0.92)" }
    : tone === "error"
      ? { border: "rgba(255, 107, 122, 0.65)", text: "#ffd2d8", bg: "rgba(28, 8, 14, 0.92)" }
      : { border: "rgba(138, 164, 255, 0.55)", text: "#dbe4ff", bg: "rgba(9, 14, 28, 0.92)" };

  notice.style.cssText = `
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 26px;
    max-width: min(86vw, 780px);
    padding: 10px 16px;
    border-radius: 12px;
    border: 1px solid ${palette.border};
    background: ${palette.bg};
    color: ${palette.text};
    font: 600 12px 'JetBrains Mono', monospace;
    letter-spacing: 0.18px;
    z-index: 10001;
    box-shadow: 0 14px 30px rgba(0,0,0,0.36);
    pointer-events: none;
    backdrop-filter: blur(8px);
    text-align: center;
    white-space: pre-wrap;
  `;
  notice.textContent = message;
  document.body.appendChild(notice);

  window.setTimeout(() => {
    if (notice.parentElement) {
      notice.remove();
    }
  }, tone === "error" ? 5200 : 3600);
}

const onViewportResize = (): void => {
  if (walletHeaderResizeRaf !== 0) {
    cancelAnimationFrame(walletHeaderResizeRaf);
  }
  walletHeaderResizeRaf = requestAnimationFrame(() => {
    walletHeaderResizeRaf = 0;
    if (document.getElementById("wallet-info-header")) {
      updateUIWithWalletInfo();
    }
  });
};

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

function initializeAppKit(): void {
  if (!WALLETCONNECT_PROJECT_ID) {
    console.warn("[appkit] Missing `VITE_WALLETCONNECT_PROJECT_ID`. Skipping AppKit initialization.");
    return;
  }

  const wagmiAdapter = new WagmiAdapter({
    projectId: WALLETCONNECT_PROJECT_ID,
    networks: [ritualTestnet],
  });

  createAppKit({
    adapters: [wagmiAdapter],
    networks: [ritualTestnet],
    projectId: WALLETCONNECT_PROJECT_ID,
    metadata: {
      name: "Ritualist Never Sleeps",
      description: "A Vanilla TS dApp on Ritual",
      url: window.location.origin,
      icons: ["https://avatars.githubusercontent.com/u/37784886"],
    },
  });
}

function connectWallet(): void {
  if (!walletConnectModal) {
    walletConnectModal = new WalletConnectUI({
      onConnect: (walletData) => {
        currentWallet = walletData;
        setWalletSession(walletData.address, "metamask", walletData.xHandle ?? null);
        const persistedWallet: PersistedWalletData = {
          address: walletData.address,
          chainId: walletData.chainId,
          balance: walletData.balance,
          mode: "metamask",
          xHandle: walletData.xHandle ?? null,
        };
        localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(persistedWallet));
        savePlayerProfile({ xHandle: walletData.xHandle ?? null });
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
  clearWalletSession();
  WalletContext.reset();
  if (web3Manager) {
    web3Manager.disconnect();
  }
  Debug.log("Wallet disconnected");
  updateUIWithWalletInfo();
  homepage?.dispose();
  homepage = null;
  mountHomepage();
}

function updateUIWithWalletInfo(): void {
  // Remove existing wallet info display if any
  const existingWalletInfo = document.getElementById("wallet-info-header");
  if (existingWalletInfo) {
    existingWalletInfo.remove();
  }

  const headerDiv = document.createElement("div");
  headerDiv.id = "wallet-info-header";
  const walletTopOffset = currentWallet ? getConnectedWalletPanelTopOffset() : 10;
  headerDiv.style.cssText = `
    position: fixed;
    top: ${walletTopOffset}px;
    right: 10px;
    background: rgba(0, 0, 0, 0.84);
    border: 1px solid rgba(127, 224, 168, 0.28);
    border-radius: 14px;
    padding: 10px 14px;
    color: #a0aec0;
    font-size: 12px;
    z-index: 9999;
    font-family: 'JetBrains Mono', monospace;
    min-width: 210px;
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(10px);
  `;

  const isConnected = currentWallet !== null;
  const address = isConnected
    ? `${currentWallet!.address.substring(0, 6)}...${currentWallet!.address.substring(38)}`
    : "No wallet connected";
  const chainName = isConnected
    ? currentWallet!.chainId === 1
      ? "Ethereum"
      : currentWallet!.chainId === 11155111
        ? "Sepolia"
        : `Chain ${currentWallet!.chainId}`
    : "Connect MetaMask to enter";
  const mintReady = mintPreflightIssue === null;
  const mintStatusLabel = mintReady ? "Mint ready" : "Mint unavailable";
  const mintStatusColor = mintReady ? "#7fe0a8" : "#f5ae7e";
  const mintStatusDetail = mintReady
    ? "Config OK"
    : mintPreflightIssue ?? "Invalid mint configuration";

  headerDiv.innerHTML = `
    <div style="display: flex; gap: 12px; align-items: center; justify-content: space-between;">
      <div style="display:flex; gap:10px; align-items:center; min-width:0;">
        <div style="
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: ${isConnected ? "#00ff50" : "#708090"};
          box-shadow: ${isConnected ? "0 0 8px #00ff50, 0 0 16px rgba(0,255,80,0.35)" : "none"};
          animation: ${isConnected ? "walletPulse 2s ease-in-out infinite" : "none"};
          flex-shrink: 0;
          margin-top: 2px;
        "></div>
        <div style="min-width:0;">
          <div style="color: ${isConnected ? "#7fe0a8" : "#a0aec0"}; font-weight: 700; letter-spacing: 0.4px;">
            ${isConnected ? "Connected" : "No wallet connected"}
          </div>
          <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 170px;">
            ${address}
          </div>
          <div style="color: ${isConnected ? "#7fe0a8" : "rgba(160,174,192,0.7)"}; font-size: 11px;">
            ${chainName}
          </div>
          <div style="margin-top: 5px; color: ${mintStatusColor}; font-size: 11px; line-height: 1.25;">
            ${mintStatusLabel}
          </div>
          <div style="color: rgba(160,174,192,0.8); font-size: 10px; line-height: 1.25; white-space: normal; max-width: 170px;">
            ${mintStatusDetail}
          </div>
        </div>
      </div>
      ${isConnected ? `
        <button id="disconnect-wallet-btn" style="
          background: rgba(246, 133, 27, 0.18);
          border: 1px solid rgba(246, 133, 27, 0.45);
          color: #f6851b;
          padding: 6px 10px;
          border-radius: 999px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
          transition: all 0.2s;
        ">Disconnect</button>
      ` : ""}
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
      this.style.background = "rgba(246, 133, 27, 0.18)";
    });
  }
}

async function restoreWalletConnection(): Promise<void> {
  const storedWallet = localStorage.getItem(WALLET_STORAGE_KEY);
  if (storedWallet) {
    try {
      const walletData = JSON.parse(storedWallet) as PersistedWalletData;
      const profile = loadPlayerProfile();
      const ethereum = (window as any).ethereum;

      if (!ethereum || ethereum.isMetaMask !== true) {
        localStorage.removeItem(WALLET_STORAGE_KEY);
        return;
      }

      const accounts: string[] = await ethereum.request({
        method: "eth_accounts",
      });
      const chainIdHex: string = await ethereum.request({
        method: "eth_chainId",
      });
      const activeChainId = parseInt(chainIdHex, 16);
      const activeAddress = accounts[0]?.toLowerCase();
      const storedAddress = walletData.address.toLowerCase();

      if (
        !activeAddress ||
        activeAddress !== storedAddress ||
        activeChainId !== walletData.chainId
      ) {
        localStorage.removeItem(WALLET_STORAGE_KEY);
        return;
      }

      const provider = new BrowserProvider(ethereum);
      await provider.getSigner();
      const balance = await provider.getBalance(walletData.address);
      currentWallet = {
        address: walletData.address,
        chainId: walletData.chainId,
        balance: balance.toString(),
        provider,
        xHandle: walletData.xHandle ?? profile.xHandle,
      };
      setWalletSession(walletData.address, "metamask", currentWallet.xHandle ?? null);
      savePlayerProfile({ xHandle: currentWallet.xHandle ?? null });
      WalletContext.setWallet(currentWallet, web3Manager);
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

  if (DEBUG_LAUNCH_MODE !== "none") {
    mountGame();
    return;
  }

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
    onDisconnectWallet: () => {
      disconnectWallet();
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
    onMintCard: (summary) => {
      if (mintPreflightIssue) {
        showUiNotice(`Mint unavailable: ${mintPreflightIssue}`, "error");
        return;
      }

      if (mintInFlight) {
        showUiNotice("Mint request already in progress. Check MetaMask.", "info");
        return;
      }

      mintInFlight = true;
      showUiNotice("Open MetaMask to approve the mint transaction.", "info");

      void submitRunCardMintOnRitual(summary, currentWallet, web3Manager)
        .then(async (submission) => {
          showUiNotice("Transaction submitted. Waiting for confirmation...", "info");
          const receipt = await submission.waitForReceipt();
          const txHash = receipt.hash ?? submission.txHash ?? "unknown";
          console.info("Mint confirmed:", txHash, receipt);
          showUiNotice(`Mint succeeded.\nTx: ${txHash}`, "success");
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Mint failed.";
          console.error("Mint failed:", error);
          showUiNotice(`Mint failed: ${message}`, "error");
        })
        .finally(() => {
          mintInFlight = false;
        });
    },
    isMintEnabled: () => mintPreflightIssue === null,
    getMintDisabledReason: () => mintPreflightIssue,
  });
  game.start();
  if (DEBUG_LAUNCH_MODE === "gameover") {
    game.debugOpenGameOverOverlay();
  } else if (DEBUG_LAUNCH_MODE === "levelup") {
    game.debugOpenLevelUpOverlay();
  }
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
async function bootstrap(): Promise<void> {
  window.addEventListener("resize", onViewportResize);
  initializeAppKit();
  initializeWeb3();
  mintPreflightIssue = getMintPreflightIssue();
  if (mintPreflightIssue) {
    console.warn("[mint-preflight]", mintPreflightIssue);
  }
  await restoreWalletConnection();
  mountHomepage();
}

void bootstrap();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener("resize", onViewportResize);
    if (walletHeaderResizeRaf !== 0) {
      cancelAnimationFrame(walletHeaderResizeRaf);
      walletHeaderResizeRaf = 0;
    }
    homepage?.dispose();
    game?.dispose();
  });
}
