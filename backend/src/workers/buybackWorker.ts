import crypto from 'crypto';
import { MongoService, MongoBuybackExecutionDoc } from '../services/mongo.js';
import { BuybackService } from '../services/buyback.service.js';
import { GlobalSupplyCoordinator } from '../services/globalSupplyCoordinator.service.js';

/**
 * Durable Buyback & Burn Recovery + Optional Scheduled Automation Worker.
 *
 * 1. Always sweeps interrupted (`SWAPPED`) or `RETRY_SCHEDULED` executions so purchased
 *    $NXL tokens never remain stranded unburned across server restarts.
 * 2. Executes periodic threshold-gated buybacks ONLY when `ENABLE_AUTO_BUYBACK_WORKER === 'true'`.
 */
export class BuybackWorker {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static readonly WORKER_LOCK_KEY = 'buyback_worker_sweep_lock';

  static async processPendingAndAutoBuyback(): Promise<{
    resumed: number;
    completed: number;
    autoTriggered: boolean;
  }> {
    let resumed = 0;
    let completed = 0;
    let autoTriggered = false;

    const ownerId = `bbw_${crypto.randomUUID()}`;
    const lockAcquired = await GlobalSupplyCoordinator.acquireLeaseLock(
      this.WORKER_LOCK_KEY,
      ownerId,
      45_000
    ).catch(() => false);
    if (!lockAcquired) {
      return { resumed, completed, autoTriggered };
    }

    try {
      const col = await MongoService.getCollection<MongoBuybackExecutionDoc>('buyback_executions');
      const nowIso = new Date().toISOString();

      // 1. Always recover stranded SWAPPED or due RETRY_SCHEDULED burn steps
      const recoverable = await col
        .find({
          $or: [
            { status: 'SWAPPED' },
            {
              status: 'RETRY_SCHEDULED',
              $or: [{ next_retry_at: { $lte: nowIso } }, { next_retry_at: { $exists: false } }],
            },
          ],
        })
        .sort({ created_at: 1 })
        .limit(5)
        .toArray();

      for (const doc of recoverable) {
        resumed++;
        try {
          const out = await BuybackService.resumePendingBurn(doc.id);
          if (out.status === 'COMPLETED') completed++;
        } catch (err: any) {
          console.warn(`⚠️ [BuybackWorker] Resume warning for ${doc.id}:`, err?.message);
        }
      }

      // 2. Threshold-gated scheduled buyback (strictly opt-in via ENABLE_AUTO_BUYBACK_WORKER=true)
      if (process.env.ENABLE_AUTO_BUYBACK_WORKER === 'true') {
        const status = await BuybackService.getStatus();
        if (status.eligibleForBuyback) {
          const windowKey = `auto_${new Date().toISOString().slice(0, 13)}`; // At most once per UTC hour
          const res = await BuybackService.executeBuybackAndBurn({
            idempotencyKey: windowKey,
            triggerType: 'SCHEDULED_WORKER',
            triggeredBy: 'BUYBACK_WORKER',
          });
          autoTriggered = true;
          if (res.status === 'COMPLETED') completed++;
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [BuybackWorker] Sweep warning:', err?.message);
    } finally {
      await GlobalSupplyCoordinator.releaseLeaseLock(this.WORKER_LOCK_KEY, ownerId);
    }

    return { resumed, completed, autoTriggered };
  }

  static startWorker(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🔥 [BuybackWorker] Buyback-and-Burn Recovery Sweeper Started (120s tick)');
    this.timer = setInterval(() => {
      this.processPendingAndAutoBuyback().catch(() => {});
    }, 120_000);
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
