import { NextResponse } from 'next/server';
import { mutants, deposits } from '@/lib/db/supabase';
import { verifyUsdcTransfer } from '@/lib/verify/usdc-transfer';
import { enqueue } from '@/lib/queue/tx-queue';

interface FundBody {
  payer_address: string;
  tx_hash: string;
}

export async function POST(request: Request) {
  let body: FundBody;
  try {
    body = (await request.json()) as FundBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payer = body.payer_address?.toLowerCase();
  const txHash = body.tx_hash;

  if (!payer || typeof body.payer_address !== 'string') {
    return NextResponse.json({ error: 'payer_address is required' }, { status: 400 });
  }
  if (!txHash || typeof txHash !== 'string') {
    return NextResponse.json({ error: 'tx_hash is required' }, { status: 400 });
  }

  try {
    // Parallel: check replay + find mutant
    const [existingDeposit, mutant] = await Promise.all([
      deposits.getByTxHash(txHash),
      mutants.getByOwner(payer),
    ]);

    if (existingDeposit) {
      return NextResponse.json(
        { error: 'This transaction has already been used for a deposit' },
        { status: 409 },
      );
    }
    if (!mutant) {
      return NextResponse.json(
        { error: 'No mutant found for this wallet. Use POST /api/invest to spawn one first.' },
        { status: 404 },
      );
    }
    if (mutant.lifecycle_status === 'axed') {
      return NextResponse.json(
        { error: 'Your mutant is axed. Use POST /api/invest with agent_id to revive it.' },
        { status: 400 },
      );
    }

    // Verify USDC transfer on-chain
    let amount: number;
    try {
      const transfer = await verifyUsdcTransfer(txHash, payer);
      amount = transfer.amount;
    } catch (err) {
      return NextResponse.json(
        { error: `Payment verification failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 400 },
      );
    }

    // Parallel: record deposit + update bankroll + queue on-chain
    const newBankroll = (mutant.bankroll ?? 0) + amount;
    const newHwm = Math.max(mutant.high_water_mark ?? 0, newBankroll);

    await Promise.all([
      deposits.insert({
        mutant_id: mutant.id,
        tx_hash: txHash,
        from_address: payer,
        amount,
        type: 'topup',
      }),
      mutants.update(mutant.id, {
        bankroll: newBankroll,
        high_water_mark: newHwm,
      }),
      enqueue('record_deposit', { agentId: mutant.agent_id ?? mutant.id, amount }),
    ]);

    return NextResponse.json({
      success: true,
      mutant_id: mutant.id,
      amount,
      bankroll: newBankroll,
    });
  } catch (err) {
    console.error('[fund] Unhandled error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
