import { getAddress, isAddress, type TransactionReceipt } from "ethers";
import type { RunCardSummary } from "../../systems/RunCardRenderer";
import type { Web3Manager, Web3WalletData } from "../../web3";

interface MintConfig {
  contractAddress: string;
  requiredChainId: number | null;
  methodName: string;
  methodSignature: string;
}

export interface MintSubmission {
  txHash: string;
  waitForReceipt: () => Promise<TransactionReceipt>;
}

function readMintConfig(): MintConfig {
  const contractAddress = (import.meta.env.VITE_RITUAL_MINT_CONTRACT_ADDRESS ?? "").trim();
  const methodName = (import.meta.env.VITE_RITUAL_MINT_METHOD_NAME ?? "mintRunCard").trim();
  const methodSignature = (import.meta.env.VITE_RITUAL_MINT_METHOD_SIGNATURE ?? "mintRunCard(string payload)").trim();
  const chainRaw = (import.meta.env.VITE_RITUAL_MINT_CHAIN_ID ?? "").trim();
  const parsedChain = chainRaw.length > 0 ? Number.parseInt(chainRaw, 10) : Number.NaN;
  const requiredChainId = Number.isFinite(parsedChain) ? parsedChain : null;

  if (!contractAddress) {
    throw new Error("Missing `VITE_RITUAL_MINT_CONTRACT_ADDRESS`.");
  }
  if (!isAddress(contractAddress)) {
    throw new Error(
      "Invalid `VITE_RITUAL_MINT_CONTRACT_ADDRESS`. Use a deployed 0x... contract address (not a name/ENS).",
    );
  }
  if (!methodName) {
    throw new Error("Missing `VITE_RITUAL_MINT_METHOD_NAME`.");
  }
  if (!methodSignature) {
    throw new Error("Missing `VITE_RITUAL_MINT_METHOD_SIGNATURE`.");
  }

  return {
    contractAddress: getAddress(contractAddress),
    requiredChainId,
    methodName,
    methodSignature,
  };
}

export function getMintPreflightIssue(): string | null {
  try {
    readMintConfig();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Mint config is invalid.";
  }
}

function buildMintPayload(summary: RunCardSummary): string {
  return JSON.stringify({
    schema: "ritualist-never-sleeps.run-card.v1",
    serialNumber: summary.serialNumber,
    capturedAt: summary.capturedAt,
    rankTitle: summary.rankTitle,
    displayName: summary.displayName,
    xHandle: summary.xHandle,
    score: summary.score,
    kills: summary.kills,
    survivedMs: summary.survivedMs,
    level: summary.level,
    skills: summary.skills.map((skill) => ({
      label: skill.label,
      level: skill.level,
      kind: skill.kind,
    })),
    enemyKills: summary.enemyKills.map((entry) => ({
      label: entry.label,
      count: entry.count,
    })),
  });
}

async function ensureChain(
  manager: Web3Manager,
  wallet: Web3WalletData,
  requiredChainId: number | null,
): Promise<void> {
  if (requiredChainId === null || wallet.chainId === requiredChainId) {
    return;
  }
  await manager.switchNetwork(requiredChainId);
}

export async function submitRunCardMintOnRitual(
  summary: RunCardSummary,
  wallet: Web3WalletData | null,
  manager: Web3Manager | null,
): Promise<MintSubmission> {
  if (!wallet || !manager) {
    throw new Error("Wallet is not connected.");
  }

  const config = readMintConfig();
  await ensureChain(manager, wallet, config.requiredChainId);

  const payload = buildMintPayload(summary);
  const tx = await manager.writeContractTx(
    config.contractAddress,
    [`function ${config.methodSignature}`],
    config.methodName,
    [payload],
  );

  return {
    txHash: tx.hash ?? "unknown",
    waitForReceipt: () => tx.wait() as Promise<TransactionReceipt>,
  };
}
