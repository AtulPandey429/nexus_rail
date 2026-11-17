import crypto from 'crypto';
import type { ClientSession } from 'mongodb';
import {
  MongoService,
  MongoOrderDoc,
  MongoUserHoldingDoc,
  MongoPortfolioEventDoc,
  type PortfolioEventType,
} from './mongo.js';
import { ProductService } from './products.js';
import { getExtendedMarketSnapshot, type ExtendedMarketSnapshot } from './market.js';
import { NrTokenService } from './nrTokenService.js';
import { TreasuryService } from './treasuryService.js';
import { walletService } from './wallet.js';
import type {
  AssetSymbol,
  HydratedHolding,
  UserPortfolioResponse,
  SellHoldingRequest,
  SellHoldingResponse,
  PlatformAUCResponse,
  DbPortfolioEvent,
} from '../types/index.js';

export const CASHOUT_SPREAD_BPS = 50; // 0.50% platform spread

export class PortfolioService {
  /**
   * Helper to derive live oracle price in USD cents for a given asset symbol
   */
  static getAssetPriceCents(
    symbol: AssetSymbol,
    snapshot: ExtendedMarketSnapshot,
    nrSpotCents: number
  ): { priceCents: number; source: 'binance' | 'coingecko' | 'amm'; change24h: number } {
    switch (symbol) {
      case 'GOLD_G':
        return {
          priceCents: Math.max(1, Math.round(snapshot.goldUsdPerGram * 100)),
          source: snapshot.source,
          change24h: snapshot.gold24hChange,
        };
      case 'SILVER_G':
        return {
          priceCents: Math.max(1, Math.round(snapshot.silverUsdPerGram * 100)),
          source: snapshot.source,
          change24h: snapshot.silver24hChange,
        };
      case 'XRP':
        return {
          priceCents: Math.max(1, Math.round(snapshot.xrpUsd * 100)),
          source: snapshot.source,
          change24h: snapshot.xrp24hChange,
        };
      case 'XLM':
        return {
          priceCents: Math.max(1, Math.round(snapshot.xlmUsd * 100)),
          source: snapshot.source,
          change24h: snapshot.xlm24hChange,
        };
      case 'USDC':
        return {
          priceCents: 100, // $1.00 USD
          source: 'binance',
          change24h: 0,
        };
      case 'NXL':
        return {
          priceCents: Math.max(1, nrSpotCents),
          source: 'amm',
          change24h: 0,
        };
      default:
        return {
          priceCents: 100,
          source: 'binance',
          change24h: 0,
        };
    }
  }

  /**
   * Label generator for supported asset symbols
   */
  static getAssetLabel(symbol: AssetSymbol): string {
    switch (symbol) {
      case 'GOLD_G':
        return 'Physical 24K Gold (nGOLD)';
      case 'SILVER_G':
        return 'Physical Silver (nSILVER)';
      case 'XRP':
        return 'XRP Ledger Native (XRP)';
      case 'XLM':
        return 'Stellar Lumens (XLM)';
      case 'USDC':
        return 'USD Coin (USDC)';
      case 'NXL':
        return '$NXL Native Utility Token';
      default:
        return symbol;
    }
  }

