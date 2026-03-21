import { txQueue } from '@/lib/db/supabase';
import type { TxQueueItem } from '@/lib/db/types';

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

/**
 * Execute the onchain action for a given tx type.
 * Placeholder implementations — real integrations wired later.
 */
async function executeTx(
  item: TxQueueItem
): Promise<{ txHash: string }> {
  const type = item.type ?? 'unknown';
  const payload = item.payload ?? {};

  switch (type) {
    case 'register':
      console.log('[tx-queue] register:', payload);
      break;
    case 'transfer_nft':
      console.log('[tx-queue] transfer_nft:', payload);
      break;
    case 'record_deposit':
      console.log('[tx-queue] record_deposit:', payload);
      break;
    case 'record_settlement':
      console.log('[tx-queue] record_settlement:', payload);
      break;
    case 'record_withdrawal':
      console.log('[tx-queue] record_withdrawal:', payload);
      break;
    case 'trade':
      console.log('[tx-queue] trade:', payload);
      break;
    default:
      console.log(`[tx-queue] unknown type "${type}":`, payload);
      break;
  }

  // Placeholder tx hash — will be replaced with real onchain hash
  return { txHash: `0x_placeholder_${item.id}` };
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
