import { Web3Manager, type Web3WalletData } from "./Web3Manager";

/**
 * Wallet context utility to expose wallet data across the application
 * Allows game components to access wallet information if needed
 */
export class WalletContext {
  private static walletData: Web3WalletData | null = null;
  private static web3Manager: Web3Manager | null = null;
  private static listeners: Array<(wallet: Web3WalletData | null) => void> = [];

  static setWallet(
    walletData: Web3WalletData | null,
    web3Manager: Web3Manager | null
  ): void {
    this.walletData = walletData;
    this.web3Manager = web3Manager;
    this.notifyListeners();
  }

  static getWallet(): Web3WalletData | null {
    return this.walletData;
  }

  static getWeb3Manager(): Web3Manager | null {
    return this.web3Manager;
  }

  static isConnected(): boolean {
    return this.walletData !== null;
  }

  static getAddress(): string | null {
    return this.walletData?.address || null;
  }

  static getChainId(): number | null {
    return this.walletData?.chainId || null;
  }

  static subscribe(
    callback: (wallet: Web3WalletData | null) => void
  ): () => void {
    this.listeners.push(callback);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((listener) => listener !== callback);
    };
  }

  private static notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.walletData));
  }

  static reset(): void {
    this.walletData = null;
    this.web3Manager = null;
    this.listeners = [];
  }
}

export default WalletContext;
