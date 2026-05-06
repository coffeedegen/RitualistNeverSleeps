import { BrowserProvider, Signer, Contract, toBeHex } from "ethers";

export const SUPPORTED_CHAINS = {
  ETHEREUM_MAINNET: 1,
  SEPOLIA_TESTNET: 11155111,
};

export interface Web3WalletData {
  address: string;
  chainId: number;
  balance: string;
  provider: BrowserProvider | null;
  xHandle?: string | null;
}

export interface Web3ManagerConfig {
  requiredChainId?: number;
  onAccountChanged?: (accounts: string[]) => void;
  onChainChanged?: (chainId: string) => void;
  onConnected?: (walletData: Web3WalletData) => void;
  onDisconnected?: () => void;
}

export class Web3Manager {
  private static instance: Web3Manager;
  private provider: BrowserProvider | null = null;
  private signer: Signer | null = null;
  private userAddress: string | null = null;
  private chainId: number | null = null;
  private walletData: Web3WalletData | null = null;
  private config: Web3ManagerConfig = {};
  private isDisconnecting = false;

  private constructor(config?: Web3ManagerConfig) {
    this.config = config || {};
    this.setupListeners();
  }

  static getInstance(config?: Web3ManagerConfig): Web3Manager {
    if (!Web3Manager.instance) {
      Web3Manager.instance = new Web3Manager(config);
    }
    return Web3Manager.instance;
  }

  private setupListeners(): void {
    if (!this.isMetaMaskAvailable()) return;

    const ethereum = (window as any).ethereum;

    ethereum.on("accountsChanged", (accounts: string[]) => {
      console.log("Accounts changed:", accounts);
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        this.userAddress = accounts[0] || null;
        this.config.onAccountChanged?.(accounts);
      }
    });

    ethereum.on("chainChanged", (chainId: string) => {
      console.log("Chain changed:", chainId);
      this.chainId = parseInt(chainId, 16);
      this.config.onChainChanged?.(chainId);
    });

    ethereum.on("disconnect", () => {
      this.disconnect();
    });
  }

  private isMetaMaskAvailable(): boolean {
    const ethereum = (window as any).ethereum;
    return ethereum && ethereum.isMetaMask === true;
  }

  async connectMetaMask(): Promise<Web3WalletData> {
    if (!this.isMetaMaskAvailable()) {
      throw new Error(
        "MetaMask is not installed. Please install MetaMask extension."
      );
    }

    try {
      const ethereum = (window as any).ethereum;

      // Request account access
      const accounts: string[] = await ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found.");
      }

      this.userAddress = accounts[0] || null;

      // Get chain ID
      const chainIdHex: string = await ethereum.request({
        method: "eth_chainId",
      });
      this.chainId = parseInt(chainIdHex, 16);

      // Initialize provider and signer
      this.provider = new BrowserProvider(ethereum);
      this.signer = await this.provider.getSigner();

      // Get balance
      if (!this.userAddress) {
        throw new Error("Failed to get user address");
      }
      const balance = await this.provider.getBalance(this.userAddress);
      const balanceEth = balance.toString();

      this.walletData = {
        address: this.userAddress,
        chainId: this.chainId,
        balance: balanceEth,
        provider: this.provider,
      };

      console.log("MetaMask connected:", this.walletData);
      this.config.onConnected?.(this.walletData);

      return this.walletData;
    } catch (error: any) {
      const errorMessage = error.message || "Failed to connect MetaMask";
      console.error("MetaMask connection error:", errorMessage);
      throw new Error(errorMessage);
    }
  }

  disconnect(): void {
    if (this.isDisconnecting) return;
    this.isDisconnecting = true;

    this.provider = null;
    this.signer = null;
    this.userAddress = null;
    this.chainId = null;
    this.walletData = null;
    console.log("Wallet disconnected");

    try {
      this.config.onDisconnected?.();
    } finally {
      this.isDisconnecting = false;
    }
  }

  isConnected(): boolean {
    return this.userAddress !== null && this.provider !== null;
  }

  getWalletData(): Web3WalletData | null {
    return this.walletData;
  }

  getAddress(): string | null {
    return this.userAddress;
  }

  getChainId(): number | null {
    return this.chainId;
  }

  getProvider(): BrowserProvider | null {
    return this.provider;
  }

  getSigner(): Signer | null {
    return this.signer;
  }

  async getBalance(address?: string): Promise<string> {
    if (!this.provider) {
      throw new Error("Web3Manager not connected. Call connectMetaMask first.");
    }

    const targetAddress = address || this.userAddress;
    if (!targetAddress) {
      throw new Error("No address provided and user not connected.");
    }

    const balance = await this.provider.getBalance(targetAddress);
    return balance.toString();
  }

  async signMessage(message: string): Promise<string> {
    if (!this.signer) {
      throw new Error("Web3Manager not connected. Call connectMetaMask first.");
    }

    try {
      const signature = await this.signer.signMessage(message);
      return signature;
    } catch (error: any) {
      console.error("Message signing error:", error);
      throw new Error(error.message || "Failed to sign message");
    }
  }

  async callContract(
    contractAddress: string,
    contractAbi: any[],
    methodName: string,
    args: any[] = []
  ): Promise<any> {
    if (!this.provider) {
      throw new Error("Web3Manager not connected. Call connectMetaMask first.");
    }

    try {
      const contract = new Contract(contractAddress, contractAbi, this.provider);
      const method = (contract as any)[methodName];
      if (typeof method !== "function") {
        throw new Error(`Method ${methodName} not found in contract`);
      }
      const result = await method(...args);
      return result;
    } catch (error: any) {
      console.error(`Contract call error (${methodName}):`, error);
      throw new Error(
        error.message || `Failed to call contract method ${methodName}`
      );
    }
  }

  async writeContract(
    contractAddress: string,
    contractAbi: any[],
    methodName: string,
    args: any[] = [],
    value?: string
  ): Promise<any> {
    const tx = await this.writeContractTx(
      contractAddress,
      contractAbi,
      methodName,
      args,
      value,
    );
    return tx.wait();
  }

  async writeContractTx(
    contractAddress: string,
    contractAbi: any[],
    methodName: string,
    args: any[] = [],
    value?: string
  ): Promise<any> {
    if (!this.signer) {
      throw new Error("Web3Manager not connected. Call connectMetaMask first.");
    }

    try {
      const contract = new Contract(contractAddress, contractAbi, this.signer);
      const txOptions: any = {};

      if (value) {
        txOptions.value = toBeHex(value);
      }

      const method = (contract as any)[methodName];
      if (typeof method !== "function") {
        throw new Error(`Method ${methodName} not found in contract`);
      }
      const tx = await method(...args, txOptions);
      return tx;
    } catch (error: any) {
      console.error(`Contract write error (${methodName}):`, error);
      throw new Error(
        error.message || `Failed to write to contract method ${methodName}`
      );
    }
  }

  async switchNetwork(chainId: number): Promise<void> {
    if (!this.isMetaMaskAvailable()) {
      throw new Error("MetaMask is not available.");
    }

    try {
      const ethereum = (window as any).ethereum;
      const chainIdHex = toBeHex(chainId);

      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });

      this.chainId = chainId;
    } catch (error: any) {
      if (error.code === 4902) {
        throw new Error(
          `Chain ${chainId} not found in MetaMask. Please add it manually.`
        );
      }
      throw new Error(
        error.message || `Failed to switch to chain ${chainId}`
      );
    }
  }
}

export default Web3Manager;
