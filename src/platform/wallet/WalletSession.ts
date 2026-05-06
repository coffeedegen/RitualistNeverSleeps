let connectedWalletAddress: string | null = null;
let connectedWalletProvider: string | null = null;
let connectedWalletXHandle: string | null = null;

/**
 * Lightweight in-memory wallet session used by the homepage and game loop.
 *
 * This gives the app a stable boundary for the connected wallet state without
 * coupling gameplay to a specific wallet implementation.
 */
export function getConnectedWalletAddress(): string | null {
  return connectedWalletAddress;
}

export function getConnectedWalletProvider(): string | null {
  return connectedWalletProvider;
}

export function getConnectedWalletXHandle(): string | null {
  return connectedWalletXHandle;
}

export function clearWalletSession(): void {
  connectedWalletAddress = null;
  connectedWalletProvider = null;
  connectedWalletXHandle = null;
}

export function setWalletSession(
  address: string,
  provider: string,
  xHandle: string | null = null,
): void {
  connectedWalletAddress = address;
  connectedWalletProvider = provider;
  connectedWalletXHandle = xHandle;
}
