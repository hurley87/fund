import { txQueue, mutants } from '@/lib/db/supabase';
import type { TxQueueItem } from '@/lib/db/types';
import { registerAgent, transferNFT } from '@/lib/identity/erc8004';
import {
  recordDeposit as contractRecordDeposit,
  recordSettlement as contractRecordSettlement,
  recordWithdrawal as contractRecordWithdrawal,
} from '@/lib/contract/accounting';
import { parseUnits } from 'viem';

/**
 * Enqueue a new transaction for serial processing.
 * Returns the queue item id.
 */
export async function enqueue(
  type: string,
  payload: Record<string, unknown>
): Promise<string> {
  const item = await txQueue.insert({
    type,
    payload,
    status: 'pending',
  });
  return item.id;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mutantfund.vercel.app';

/**
 * Execute the onchain action for a given tx type.
 */
async function executeTx(
  item: TxQueueItem
): Promise<{ txHash: string }> {
  const type = item.type ?? 'unknown';
  const payload = item.payload ?? {};

  switch (type) {
    case 'register': {
      // payload: { mutantId: string }
      const mutantId = payload.mutantId as string;
      const agentURI = `${APP_URL}/api/mutants/${mutantId}/registration.json`;

      console.log('[tx-queue] register: calling IdentityRegistry.register for', mutantId);
      const agentId = await registerAgent(agentURI);
      console.log('[tx-queue] register: got agentId', agentId.toString());

      // Update the mutant row with the on-chain agentId
      await mutants.update(mutantId, { agent_id: Number(agentId) });

      // Enqueue NFT transfer to the owner
      const mutant = await mutants.getById(mutantId);
      if (mutant.owner_address) {
        await enqueue('transfer_nft', {
          mutantId,
          to: mutant.owner_address,
          agentId: agentId.toString(),
        });
      }

      // Enqueue record_deposit now that we have the on-chain agentId
      if (payload.depositAmount != null) {
        await enqueue('record_deposit', {
          agentId: agentId.toString(),
          amount: payload.depositAmount,
        });
      }

      return { txHash: `register:${agentId.toString()}` };
    }

    case 'transfer_nft': {
      // payload: { to: string, agentId: string }
      const to = payload.to as string;
      const agentId = BigInt(payload.agentId as string);

      console.log('[tx-queue] transfer_nft: sending agentId', agentId.toString(), 'to', to);
      const hash = await transferNFT(to, agentId);
      return { txHash: hash };
    }

    case 'record_deposit': {
      // payload: { agentId: string, amount: number }
      const agentId = BigInt(payload.agentId as string);
      const amount = parseUnits(String(payload.amount), 6); // USDC has 6 decimals

      console.log('[tx-queue] record_deposit: agentId', agentId.toString(), 'amount', amount.toString());
      const hash = await contractRecordDeposit(agentId, amount);
      return { txHash: hash };
    }

    case 'record_settlement': {
      // payload: { agentId: string, marginToRelease: number, pnl: number }
      const agentId = BigInt(payload.agentId as string);
      const marginToRelease = parseUnits(String(payload.marginToRelease), 6);
      const pnl = parseUnits(String(payload.pnl), 6);

      console.log('[tx-queue] record_settlement: agentId', agentId.toString());
      const hash = await contractRecordSettlement(agentId, marginToRelease, pnl);
      return { txHash: hash };
    }

    case 'record_withdrawal': {
      // payload: { agentId: string, amount: number }
      const agentId = BigInt(payload.agentId as string);
      const amount = parseUnits(String(payload.amount), 6);

      console.log('[tx-queue] record_withdrawal: agentId', agentId.toString());
      const hash = await contractRecordWithdrawal(agentId, amount);
      return { txHash: hash };
    }

    default:
      console.log(`[tx-queue] unknown type "${type}":`, payload);
      return { txHash: `unknown:${item.id}` };
  }
}

/**
 * Process all pending transactions in FIFO order, one at a time.
 */
export async function processQueue(): Promise<void> {
  const pending = await txQueue.listPending();

  for (const item of pending) {
    // 1. Mark as submitted
    await txQueue.update(item.id, { status: 'submitted' });

    try {
      // 2. Execute the action
      const { txHash } = await executeTx(item);

      // 3. Mark confirmed
      await txQueue.update(item.id, {
        status: 'confirmed',
        tx_hash: txHash,
        processed_at: new Date().toISOString(),
      });
    } catch (err) {
      // 4. Mark failed and log
      console.error(`[tx-queue] failed item ${item.id}:`, err);
      await txQueue.update(item.id, { status: 'failed' });
    }
  }
}