  /**
   * Atomically credits decomposed asset allocations to user_holdings when an order settles.
   * Guarantees strict once-only idempotency via Mongo conditional update on orders.portfolio_credited.
   */
  static async creditOrderAllocations(
    order: MongoOrderDoc,
    session?: ClientSession
  ): Promise<boolean> {
    if (order.portfolio_credited === true) {
      return false; // Already processed
    }

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const updateOptions: any = {};
    if (session) updateOptions.session = session;

    // Atomic claim guard: only one caller flips portfolio_credited false -> true
    const claimRes: any = await ordersCol.findOneAndUpdate(
      {
        order_number: order.order_number,
        portfolio_credited: { $ne: true },
      },
      {
        $set: {
          portfolio_credited: true,
          portfolio_credited_at: new Date().toISOString(),
        },
      },
      updateOptions
    );

    const claimedDoc = claimRes?.value || claimRes;
    if (!claimedDoc) {
      return false; // Another concurrent worker or retry already claimed this order
    }

    const holdingsCol = await MongoService.getCollection<MongoUserHoldingDoc>('user_holdings');
    const eventsCol = await MongoService.getCollection<MongoPortfolioEventDoc>('portfolio_events');

    const snapshot = await getExtendedMarketSnapshot();
    const nrPool = await NrTokenService.getPoolStats();
    const now = new Date().toISOString();

    for (const item of order.items) {
      const product = await ProductService.getProductBySku(item.sku);
      if (!product) continue;

      let allocations = product.allocations || [];

      // Fallback for single asset packs or NXL token if allocations array is absent
      if (allocations.length === 0) {
        if (item.sku === 'NXL-TOKEN' || item.sku === 'NXL-PACK-50' || item.sku === 'NR-TOKEN' || item.sku === 'NR-PACK-50') {
          allocations = [{ symbol: 'NXL', label: '$NXL Native Utility Token', unitQty: (item.sku === 'NXL-PACK-50' || item.sku === 'NR-PACK-50') ? 50 : 1 }];
        } else if (item.sku === 'NGOLD-1G') {
          allocations = [{ symbol: 'GOLD_G', label: 'Physical 24K Gold (1g)', unitQty: 1.0 }];
        } else if (item.sku === 'NSILVER-10G') {
          allocations = [{ symbol: 'SILVER_G', label: 'Physical Silver (10g)', unitQty: 10.0 }];
        }
      }

      for (const alloc of allocations) {
        const deltaQty = alloc.unitQty * item.qty;
        if (deltaQty <= 0) continue;

        const { priceCents } = this.getAssetPriceCents(alloc.symbol, snapshot, nrPool.spotPriceCents);
        const deltaCostCents = Math.round(deltaQty * priceCents);

        // Find existing user holding
        const existingHolding = await holdingsCol.findOne(
          { user_id: order.user_id, symbol: alloc.symbol },
          session ? { session } : undefined
        );

        if (existingHolding) {
          const newQty = Number((existingHolding.quantity + deltaQty).toFixed(6));
          const newCostCents = existingHolding.total_cost_cents + deltaCostCents;
          const newAvgBuy = newQty > 0 ? Math.round(newCostCents / newQty) : priceCents;

          await holdingsCol.updateOne(
            { _id: existingHolding._id },
            {
              $set: {
                quantity: newQty,
                total_cost_cents: newCostCents,
                avg_buy_price_cents: newAvgBuy,
                updated_at: now,
              },
            },
            session ? { session } : undefined
          );
        } else {
          await holdingsCol.insertOne(
            {
              id: `hld_${crypto.randomUUID()}`,
              user_id: order.user_id,
              symbol: alloc.symbol,
              label: alloc.label || this.getAssetLabel(alloc.symbol),
              quantity: Number(deltaQty.toFixed(6)),
              total_cost_cents: deltaCostCents,
              avg_buy_price_cents: priceCents,
              realized_pnl_cents: 0,
              updated_at: now,
            },
            session ? { session } : undefined
          );
        }

        // Insert audit event
        await eventsCol.insertOne(
          {
            id: `evt_${crypto.randomUUID()}`,
            user_id: order.user_id,
            type: 'ACQUIRE_ORDER',
            symbol: alloc.symbol,
            quantity_delta: deltaQty,
            unit_price_cents: priceCents,
            total_usd_cents: deltaCostCents,
            fee_cents: 0,
            reference_id: order.order_number,
            created_at: now,
          },
          session ? { session } : undefined
        );

        // Sync NXL internal balance if the credited asset is NXL
        if (alloc.symbol === 'NXL') {
          const nrMicro = Math.round(deltaQty * 1_000_000);
          try {
            await walletService.applyEntry(
              order.user_id,
              nrMicro,
              'CREDIT',
              'NXL',
              order.order_number,
              session
            );
          } catch (walletErr: any) {
            console.warn(`⚠️ [PortfolioService] NXL balance sync warning:`, walletErr.message);
          }
        }
      }
    }

    // Module 4: Record Order Routing Fee & Gas Arbitrage in Platform Treasury
    try {
      const config = await TreasuryService.getConfig();
      const isPaidWithNr = order.payment_rail === 'NXL_TOKEN';
      const orderFeeCents = isPaidWithNr ? 0 : Math.round((order.total_cents * config.order_fee_bps) / 10000);
      const isCryptoRail = ['STELLAR', 'XRPL', 'XLM', 'XRP', 'STELLAR_USDC', 'USDC'].includes(order.payment_rail);
      const gasArbitrageCents = isCryptoRail ? config.gas_flat_cents : 0;

      if (orderFeeCents > 0 || gasArbitrageCents > 0) {
        await TreasuryService.recordRevenueEvent(
          {
            sourceType: 'ORDER',
            referenceId: order.order_number,
            grossCents: order.total_cents,
            feeCents: orderFeeCents,
            gasArbitrageCents,
            rail: (order.payment_rail as any) || 'INTERNAL',
          },
          session
        );
      }
    } catch (treasuryErr: any) {
      console.warn('⚠️ [PortfolioService] Treasury record warning:', treasuryErr.message);
    }

    return true;
  }

