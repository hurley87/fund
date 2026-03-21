import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ── ABI ────────────────────────────────────────────────────────────────

export const MUTANT_ACCOUNTING_ABI = [
  {
    name: "recordDeposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "recordAllocation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "recordSettlement",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "pnl", type: "int256" },
    ],
    outputs: [],
  },
  {
    name: "recordWithdrawal",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "getBalance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getWithdrawable",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getHWM",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const satisfies Abi;

// ── Config ─────────────────────────────────────────────────────────────

const CONTRACT_ADDRESS = process.env
  .MUTANT_ACCOUNTING_ADDRESS as `0x${string}`;
const ORCHESTRATOR_PRIVATE_KEY = process.env
  .ORCHESTRATOR_PRIVATE_KEY as `0x${string}`;

// ── Clients ────────────────────────────────────────────────────────────

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

// ── Write Helpers ──────────────────────────────────────────────────────

export async function recordDeposit(agentId: bigint, amount: bigint) {
  return getWalletClient().writeContract({
    chain: base,
    address: CONTRACT_ADDRESS,
    abi: MUTANT_ACCOUNTING_ABI,
    functionName: "recordDeposit",
    args: [agentId, amount],
  });
}

export async function recordAllocation(agentId: bigint, amount: bigint) {
  return getWalletClient().writeContract({
    chain: base,
    address: CONTRACT_ADDRESS,
    abi: MUTANT_ACCOUNTING_ABI,
    functionName: "recordAllocation",
    args: [agentId, amount],
  });
}

export async function recordSettlement(agentId: bigint, pnl: bigint) {
  return getWalletClient().writeContract({
    chain: base,
    address: CONTRACT_ADDRESS,
    abi: MUTANT_ACCOUNTING_ABI,
    functionName: "recordSettlement",
    args: [agentId, pnl],
  });
}

export async function recordWithdrawal(agentId: bigint, amount: bigint) {
  return getWalletClient().writeContract({
    chain: base,
    address: CONTRACT_ADDRESS,
    abi: MUTANT_ACCOUNTING_ABI,
    functionName: "recordWithdrawal",
    args: [agentId, amount],
  });
}

// ── Read Helpers ───────────────────────────────────────────────────────

export async function getBalance(agentId: bigint): Promise<bigint> {
  return getPublicClient().readContract({
    address: CONTRACT_ADDRESS,
    abi: MUTANT_ACCOUNTING_ABI,
    functionName: "getBalance",
    args: [agentId],
  }) as Promise<bigint>;
}

export async function getWithdrawable(agentId: bigint): Promise<bigint> {
  return getPublicClient().readContract({
    address: CONTRACT_ADDRESS,
    abi: MUTANT_ACCOUNTING_ABI,
    functionName: "getWithdrawable",
    args: [agentId],
  }) as Promise<bigint>;
}

export async function getHWM(agentId: bigint): Promise<bigint> {
  return getPublicClient().readContract({
    address: CONTRACT_ADDRESS,
    abi: MUTANT_ACCOUNTING_ABI,
    functionName: "getHWM",
    args: [agentId],
  }) as Promise<bigint>;
}
