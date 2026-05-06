import { Web3Manager, type Web3WalletData } from "./Web3Manager";

export interface WalletConnectUIConfig {
  onConnect: (walletData: Web3WalletData) => void;
  onError?: (error: Error) => void;
  containerId?: string;
}

export class WalletConnectUI {
  private container: HTMLDivElement | null = null;
  private config: WalletConnectUIConfig;
  private web3Manager: Web3Manager;
  private isConnecting = false;

  constructor(config: WalletConnectUIConfig) {
    this.config = config;
    this.web3Manager = Web3Manager.getInstance({
      onConnected: (walletData) => {
        this.config.onConnect(walletData);
        this.hide();
      },
    });
  }

  render(): HTMLDivElement {
    if (this.container) {
      return this.container;
    }

    this.container = document.createElement("div");
    this.container.id = this.config.containerId || "wallet-connect-modal";
    this.container.innerHTML = this.getModalHTML();
    this.attachEventListeners();

    return this.container;
  }

  private getModalHTML(): string {
    return `
      <div style="${this.getBackdropStyle()}">
        <div style="${this.getModalStyle()}">
          <div style="${this.getHeaderStyle()}">
            <h1 style="${this.getTitleStyle()}">Connect Wallet</h1>
            <p style="${this.getSubtitleStyle()}">Connect your MetaMask wallet to play</p>
          </div>

          <div id="wallet-error" style="${this.getErrorStyle()} display: none;">
            <span id="error-text" style="color: #ff6b6b; font-size: 14px;"></span>
          </div>

          <div style="${this.getButtonContainerStyle()}">
            <button 
              id="connect-metamask-btn" 
              style="${this.getButtonStyle()}"
            >
              <span style="${this.getButtonIconStyle()}">🦊</span>
              <span style="${this.getButtonTextStyle()}">
                Connect MetaMask
              </span>
            </button>
          </div>

          <div style="${this.getFooterStyle()}">
            <p style="${this.getFooterTextStyle()}">
              Don't have MetaMask?
              <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" 
                 style="${this.getLinkStyle()}">
                Install it here
              </a>
            </p>
          </div>

          <div id="loading-spinner" style="${this.getLoadingSpinnerStyle()} display: none;">
            <div style="${this.getSpinnerStyle()}"></div>
            <p style="${this.getLoadingTextStyle()}">Connecting...</p>
          </div>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    const connectBtn = this.container.querySelector(
      "#connect-metamask-btn"
    ) as HTMLButtonElement;
    if (connectBtn) {
      connectBtn.addEventListener("click", () => this.handleConnect());
    }
  }

  private async handleConnect(): Promise<void> {
    if (this.isConnecting) return;

    this.isConnecting = true;
    const connectBtn = this.container?.querySelector(
      "#connect-metamask-btn"
    ) as HTMLButtonElement;
    const errorDiv = this.container?.querySelector(
      "#wallet-error"
    ) as HTMLDivElement;
    const loadingSpinner = this.container?.querySelector(
      "#loading-spinner"
    ) as HTMLDivElement;
    const errorText = this.container?.querySelector(
      "#error-text"
    ) as HTMLSpanElement;

    try {
      if (connectBtn) connectBtn.disabled = true;
      if (loadingSpinner) loadingSpinner.style.display = "flex";
      if (errorDiv) errorDiv.style.display = "none";

      const walletData = await this.web3Manager.connectMetaMask();
      this.config.onConnect(walletData);
      this.hide();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to connect wallet";
      console.error("Wallet connection failed:", errorMessage);

      if (errorText) {
        errorText.textContent = errorMessage;
      }
      if (errorDiv) {
        errorDiv.style.display = "block";
      }

      this.config.onError?.(error);
    } finally {
      this.isConnecting = false;
      if (connectBtn) connectBtn.disabled = false;
      if (loadingSpinner) loadingSpinner.style.display = "none";
    }
  }

  show(): void {
    if (this.container) {
      this.container.style.display = "flex";
    }
  }

  hide(): void {
    if (this.container) {
      this.container.style.display = "none";
    }
  }

  dispose(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }

  // Styling methods
  private getBackdropStyle(): string {
    return `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    `;
  }

  private getModalStyle(): string {
    return `
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 16px;
      padding: 40px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 1px rgba(255, 255, 255, 0.1) inset;
      border: 1px solid rgba(255, 255, 255, 0.1);
      animation: slideIn 0.3s ease-out;
    `;
  }

  private getHeaderStyle(): string {
    return `
      text-align: center;
      margin-bottom: 30px;
    `;
  }

  private getTitleStyle(): string {
    return `
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.5px;
    `;
  }

  private getSubtitleStyle(): string {
    return `
      margin: 8px 0 0 0;
      font-size: 14px;
      color: #a0aec0;
      font-weight: 400;
    `;
  }

  private getErrorStyle(): string {
    return `
      background: rgba(255, 107, 107, 0.1);
      border: 1px solid rgba(255, 107, 107, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
      text-align: center;
    `;
  }

  private getButtonContainerStyle(): string {
    return `
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    `;
  }

  private getButtonStyle(): string {
    return `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 16px 24px;
      background: linear-gradient(135deg, #f6851b 0%, #f9a825 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(246, 133, 27, 0.3);
      font-family: inherit;
    ` + this.getHoverState();
  }

  private getHoverState(): string {
    return `
      `;
  }

  private getButtonIconStyle(): string {
    return `
      font-size: 20px;
      display: flex;
      align-items: center;
    `;
  }

  private getButtonTextStyle(): string {
    return `
      display: flex;
      align-items: center;
      font-family: inherit;
    `;
  }

  private getFooterStyle(): string {
    return `
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    `;
  }

  private getFooterTextStyle(): string {
    return `
      margin: 0;
      font-size: 13px;
      color: #a0aec0;
    `;
  }

  private getLinkStyle(): string {
    return `
      color: #f6851b;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s ease;
    `;
  }

  private getLoadingSpinnerStyle(): string {
    return `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    `;
  }

  private getSpinnerStyle(): string {
    return `
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.2);
      border-top: 3px solid #f6851b;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    `;
  }

  private getLoadingTextStyle(): string {
    return `
      margin: 0;
      font-size: 14px;
      color: #a0aec0;
      font-weight: 500;
    `;
  }
}

export default WalletConnectUI;