  /**
   * Fetches user's complete live portfolio with real-time valuation, cost basis, and unrealized P&L
   */
  static async getUserPortfolio(userId: string): Promise<UserPortfolioResponse> {
    const holdingsCol = await MongoService.getCollection<MongoUserHoldingDoc>('user_holdings');
    const eventsCol = await MongoService.getCollection<MongoPortfolioEventDoc>('portfolio_events');

    const rawHoldings = await holdingsCol.find({ user_id: userId }).toArray();
    const snapshot = await getExtendedMarketSnapshot();
    const nrPool = await NrTokenService.getPoolStats();

    // Check if user has NXL wallet balance that can be synced or included
    try {
      const balances = await walletService.getBalance(userId);
      const nrMicro = balances.NXL || 0;
      const nrUnits = Number((nrMicro / 1_000_000).toFixed(6));
      const hasNrHolding = rawHoldings.some((h) => h.symbol === 'NXL');

      if (!hasNrHolding && nrUnits > 0) {
        rawHoldings.push({
          _id: undefined as any,
          id: `hld_wallet_nxl_${userId}`,
          user_id: userId,
          symbol: 'NXL',
          label: '$NXL Native Utility Token',
          quantity: nrUnits,
          total_cost_cents: Math.round(nrUnits * nrPool.spotPriceCents),
          avg_buy_price_cents: nrPool.spotPriceCents,
          realized_pnl_cents: 0,
          updated_at: new Date().toISOString(),
        } as any);
      }
    } catch {}

    const hydratedHoldings: HydratedHolding[] = rawHoldings
      .filter((h) => h.quantity > 0.000001)
      .map((h) => {
        const { priceCents, source, change24h } = this.getAssetPriceCents(
          h.symbol,
          snapshot,
          nrPool.spotPriceCents
        );
        const currentValueCents = Math.round(h.quantity * priceCents);
        const unrealizedPnlCents = currentValueCents - h.total_cost_cents;
        const unrealizedPnlPercent =
          h.total_cost_cents > 0
            ? Number(((unrealizedPnlCents / h.total_cost_cents) * 100).toFixed(2))
            : 0;

        return {
          symbol: h.symbol,
          label: h.label || this.getAssetLabel(h.symbol),
          quantity: h.quantity,
          total_cost_cents: h.total_cost_cents,
          avg_buy_price_cents: h.avg_buy_price_cents,
          current_price_cents: priceCents,
          current_value_cents: currentValueCents,
          unrealized_pnl_cents: unrealizedPnlCents,
          unrealized_pnl_percent: unrealizedPnlPercent,
          realized_pnl_cents: h.realized_pnl_cents || 0,
          change_24h_percent: change24h,
          oracle_source: source,
          updated_at: h.updated_at,
        };
      });

    const totalCostCents = hydratedHoldings.reduce((sum, h) => sum + h.total_cost_cents, 0);
    const totalCurrentValueCents = hydratedHoldings.reduce(
      (sum, h) => sum + h.current_value_cents,
      0
    );
    const totalUnrealizedPnlCents = totalCurrentValueCents - totalCostCents;
    const totalUnrealizedPnlPercent =
      totalCostCents > 0
        ? Number(((totalUnrealizedPnlCents / totalCostCents) * 100).toFixed(2))
        : 0;
    const totalRealizedPnlCents = hydratedHoldings.reduce(
      (sum, h) => sum + h.realized_pnl_cents,
      0
    );
    const inrTotalCurrentValue = Math.round(
      (totalCurrentValueCents / 100) * (snapshot.usdInrRate || 86.5)
    );

    const recentEvents = await eventsCol
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(20)
      .toArray();

    return {
      user_id: userId,
      total_cost_cents: totalCostCents,
      total_current_value_cents: totalCurrentValueCents,
      total_unrealized_pnl_cents: totalUnrealizedPnlCents,
      total_unrealized_pnl_percent: totalUnrealizedPnlPercent,
      total_realized_pnl_cents: totalRealizedPnlCents,
      inr_total_current_value: inrTotalCurrentValue,
      holdings: hydratedHoldings,
      recent_events: recentEvents.map((evt) => ({
        id: evt.id,
        user_id: evt.user_id,
        type: evt.type,
        symbol: evt.symbol,
        quantity_delta: evt.quantity_delta,
        unit_price_cents: evt.unit_price_cents,
        total_usd_cents: evt.total_usd_cents,
        fee_cents: evt.fee_cents,
        reference_id: evt.reference_id,
        created_at: evt.created_at,
      })),
    };
  }

