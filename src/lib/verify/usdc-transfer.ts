import { parseEventLogs } from "viem";
import { getPublicClient } from "@/lib/viem/clients";
import { env } from "@/lib/config/env";

export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const USDC_DECIMALS = 6;

const transferAbi = [
  {
    type: "event" as const,
    name: "Transfer" as const,
    inputs: [
      { name: "from", type: "address" as const, indexed: true },
      { name: "to", type: "address" as const, indexed: true },
      { name: "value", type: "uint256" as const, indexed: false },
    ],
  },
] as const;

export interface VerifiedTransfer {
  from: string;
  to: string;
  amount: number;
}

/**
 * Verify that a transaction transferred USDC to the treasury on Base.
 * Returns the verified transfer details or throws with a descriptive error.
 */
export async function verifyUsdcTransfer(
  txHash: string,
  expectedFrom: string
): Promise<VerifiedTransfer> {
  const client = getPublicClient();
  const treasury = env.treasuryAddress.toLowerCase();
  const fromLower = expectedFrom.toLowerCase();
  const usdcAddress = USDC_ADDRESS.toLowerCase();

  const receipt = await client.getTransactionReceipt({
    hash: txHash as `0x${string}`,
  });

  if (receipt.status !== "success") {
    throw new Error("Transaction failed on-chain");
  }

  const usdcLogs = receipt.logs.filter(
    (l) => l.address.toLowerCase() === usdcAddress
  );

  const transfers = parseEventLogs({
    abi: transferAbi,
    eventName: "Transfer",
    logs: usdcLogs,
  });

  const match = transfers.find(
    (t) =>
      t.args.to.toLowerCase() === treasury &&
      t.args.from.toLowerCase() === fromLower
  );

  if (!match) {
    throw new Error(
      "No matching USDC transfer to treasury found in this transaction"
    );
  }

  const amount = Number(match.args.value) / 10 ** USDC_DECIMALS;

  if (amount <= 0) {
    throw new Error("Transfer amount must be positive");
  }

  return {
    from: match.args.from.toLowerCase(),
    to: match.args.to.toLowerCase(),
    amount,
  };
}
