import crypto from 'crypto';
import type { ClientSession } from 'mongodb';
import {
  MongoService,
  MongoTreasuryEntryDoc,
  MongoPlatformConfigDoc,
  TreasurySourceType,
} from './mongo.js';
import { NrTokenService } from './nrTokenService.js';
import type { TreasurySummaryResponse, PlatformConfigDTO } from '../types/index.js';

export const DEFAULT_TREASURY_CONFIG: MongoPlatformConfigDoc = {
  key: 'treasury_settings',
  order_fee_bps: 100, // 1.00%
  swap_spread_bps: 50, // 0.50%
  cashout_spread_bps: 50, // 0.50%
  ai_fee_bps: 25, // 0.25%
  gas_flat_cents: 10, // $0.10
  nr_buyback_share_pct: 50, // 50% to $NR Liquidity Pool, 50% to Owner Net Profit
  cashback_pct: 2, // 2%
  is_paused: false,
  updated_at: new Date().toISOString(),
};

export interface RecordRevenueParams {
  sourceType: TreasurySourceType;
  referenceId: string;
  grossCents: number;
  feeCents?: number;
  spreadCents?: number;
  gasArbitrageCents?: number;
  rail?: 'STELLAR' | 'XRPL' | 'STRIPE' | 'NXL' | 'INTERNAL';
}

export class TreasuryService {
  /**
   * Retrieves active dynamic platform configuration from MongoDB (or initializes defaults).
   */
  static async getConfig(): Promise<MongoPlatformConfigDoc> {
    try {
      const configCol = await MongoService.getCollection<MongoPlatformConfigDoc>('platform_config');
      const existing = await configCol.findOne({ key: 'treasury_settings' });
      if (existing) return existing;

      await configCol.updateOne(
        { key: 'treasury_settings' },
        { $setOnInsert: DEFAULT_TREASURY_CONFIG },
        { upsert: true }
      );
      return (await configCol.findOne({ key: 'treasury_settings' })) || DEFAULT_TREASURY_CONFIG;
    } catch {
      return DEFAULT_TREASURY_CONFIG;
    }
  }

  /**
   * Updates dynamic platform configuration parameters with strict safety validation.
   */
  static async updateConfig(
    updates: Partial<PlatformConfigDTO>,
    adminId?: string
  ): Promise<MongoPlatformConfigDoc> {
    const configCol = await MongoService.getCollection<MongoPlatformConfigDoc>('platform_config');
    const current = await this.getConfig();

    const orderFeeBps = updates.order_fee_bps !== undefined ? updates.order_fee_bps : current.order_fee_bps;
    const swapSpreadBps = updates.swap_spread_bps !== undefined ? updates.swap_spread_bps : current.swap_spread_bps;
    const cashoutSpreadBps = updates.cashout_spread_bps !== undefined ? updates.cashout_spread_bps : current.cashout_spread_bps;
    const aiFeeBps = updates.ai_fee_bps !== undefined ? updates.ai_fee_bps : current.ai_fee_bps;
    const gasFlatCents = updates.gas_flat_cents !== undefined ? updates.gas_flat_cents : current.gas_flat_cents;
    const nrBuybackSharePct = updates.nr_buyback_share_pct !== undefined ? updates.nr_buyback_share_pct : current.nr_buyback_share_pct;
    const cashbackPct = updates.cashback_pct !== undefined ? updates.cashback_pct : current.cashback_pct;
    const isPaused = updates.is_paused !== undefined ? updates.is_paused : current.is_paused;

    // Safety range assertions
    if (orderFeeBps < 0 || orderFeeBps > 500) throw new Error('Order fee must be between 0 and 500 bps (0% - 5%)');
    if (swapSpreadBps < 0 || swapSpreadBps > 500) throw new Error('Swap spread must be between 0 and 500 bps (0% - 5%)');
    if (cashoutSpreadBps < 0 || cashoutSpreadBps > 500) throw new Error('Cashout spread must be between 0 and 500 bps (0% - 5%)');
    if (aiFeeBps < 0 || aiFeeBps > 500) throw new Error('AI fee must be between 0 and 500 bps (0% - 5%)');
    if (gasFlatCents < 0 || gasFlatCents > 100) throw new Error('Gas surplus must be between 0 and 100 cents ($0.00 - $1.00)');
    if (nrBuybackSharePct < 0 || nrBuybackSharePct > 100) throw new Error('NR buyback share must be between 0% and 100%');
    if (cashbackPct < 0 || cashbackPct > 10) throw new Error('Cashback must be between 0% and 10%');

    const updatedDoc: MongoPlatformConfigDoc = {
      key: 'treasury_settings',
      order_fee_bps: orderFeeBps,
      swap_spread_bps: swapSpreadBps,
      cashout_spread_bps: cashoutSpreadBps,
      ai_fee_bps: aiFeeBps,
      gas_flat_cents: gasFlatCents,
      nr_buyback_share_pct: nrBuybackSharePct,
      cashback_pct: cashbackPct,
      is_paused: isPaused,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    };

    await configCol.updateOne({ key: 'treasury_settings' }, { $set: updatedDoc }, { upsert: true });
    return updatedDoc;
  }

