import crypto from 'crypto';
import { MongoService, MongoBridgeOperationDoc } from '../services/mongo.js';
import { BridgeOperationService } from '../services/bridgeOperation.service.js';
import { GlobalSupplyCoordinator } from '../services/globalSupplyCoordinator.service.js';
import { CrossChainSwapService } from '../services/crossChainSwap.service.js';

/**
 * Durable Cross-Chain Bridge Relayer Worker (Phase 4 — CRIT-04 & D3 Option A).
 *
 * - Sweeps `RETRY_SCHEDULED`, `SOURCE_VERIFIED`, and `DEST_VERIFIED` bridge operations
 *   across server restarts with distributed lease locking so destination payouts or
 *   escrow releases never execute twice.
 * - Marks expired unclaimed `SOROBAN_ESCROW` operations as `REFUNDABLE`.
 * - Runs idempotent legacy `swap_orders` -> `swaps` consolidation on startup.
 */
export class BridgeRelayerWorker {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static readonly LOCK_KEY = 'bridge_relayer_sweep_lock';

  static async processPendingOperations(): Promise<{
    processed: number;
    completed: number;
    markedRefundable: number;
  }> {
    let processed = 0;
    let completed = 0;
    let markedRefundable = 0;

    const ownerId = `brw_${crypto.randomUUID()}`;
    const lockAcquired = await GlobalSupplyCoordinator.acquireLeaseLock(
      this.LOCK_KEY,
      ownerId,
      45_000
    ).catch(() => false);
    if (!lockAcquired) {
      return { processed, completed, markedRefundable };
    }

    try {
      const col = await MongoService.getCollection<MongoBridgeOperationDoc>('bridge_operations');
      const nowIso = new Date().toISOString();
      const nowUnix = Math.floor(Date.now() / 1000);

      // Mark expired SOROBAN_ESCROW operations with no destination payout as REFUNDABLE
      const expireRes = await col.updateMany(
        {
          mechanism: 'SOROBAN_ESCROW',
          status: { $in: ['PENDING', 'SOURCE_VERIFIED', 'RETRY_SCHEDULED'] },
          $or: [{ dest_tx_hash: { $exists: false } }, { dest_tx_hash: '' }],
          escrow_expiry_unix_sec: { $lte: nowUnix },
        },
        {
          $set: {
            status: 'REFUNDABLE',
            last_error: 'Bridge escrow 15-minute window expired before destination payout; ready for self-refund.',
            updated_at: nowIso,
          },
        }
      );
      markedRefundable = expireRes.modifiedCount || 0;

      const candidates = await col
        .find({
          $or: [
            { status: 'SOURCE_VERIFIED' },
            { status: 'DEST_VERIFIED' },
            {
              status: 'RETRY_SCHEDULED',
              $or: [{ next_retry_at: { $lte: nowIso } }, { next_retry_at: { $exists: false } }],
            },
          ],
        })
        .sort({ created_at: 1 })
        .limit(10)
        .toArray();

      for (const doc of candidates) {
        processed++;
        try {
          const out = await BridgeOperationService.processBridgeOperation(doc.swap_id);
          if (out.status === 'COMPLETED') completed++;
        } catch (err: any) {
          console.warn(`⚠️ [BridgeRelayerWorker] Op ${doc.swap_id} retry warning:`, err?.message);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [BridgeRelayerWorker] Sweep warning:', err?.message);
    } finally {
      await GlobalSupplyCoordinator.releaseLeaseLock(this.LOCK_KEY, ownerId);
    }

    return { processed, completed, markedRefundable };
  }

  static startWorker(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🌉 [BridgeRelayerWorker] Durable Bridge Recovery Sweeper Started (45s tick)');
    // Consolidate any remaining legacy `swap_orders` records into `swaps` once at startup
    CrossChainSwapService.migrateLegacySwapOrders().catch(() => {});
    this.timer = setInterval(() => {
      this.processPendingOperations().catch(() => {});
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
