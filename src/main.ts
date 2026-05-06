import "./style.css";
import { Game } from "./Game";
import { Debug } from "./utils/debug";
import { Homepage } from "./ui/Homepage";
import { BrowserProvider } from "ethers";
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
const MINT_WALLET_APPROVAL_TIMEOUT_MS = 20_000;

// Web3 wallet configuration
const WALLET_STORAGE_KEY = "ritual_wallet_data";
type PersistedWalletData = Pick<Web3WalletData, "address" | "chainId" | "balance"> & {
  mode: "metamask";
  xHandle?: string | null;
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
  const walletTopOffset = currentWallet ? 110 : 10;
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
      if (mintInFlight) {
        window.alert("Mint request is already in progress.");
        return;
      }

      mintInFlight = true;
      window.alert("Preparing mint transaction.\nWaiting for wallet approval...");

      const submissionPromise = submitRunCardMintOnRitual(summary, currentWallet, web3Manager);
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = window.setTimeout(() => {
          reject(
            new Error(
              "Wallet approval timed out. Please open MetaMask and approve the transaction.",
            ),
          );
        }, MINT_WALLET_APPROVAL_TIMEOUT_MS);
        submissionPromise.finally(() => {
          window.clearTimeout(timer);
        });
      });

      void Promise.race([submissionPromise, timeoutPromise])
        .then(async (submission) => {
          window.alert(`Transaction submitted.\nTx hash: ${submission.txHash}\nWaiting for confirmation...`);
          const receipt = await submission.waitForReceipt();
          const txHash = receipt.hash ?? submission.txHash ?? "unknown";
          console.info("Mint confirmed:", txHash, receipt);
          window.alert(`Mint succeeded.\nTx hash: ${txHash}`);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Mint failed.";
          console.error("Mint failed:", error);
          window.alert(`Mint failed: ${message}`);
        })
        .finally(() => {
          mintInFlight = false;
        });
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
async function bootstrap(): Promise<void> {
  initializeWeb3();
  const mintIssue = getMintPreflightIssue();
  if (mintIssue) {
    console.warn("[mint-preflight]", mintIssue);
  }
  await restoreWalletConnection();
  mountHomepage();
}

void bootstrap();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    homepage?.dispose();
    game?.dispose();
  });
}