  /**
   * Records a revenue event with 50/50 profit & buyback split.
   * Strictly idempotent: re-calling with same reference_id & sourceType returns existing entry.
   */
  static async recordRevenueEvent(
    params: RecordRevenueParams,
    session?: ClientSession
  ): Promise<{ entry: MongoTreasuryEntryDoc; isDuplicate: boolean }> {
    const treasuryCol = await MongoService.getCollection<MongoTreasuryEntryDoc>('platform_treasury');

    // 1. Idempotency Check
    const existing = await treasuryCol.findOne(
      { reference_id: params.referenceId, source_type: params.sourceType },
      { session }
    );
    if (existing) {
      return { entry: existing, isDuplicate: true };
    }

    const config = await this.getConfig();
    const feeCents = Math.max(0, Math.round(params.feeCents ?? 0));
    const spreadCents = Math.max(0, Math.round(params.spreadCents ?? 0));
    const gasCents = Math.max(0, Math.round(params.gasArbitrageCents ?? 0));
    const totalRevenueCents = feeCents + spreadCents + gasCents;

    // 2. 50/50 Split Calculation (Zero rounding leak)
    const ownerSharePct = 100 - config.nr_buyback_share_pct;
    const netOwnerProfitCents = Math.ceil((totalRevenueCents * ownerSharePct) / 100);
    const nrPoolInjectedCents = totalRevenueCents - netOwnerProfitCents;

    const entry: MongoTreasuryEntryDoc = {
      id: `rev_${crypto.randomUUID()}`,
      source_type: params.sourceType,
      reference_id: params.referenceId,
      gross_cents: Math.max(0, Math.round(params.grossCents)),
      fee_cents: feeCents,
      spread_cents: spreadCents,
      gas_arbitrage_cents: gasCents,
      total_revenue_cents: totalRevenueCents,
      net_owner_profit_cents: netOwnerProfitCents,
      nr_pool_injected_cents: nrPoolInjectedCents,
      rail: params.rail || 'INTERNAL',
      created_at: new Date().toISOString(),
    };

    // 3. Atomically persist to platform_treasury
    if (session) {
      await treasuryCol.insertOne(entry, { session });
    } else {
      await treasuryCol.insertOne(entry);
    }

    // 4. Inject buyback share into $NR Constant-Product Pool
    if (nrPoolInjectedCents > 0) {
      try {
        await NrTokenService.injectRevenueToPool(
          nrPoolInjectedCents,
          `REV-${params.referenceId}`,
          session
        );
      } catch (poolErr: any) {
        console.warn(`⚠️ [TreasuryService Pool Injection Warning]: ${poolErr.message}`);
      }
    }

    return { entry, isDuplicate: false };
  }

  /**
   * Aggregates platform-wide treasury revenue, net owner profit, and double-entry balance proof.
   */
  static async getTreasurySummary(): Promise<TreasurySummaryResponse> {
    const treasuryCol = await MongoService.getCollection<MongoTreasuryEntryDoc>('platform_treasury');
    const now = Date.now();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const [allEntries, recentEntries] = await Promise.all([
      treasuryCol.find({}).toArray(),
      treasuryCol.find({ created_at: { $gte: twentyFourHoursAgo } }).toArray(),
    ]);

    let totalGrossVolumeCents = 0;
    let totalRevenueCents = 0;
    let netOwnerProfitCents = 0;
    let nrPoolInjectedCents = 0;

    let orderFeesCents = 0;
    let swapSpreadsCents = 0;
    let cashoutSpreadsCents = 0;
    let aiFeesCents = 0;
    let gasSurplusCents = 0;

    for (const doc of allEntries) {
      totalGrossVolumeCents += doc.gross_cents || 0;
      totalRevenueCents += doc.total_revenue_cents || 0;
      netOwnerProfitCents += doc.net_owner_profit_cents || 0;
      nrPoolInjectedCents += doc.nr_pool_injected_cents || 0;

      if (doc.source_type === 'ORDER') orderFeesCents += doc.fee_cents || 0;
      else if (doc.source_type === 'SWAP') swapSpreadsCents += doc.spread_cents || 0;
      else if (doc.source_type === 'SELL_SPREAD') cashoutSpreadsCents += doc.spread_cents || 0;
      else if (doc.source_type === 'AI_EXECUTION') aiFeesCents += doc.fee_cents || 0;
      else if (doc.source_type === 'GAS_ARBITRAGE') gasSurplusCents += doc.gas_arbitrage_cents || 0;
    }

    let revenue24hCents = 0;
    let ownerProfit24hCents = 0;
    for (const r of recentEntries) {
      revenue24hCents += r.total_revenue_cents || 0;
      ownerProfit24hCents += r.net_owner_profit_cents || 0;
    }

    // Double-Entry Invariant: Net Owner Profit + NR Buyback Injection === Total Revenue
    const zeroSumDifferenceCents = (netOwnerProfitCents + nrPoolInjectedCents) - totalRevenueCents;

    return {
      totalGrossVolumeCents,
      totalRevenueCents,
      netOwnerProfitCents,
      netOwnerProfitUsd: Number((netOwnerProfitCents / 100).toFixed(2)),
      nrPoolInjectedCents,
      nrPoolInjectedUsd: Number((nrPoolInjectedCents / 100).toFixed(2)),
      revenue24hCents,
      ownerProfit24hCents,
      breakdown: {
        orderFeesCents,
        swapSpreadsCents,
        cashoutSpreadsCents,
        aiFeesCents,
        gasSurplusCents,
      },
      zeroSumDifferenceCents,
      isBalanced: zeroSumDifferenceCents === 0,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves paginated revenue ledger entries with optional source filtering.
   */
  static async getRecentEntries(limit = 50, offset = 0, sourceType?: TreasurySourceType) {
    const treasuryCol = await MongoService.getCollection<MongoTreasuryEntryDoc>('platform_treasury');
    const query = sourceType ? { source_type: sourceType } : {};
    const items = await treasuryCol
      .find(query)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const total = await treasuryCol.countDocuments(query);
    return { items, total, limit, offset };
  }
}
