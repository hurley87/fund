import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Abi,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ── ABI (minimal) ─────────────────────────────────────────────────────

export const IDENTITY_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    name: "transferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "Transfer",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const satisfies Abi;

// ── Config ────────────────────────────────────────────────────────────

const REGISTRY_ADDRESS = (process.env.ERC8004_REGISTRY_ADDRESS ??
  "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432") as `0x${string}`;

const ORCHESTRATOR_PRIVATE_KEY = process.env
  .ORCHESTRATOR_PRIVATE_KEY as `0x${string}`;

// ── Clients ───────────────────────────────────────────────────────────

function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(),
  });
}

function getWalletClient() {
  const account = privateKeyToAccount(ORCHESTRATOR_PRIVATE_KEY);
  return createWalletClient({
    account,
    chain: base,
    transport: http(),
  });
}

// ── Exports ───────────────────────────────────────────────────────────

/**
 * Register an agent on the IdentityRegistry.
 * Returns the agentId (tokenId) from the transaction receipt.
 */
export async function registerAgent(agentURI: string): Promise<bigint> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    chain: base,
    address: REGISTRY_ADDRESS,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "register",
    args: [agentURI],
  });

  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });

  const logs = parseEventLogs({
    abi: IDENTITY_REGISTRY_ABI,
    eventName: "Transfer",
    logs: receipt.logs,
  });

  if (logs.length === 0) {
    throw new Error("No Transfer event found in register transaction");
  }

  return logs[0].args.tokenId;
}

/**
 * Transfer the agent NFT from the server wallet to another address.
 */
export async function transferNFT(
  to: string,
  agentId: bigint,
): Promise<`0x${string}`> {
  const wallet = getWalletClient();
  return wallet.writeContract({
    chain: base,
    address: REGISTRY_ADDRESS,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "transferFrom",
    args: [wallet.account.address, to as `0x${string}`, agentId],
  });
}

/**
 * Read the current owner of an agent NFT.
 */
export async function ownerOf(agentId: bigint): Promise<`0x${string}`> {
  return getPublicClient().readContract({
    address: REGISTRY_ADDRESS,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "ownerOf",
    args: [agentId],
  }) as Promise<`0x${string}`>;
}
