import { NextResponse } from "next/server";
import { ownerOf } from "@/lib/identity/erc8004";
import { getWithdrawable } from "@/lib/contract/accounting";
import { enqueue } from "@/lib/queue/tx-queue";
import { mutants, trades } from "@/lib/db/supabase";

export async function POST(request: Request) {
  let body: { agent_id: number; amount: number; signature: string; signer: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { agent_id, amount, signer } = body;

  if (!agent_id || !amount || !signer) {
    return NextResponse.json(
      { error: "Missing required fields: agent_id, amount, signer" },
      { status: 400 },
    );
  }

  if (amount <= 0) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }

  // Verify ownership (hackathon MVP: trust the signer field)
  const owner = await ownerOf(BigInt(agent_id));
  if (!owner || owner.toLowerCase() !== signer.toLowerCase()) {
    return NextResponse.json(
      { error: "Forbidden: signer is not the owner of this agent" },
      { status: 403 },
    );
  }

  // Check withdrawable balance
  const withdrawableMicro = await getWithdrawable(BigInt(agent_id));
  const withdrawable = Number(withdrawableMicro) / 1_000_000;
  if (amount > withdrawable) {
    return NextResponse.json(
      { error: `Insufficient withdrawable balance. Requested: ${amount}, Available: ${withdrawable}` },
      { status: 400 },
    );
  }

  // Check no open positions
  const mutant = await mutants.getByAgentId(agent_id);
  if (!mutant) {
    return NextResponse.json({ error: "Mutant not found" }, { status: 404 });
  }

  const allTrades = await trades.list(mutant.id);
  const openPositions = allTrades.filter((t) => t.exit_price == null && t.bankr_job_id != null);
  if (openPositions.length > 0) {
    return NextResponse.json(
      { error: `Cannot redeem while ${openPositions.length} position(s) are open.` },
      { status: 400 },
    );
  }

  // Queue withdrawal
  await enqueue("record_withdrawal", { agentId: agent_id, amount });

  // Update mutant bankroll
  const newBankroll = Math.max(0, (mutant.bankroll ?? 0) - amount);
  await mutants.update(mutant.id, { bankroll: newBankroll });

  return NextResponse.json({
    success: true,
    amount,
    remaining_bankroll: newBankroll,
  });
}
