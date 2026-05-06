let connectedWalletAddress: string | null = null;
let connectedWalletProvider: string | null = null;

/**
 * Lightweight in-memory wallet session used by the prototype homepage.
 *
 * This gives the app a stable boundary for later swapping in a real EVM wallet
 * connector without touching the game loop.
 */
export function connectMockWallet(provider: string): string {
  connectedWalletProvider = provider;
  connectedWalletAddress = generateMockAddress();
  return connectedWalletAddress;
}

export function getConnectedWalletAddress(): string | null {
  return connectedWalletAddress;
}

export function getConnectedWalletProvider(): string | null {
  return connectedWalletProvider;
}

export function clearWalletSession(): void {
  connectedWalletAddress = null;
  connectedWalletProvider = null;
}

function generateMockAddress(): string {
  const hex = "0123456789abcdef";
  let addr = "0x";
  for (let i = 0; i < 40; i += 1) {
    addr += hex[Math.floor(Math.random() * 16)];
  }
  return addr;
}