  /**
   * Executes a 1-click cashout / liquidation of a user asset position at live market rates minus 0.5% spread
   */
  static async sellHolding(
    userId: string,
    req: SellHoldingRequest
  ): Promise<SellHoldingResponse> {
    const { symbol, quantity } = req;
    if (!symbol || !quantity || quantity <= 0) {
      throw new Error('Valid symbol and positive quantity are required');
    }

    const holdingsCol = await MongoService.getCollection<MongoUserHoldingDoc>('user_holdings');
    const eventsCol = await MongoService.getCollection<MongoPortfolioEventDoc>('portfolio_events');

    const holding = await holdingsCol.findOne({ user_id: userId, symbol });
    if (!holding || holding.quantity < quantity) {
      throw new Error(
        `Insufficient ${symbol} holding. Owned: ${holding?.quantity || 0}, requested: ${quantity}`
      );
    }

    const snapshot = await getExtendedMarketSnapshot();
    const nrPool = await NrTokenService.getPoolStats();
    const { priceCents } = this.getAssetPriceCents(symbol, snapshot, nrPool.spotPriceCents);

    const grossProceedsCents = Math.round(quantity * priceCents);
    const spreadFeeCents = Math.round((grossProceedsCents * CASHOUT_SPREAD_BPS) / 10000);
    const netPayoutCents = grossProceedsCents - spreadFeeCents;

    // Cost basis reduction proportional to quantity sold
    const costRemovedCents =
      holding.quantity > 0
        ? Math.round(holding.total_cost_cents * (quantity / holding.quantity))
        : 0;
    const realizedPnlCents = netPayoutCents - costRemovedCents;
    const remainingQty = Number(Math.max(0, holding.quantity - quantity).toFixed(6));
    const remainingCostCents = Math.max(0, holding.total_cost_cents - costRemovedCents);
    const newAvgBuy = remainingQty > 0 ? Math.round(remainingCostCents / remainingQty) : 0;
    const newRealizedPnlCents = (holding.realized_pnl_cents || 0) + realizedPnlCents;
    const now = new Date().toISOString();

    // Atomic conditional update to guard against race conditions
    const updateRes: any = await holdingsCol.findOneAndUpdate(
      {
        user_id: userId,
        symbol,
        quantity: { $gte: quantity },
      },
      {
        $set: {
          quantity: remainingQty,
          total_cost_cents: remainingCostCents,
          avg_buy_price_cents: newAvgBuy,
          realized_pnl_cents: newRealizedPnlCents,
          updated_at: now,
        },
      },
      { returnDocument: 'after' }
    );

    const updatedDoc = updateRes?.value || updateRes;
    if (!updatedDoc) {
      throw new Error('Concurrent modification detected during liquidation. Please retry.');
    }

    const eventId = `evt_sell_${crypto.randomUUID()}`;

    // Record audit event
    await eventsCol.insertOne({
      id: eventId,
      user_id: userId,
      type: 'SELL_CASHOUT',
      symbol,
      quantity_delta: -quantity,
      unit_price_cents: priceCents,
      total_usd_cents: grossProceedsCents,
      fee_cents: spreadFeeCents,
      reference_id: eventId,
      created_at: now,
    });

    // Debit NXL wallet if selling NXL
    if (symbol === 'NXL') {
      const nrMicro = Math.round(quantity * 1_000_000);
      try {
        await walletService.applyEntry(userId, nrMicro, 'DEBIT', 'NXL', eventId);
      } catch (err: any) {
        console.warn('⚠️ [PortfolioService] NXL debit warning:', err.message);
      }
    }

    // Module 4: Record Cashout Spread Revenue in Platform Treasury (50% Owner Net Profit + 50% NR Pool Injection)
    if (spreadFeeCents > 0) {
      try {
        await TreasuryService.recordRevenueEvent({
          sourceType: 'SELL_SPREAD',
          referenceId: eventId,
          grossCents: grossProceedsCents,
          spreadCents: spreadFeeCents,
          rail: 'INTERNAL',
        });
      } catch (treasuryErr: any) {
        console.warn('⚠️ [PortfolioService] Cashout spread treasury warning:', treasuryErr.message);
      }
    }

    // Credit net payout to user's internal USD wallet
    await walletService.applyEntry(userId, netPayoutCents, 'CREDIT', 'USD', eventId);
    const userBalances = await walletService.getBalance(userId);

    return {
      success: true,
      event_id: eventId,
      symbol,
      quantity_sold: quantity,
      gross_proceeds_cents: grossProceedsCents,
      spread_fee_cents: spreadFeeCents,
      net_payout_cents: netPayoutCents,
      realized_pnl_cents: realizedPnlCents,
      remaining_quantity: remainingQty,
      new_usd_balance_cents: userBalances.USD || 0,
    };
  }

