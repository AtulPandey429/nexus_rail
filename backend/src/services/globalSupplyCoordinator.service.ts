import crypto from 'crypto';
import {
  MongoService,
  MongoGlobalSupplyReservationDoc,
  MongoWorkerLockDoc,
} from './mongo.js';
import {
  SupplyReconciliationService,
  CANONICAL_MAX_SUPPLY_NXL,
} from './supplyReconciliation.service.js';
import { RedisCacheService } from './redis.js';

export interface GlobalSupplySnapshot {
  stellarOnChainSupplyNxl: number;
  xrplOnChainSupplyNxl: number;
  combinedOnChainSupplyNxl: number;
  effectiveGlobalCapNxl: number;
  activeReservedNxl: number;
  remainingGlobalHeadroomNxl: number;
}

export class GlobalSupplyCapExceededError extends Error {
  public readonly requestedNxl: number;
  public readonly remainingHeadroomNxl: number;
  public readonly effectiveGlobalCapNxl: number;

  constructor(params: {
    requestedNxl: number;
    remainingHeadroomNxl: number;
    effectiveGlobalCapNxl: number;
    chain: 'STELLAR' | 'XRPL';
  }) {
    super(
      `Global $NXL supply cap exceeded for ${params.chain} mint: requested ${params.requestedNxl.toFixed(6)} NXL, remaining unified headroom is ${params.remainingHeadroomNxl.toFixed(6)} NXL (effective global cap: ${params.effectiveGlobalCapNxl.toFixed(6)} NXL).`
    );
    this.name = 'GlobalSupplyCapExceededError';
    this.requestedNxl = params.requestedNxl;
    this.remainingHeadroomNxl = params.remainingHeadroomNxl;
    this.effectiveGlobalCapNxl = params.effectiveGlobalCapNxl;
  }
}

/**
 * Unified Global Supply Coordinator (Decisions D1 Option A + D2 Option B).
 *
 * Enforces the mandatory 1:1 cross-chain invariant across Stellar + XRPL combined:
 *   stellar_onchain_supply + xrpl_onchain_supply + active_pending_reservations + requested <= effective_global_cap (2,000,000 - permanent_buyback_burned)
 *
 * Because XRPL has no on-chain smart contract supply cap and NexusVault only sees Stellar supply,
 * EVERY mint on either chain MUST acquire an atomic reservation here before signing on-chain.
 */
