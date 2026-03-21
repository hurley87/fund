import { createPublicClient, createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const ORCHESTRATOR_PRIVATE_KEY = process.env
  .ORCHESTRATOR_PRIVATE_KEY as `0x${string}`;

export function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(),
  });
}

export function getWalletClient() {
  const account = privateKeyToAccount(ORCHESTRATOR_PRIVATE_KEY);
  return createWalletClient({
    account,
    chain: base,
    transport: http(),
  });
}
