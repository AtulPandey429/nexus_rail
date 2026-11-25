import crypto from 'crypto';
import {
  MongoService,
  MongoCashbackIssuanceDoc,
  MongoOrderDoc,
} from '../services/mongo.js';
import { CashbackMintService } from '../services/cashbackMint.service.js';
import { GlobalSupplyCoordinator } from '../services/globalSupplyCoordinator.service.js';

/**
 * Durable background retry worker for transiently failed Stellar & XRPL direct cashback mints.
 * Guarded by a MongoDB distributed lease lock so multiple backend instances never double-mint.
 */
export class CashbackMintWorker {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static readonly WORKER_LOCK_KEY = 'cashback_mint_retry_worker';

  static async processDueRetries(): Promise<{ attempted: number; completed: number; failed: number }> {
    let attempted = 0;
    let completed = 0;
    let failed = 0;

    const ownerId = `cbw_${crypto.randomUUID()}`;
    const acquired = await GlobalSupplyCoordinator.acquireLeaseLock(
      this.WORKER_LOCK_KEY,
      ownerId,
      30_000
    ).catch(() => false);
    if (!acquired) return { attempted, completed, failed };

    try {
      const col = await MongoService.getCollection<MongoCashbackIssuanceDoc>('cashback_issuances');
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const nowIso = new Date().toISOString();

      const due = await col
        .find({
          status: 'RETRY_SCHEDULED',
          $or: [{ next_retry_at: { $lte: nowIso } }, { next_retry_at: { $exists: false } }],
        })
        .limit(10)
        .toArray();

      for (const item of due) {
        attempted++;
        try {
          const order = await ordersCol.findOne({ id: item.order_id });
          if (!order) {
            await col.updateOne(
              { order_id: item.order_id },
              { $set: { status: 'FAILED', last_error: 'Source order not found', updated_at: new Date().toISOString() } }
            );
            failed++;
            continue;
          }

          const res = await CashbackMintService.issueOrderCashback(order, {
            targetChain: item.target_chain === 'UNSELECTED' ? undefined : item.target_chain,
            recipientAddress: item.recipient_address || undefined,
          });
          if (res.status === 'COMPLETED') completed++;
          else if (res.status === 'FAILED') failed++;
        } catch {
          failed++;
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [CashbackMintWorker] Sweep warning:', err?.message);
    } finally {
      await GlobalSupplyCoordinator.releaseLeaseLock(this.WORKER_LOCK_KEY, ownerId);
    }

    return { attempted, completed, failed };
  }

  static startWorker(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🪙 [CashbackMintWorker] Dual-Chain Cashback Retry Sweeper Started (45s tick)');
    this.timer = setInterval(() => {
      this.processDueRetries().catch(() => {});
    }, 45_000);
    this.timer.unref?.();
  }

  static stopWorker(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }
}