export class GlobalSupplyCoordinator {
  private static readonly LOCK_KEY = 'global_supply_cap_lock';
  private static readonly LOCK_TTL_MS = 15_000;
  private static readonly RESERVATION_TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Acquires a distributed MongoDB lease lock with atomic expiry replacement.
   */
  static async acquireLeaseLock(
    lockKey: string,
    ownerId: string,
    ttlMs = this.LOCK_TTL_MS
  ): Promise<boolean> {
    const col = await MongoService.getCollection<MongoWorkerLockDoc>('worker_locks');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    try {
      const res: any = await col.findOneAndUpdate(
        {
          lock_key: lockKey,
          $or: [{ expires_at: { $lte: now } }, { owner_id: ownerId }],
        },
        {
          $set: {
            lock_key: lockKey,
            owner_id: ownerId,
            acquired_at: now.toISOString(),
            expires_at: expiresAt,
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
      const doc = res?.value || res;
      return doc?.owner_id === ownerId;
    } catch (err: any) {
      // Duplicate key error (code 11000) means another active worker holds the lease
      if (err?.code === 11000) return false;
      throw err;
    }
  }

  static async releaseLeaseLock(lockKey: string, ownerId: string): Promise<void> {
    try {
      const col = await MongoService.getCollection<MongoWorkerLockDoc>('worker_locks');
      await col.deleteOne({ lock_key: lockKey, owner_id: ownerId });
    } catch {}
  }

  /**
   * Fetches live unified on-chain supply across Stellar + XRPL and active pending reservations.
   * Extracted as a method so unit tests can mock live supply deterministically without live RPCs.
   */
  static async fetchLiveSupplyBaseline(): Promise<{
    stellarOnChainSupplyNxl: number;
    xrplOnChainSupplyNxl: number;
    effectiveGlobalCapNxl: number;
  }> {
    const report = await SupplyReconciliationService.getReconciliationReport({ forceRefresh: false });
    return {
      stellarOnChainSupplyNxl: report.stellar.onChainTotalSupplyNxl,
      xrplOnChainSupplyNxl: report.xrpl.onChainTotalSupplyNxl,
      effectiveGlobalCapNxl: Math.min(
        CANONICAL_MAX_SUPPLY_NXL,
        report.supplyModel.effectiveSupplyCapNxl
      ),
    };
  }

  static async getGlobalSupplySnapshot(): Promise<GlobalSupplySnapshot> {
    const [baseline, resCol] = await Promise.all([
      this.fetchLiveSupplyBaseline(),
      MongoService.getCollection<MongoGlobalSupplyReservationDoc>('global_supply_reservations'),
    ]);

    const now = new Date();
    const agg = await resCol
      .aggregate<{ total: number }>([
        { $match: { status: 'RESERVED', expires_at: { $gt: now } } },
        { $group: { _id: null, total: { $sum: '$amount_nxl' } } },
      ])
      .toArray();

    const activeReservedNxl = Number((agg[0]?.total || 0).toFixed(7));
    const combinedOnChainSupplyNxl = Number(
      (baseline.stellarOnChainSupplyNxl + baseline.xrplOnChainSupplyNxl).toFixed(7)
    );
    const remainingGlobalHeadroomNxl = Number(
      Math.max(
        0,
        baseline.effectiveGlobalCapNxl - combinedOnChainSupplyNxl - activeReservedNxl
      ).toFixed(7)
    );

    return {
      stellarOnChainSupplyNxl: baseline.stellarOnChainSupplyNxl,
      xrplOnChainSupplyNxl: baseline.xrplOnChainSupplyNxl,
      combinedOnChainSupplyNxl,
      effectiveGlobalCapNxl: baseline.effectiveGlobalCapNxl,
      activeReservedNxl,
      remainingGlobalHeadroomNxl,
    };
  }

  /**
   * Atomically reserves minting capacity against the unified 2,000,000 NXL global cap.
   * Strictly idempotent per `operationId`.
   */
  static async reserveMintCapacity(params: {
    operationId: string;
    chain: 'STELLAR' | 'XRPL';
    amountNxl: number;
    reason: 'cashback' | 'bridge' | 'liquidity' | 'admin';
    recipientAddress: string;
  }): Promise<{
    reservation: MongoGlobalSupplyReservationDoc;
    snapshot: GlobalSupplySnapshot;
    alreadyReserved: boolean;
  }> {
    if (!params.operationId?.trim()) {
      throw new Error('operationId is required for global supply reservation');
    }
    if (!Number.isFinite(params.amountNxl) || params.amountNxl <= 0) {
      throw new Error('amountNxl must be a positive finite number');
    }

    const resCol = await MongoService.getCollection<MongoGlobalSupplyReservationDoc>(
      'global_supply_reservations'
    );

    // Fast idempotency check
    const existing = await resCol.findOne({ operation_id: params.operationId });
    if (existing && (existing.status === 'RESERVED' || existing.status === 'CONFIRMED')) {
      const snapshot = await this.getGlobalSupplySnapshot();
      return { reservation: existing, snapshot, alreadyReserved: true };
    }

    const ownerId = `cap_${crypto.randomUUID()}`;
    let acquired = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      acquired = await this.acquireLeaseLock(this.LOCK_KEY, ownerId, this.LOCK_TTL_MS);
      if (acquired) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!acquired) {
      throw new Error('Global supply coordinator is busy; please retry shortly');
    }

    try {
      // Re-check inside lease lock
      const recheck = await resCol.findOne({ operation_id: params.operationId });
      if (recheck && (recheck.status === 'RESERVED' || recheck.status === 'CONFIRMED')) {
        const snapshot = await this.getGlobalSupplySnapshot();
        return { reservation: recheck, snapshot, alreadyReserved: true };
      }

      const snapshot = await this.getGlobalSupplySnapshot();
      if (params.amountNxl > snapshot.remainingGlobalHeadroomNxl + 1e-7) {
        throw new GlobalSupplyCapExceededError({
          requestedNxl: params.amountNxl,
          remainingHeadroomNxl: snapshot.remainingGlobalHeadroomNxl,
          effectiveGlobalCapNxl: snapshot.effectiveGlobalCapNxl,
          chain: params.chain,
        });
      }

      const now = new Date();
      const doc: MongoGlobalSupplyReservationDoc = {
        operation_id: params.operationId,
        chain: params.chain,
        reason: params.reason,
        amount_nxl: Number(params.amountNxl.toFixed(7)),
        recipient_address: params.recipientAddress,
        status: 'RESERVED',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        expires_at: new Date(now.getTime() + this.RESERVATION_TTL_MS),
      };

      await resCol.updateOne(
        { operation_id: params.operationId },
        { $set: doc },
        { upsert: true }
      );

      return {
        reservation: doc,
        snapshot: {
          ...snapshot,
          activeReservedNxl: Number((snapshot.activeReservedNxl + doc.amount_nxl).toFixed(7)),
          remainingGlobalHeadroomNxl: Number(
            Math.max(0, snapshot.remainingGlobalHeadroomNxl - doc.amount_nxl).toFixed(7)
          ),
        },
        alreadyReserved: false,
      };
    } finally {
      await this.releaseLeaseLock(this.LOCK_KEY, ownerId);
    }
  }

  /**
   * Confirms a reserved mint after verified on-chain finality.
   */
  static async confirmMintCapacity(
    operationId: string,
    txHash: string,
    ledgerSeq?: number
  ): Promise<void> {
    const resCol = await MongoService.getCollection<MongoGlobalSupplyReservationDoc>(
      'global_supply_reservations'
    );
    await resCol.updateOne(
      { operation_id: operationId },
      {
        $set: {
          status: 'CONFIRMED',
          tx_hash: txHash,
          ledger_seq: ledgerSeq,
          updated_at: new Date().toISOString(),
        },
      }
    );
    await Promise.all([
      RedisCacheService.invalidateCache('admin:tokenomics:reconciliation').catch(() => {}),
      RedisCacheService.invalidateCache('admin:dual-rail:summary').catch(() => {}),
    ]);
  }

  /**
   * Releases a reserved mint back to the global pool when a mint fails or is deferred.
   */
  static async releaseMintCapacity(operationId: string, reason: string): Promise<void> {
    const resCol = await MongoService.getCollection<MongoGlobalSupplyReservationDoc>(
      'global_supply_reservations'
    );
    await resCol.updateOne(
      { operation_id: operationId, status: 'RESERVED' },
      {
        $set: {
          status: 'RELEASED',
          release_reason: reason,
          updated_at: new Date().toISOString(),
        },
      }
    );
  }
}