  /**
   * Aggregates platform-wide Assets Under Custody (AUC) for Operator Admin Console
   */
  static async getPlatformAUC(): Promise<PlatformAUCResponse> {
    const holdingsCol = await MongoService.getCollection<MongoUserHoldingDoc>('user_holdings');
    const eventsCol = await MongoService.getCollection<MongoPortfolioEventDoc>('portfolio_events');

    // Aggregate in MongoDB so large holdings collections never land in Node memory.
    const [groupedRows, snapshot, nrPool] = await Promise.all([
      holdingsCol
        .aggregate<{ _id: AssetSymbol; totalQty: number; userCount: number }>([
          { $match: { quantity: { $gt: 0.000001 } } },
          { $group: { _id: '$symbol', totalQty: { $sum: '$quantity' }, users: { $addToSet: '$user_id' } } },
          { $project: { _id: 1, totalQty: 1, userCount: { $size: '$users' } } },
        ])
        .toArray(),
      getExtendedMarketSnapshot(),
      NrTokenService.getPoolStats(),
    ]);

    const assets = groupedRows.map((row) => {
      const symbol = row._id as AssetSymbol;
      const { priceCents } = this.getAssetPriceCents(symbol, snapshot, nrPool.spotPriceCents);
      const totalQty = Number(Number(row.totalQty || 0).toFixed(6));
      const valuationCents = Math.round(totalQty * priceCents);
      return {
        symbol,
        label: this.getAssetLabel(symbol),
        total_quantity: totalQty,
        current_price_cents: priceCents,
        valuation_usd_cents: valuationCents,
        user_count: Number(row.userCount || 0),
      };
    });

    const totalCustodyUsdCents = assets.reduce((sum, a) => sum + a.valuation_usd_cents, 0);

    const recentLiquidations = await eventsCol
      .find({ type: 'SELL_CASHOUT' })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

    const totalSpreadEarnedCents = await eventsCol
      .aggregate<{ totalSpread: number }>([
        { $match: { type: 'SELL_CASHOUT' } },
        { $group: { _id: null, totalSpread: { $sum: '$fee_cents' } } },
      ])
      .toArray()
      .then((res) => res[0]?.totalSpread || 0);

    return {
      total_custody_usd_cents: totalCustodyUsdCents,
      assets,
      recent_liquidations: recentLiquidations.map((evt) => ({
        id: evt.id,
        user_id: evt.user_id,
        type: evt.type,
        symbol: evt.symbol,
        quantity_delta: evt.quantity_delta,
        unit_price_cents: evt.unit_price_cents,
        total_usd_cents: evt.total_usd_cents,
        fee_cents: evt.fee_cents,
        reference_id: evt.reference_id,
        created_at: evt.created_at,
      })),
      total_spread_earned_cents: totalSpreadEarnedCents,
    };
  }
}
