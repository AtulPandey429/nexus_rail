import {
  MongoService,
  MongoOrderDoc,
  MongoTreasuryEntryDoc,
  MongoWalletTxDoc,
  MongoTokenWithdrawalDoc,
} from './mongo.js';
import { PortfolioService } from './portfolio.service.js';
import { NrTokenService } from './nrToken.service.js';
import { RedisCacheService } from './redis.js';
import type {
  AdminAnalyticsBreakdownRow,
  AdminAnalyticsBucket,
  AdminAnalyticsGranularity,
  AdminAnalyticsRangeKey,
  AdminAnalyticsRecentOrder,
  AdminAnalyticsResponse,
  AdminAnalyticsRevenueRow,
  AdminAnalyticsTopProduct,
} from '../types/index.js';

const SETTLED_STATUSES = ['PAID', 'FULFILLING', 'FULFILLED'];
const FAILED_STATUSES = ['FAILED', 'CANCELLED'];
const PENDING_STATUSES = ['PENDING', 'UNDERPAID'];

const RANGE_CONFIG: Record<AdminAnalyticsRangeKey, { days: number | null; label: string }> = {
  '7d': { days: 7, label: 'Last 7 days' },
  '30d': { days: 30, label: 'Last 30 days' },
  '90d': { days: 90, label: 'Last 90 days' },
  '1y': { days: 365, label: 'Last 12 months' },
  all: { days: null, label: 'All time' },
};

const SOURCE_LABELS: Record<string, string> = {
  ORDER: 'Order fees',
  SWAP: 'Swap spreads',
  SELL_SPREAD: 'Cashout spreads',
  AI_EXECUTION: 'AI service fees',
  GAS_ARBITRAGE: 'Gas surplus',
};

function toBucketKey(value: Date | string, granularity: AdminAnalyticsGranularity): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (granularity === 'month') return date.toISOString().slice(0, 7);
  return date.toISOString().slice(0, 10);
}

function bucketLabel(key: string, granularity: AdminAnalyticsGranularity): string {
  if (!key) return '—';
  if (granularity === 'month') {
    const [year, month] = key.split('-').map(Number);
    return new Date(Date.UTC(year, (month || 1) - 1, 1)).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  const date = new Date(`${key}T00:00:00.000Z`);
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' });
}

function enumerateBuckets(
  from: Date,
  to: Date,
  granularity: AdminAnalyticsGranularity
): string[] {
  const keys: string[] = [];
  const cursor = new Date(from.getTime());
  if (granularity === 'month') {
    cursor.setUTCDate(1);
    cursor.setUTCHours(0, 0, 0, 0);
  } else {
    cursor.setUTCHours(0, 0, 0, 0);
    if (granularity === 'week') {
      const day = cursor.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      cursor.setUTCDate(cursor.getUTCDate() + diff);
    }
  }

  const limit = 400;
  while (cursor.getTime() <= to.getTime() && keys.length < limit) {
    keys.push(toBucketKey(cursor, granularity));
    if (granularity === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else if (granularity === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return Array.from(new Set(keys));
}

function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function resolveGranularity(
  range: AdminAnalyticsRangeKey,
  requested?: AdminAnalyticsGranularity
): AdminAnalyticsGranularity {
  if (requested) return requested;
  if (range === '7d' || range === '30d') return 'day';
  if (range === '90d') return 'week';
  return 'month';
}

export class AdminAnalyticsService {
  static async invalidateCache(): Promise<void> {
    const ranges: AdminAnalyticsRangeKey[] = ['7d', '30d', '90d', '1y', 'all'];
    const granularities: AdminAnalyticsGranularity[] = ['day', 'week', 'month'];
    const tasks: Promise<void>[] = [];
    for (const r of ranges) {
      for (const g of granularities) {
        tasks.push(RedisCacheService.invalidateCache(`admin:analytics:${r}:${g}`));
      }
    }
    tasks.push(RedisCacheService.invalidateCache('analytics:summary'));
    await Promise.all(tasks);
  }

  /**
   * Real, admin-scoped business analytics derived from MongoDB records.
   * No mock values: every metric maps to an existing collection field.
   */
  static async getAnalytics(params: {
    range: AdminAnalyticsRangeKey;
    granularity?: AdminAnalyticsGranularity;
    forceRefresh?: boolean;
  }): Promise<AdminAnalyticsResponse> {
    const range = params.range;
    const granularity = resolveGranularity(range, params.granularity);
    const cacheKey = `admin:analytics:${range}:${granularity}`;

    if (!params.forceRefresh) {
      const cached = await RedisCacheService.getCache<AdminAnalyticsResponse>(cacheKey);
      if (cached) return cached;
    }

    const now = new Date();
    const config = RANGE_CONFIG[range];
    const from = config.days === null ? null : new Date(now.getTime() - config.days * 24 * 60 * 60 * 1000);
    const fromIso = from ? from.toISOString() : null;
    const previousFrom = from && config.days
      ? new Date(from.getTime() - config.days * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const previousTo = fromIso;

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const treasuryCol = await MongoService.getCollection<MongoTreasuryEntryDoc>('platform_treasury');
    const usersCol = await MongoService.getCollection('users');
    const walletCol = await MongoService.getCollection<MongoWalletTxDoc>('wallet_ledger');
    const withdrawalsCol = await MongoService.getCollection<MongoTokenWithdrawalDoc>('token_withdrawals');

    const orderMatch = fromIso ? { created_at: { $gte: fromIso } } : {};
    const treasuryMatch = fromIso ? { created_at: { $gte: fromIso } } : {};
    const walletMatch = fromIso ? { created_at: { $gte: fromIso } } : {};
    const withdrawalMatch = fromIso ? { created_at: { $gte: fromIso } } : {};

    const dateConvert = {
      $convert: { input: '$created_at', to: 'date', onError: null, onNull: null },
    };

    const [ordersFacet, treasuryFacet, usersFacet, walletFacet, withdrawalsFacet, lifetimeOrders, lifetimeTreasury, totalUsers, custody, pool] =
      await Promise.all([
        ordersCol
          .aggregate([
            { $match: orderMatch },
            {
              $facet: {
                totals: [
                  {
                    $group: {
                      _id: null,
                      totalOrders: { $sum: 1 },
                      settledOrders: {
                        $sum: { $cond: [{ $in: ['$status', SETTLED_STATUSES] }, 1, 0] },
                      },
                      pendingOrders: {
                        $sum: { $cond: [{ $in: ['$status', PENDING_STATUSES] }, 1, 0] },
                      },
                      failedOrders: {
                        $sum: { $cond: [{ $in: ['$status', FAILED_STATUSES] }, 1, 0] },
                      },
                      orderVolumeCents: {
                        $sum: {
                          $cond: [
                            { $in: ['$status', SETTLED_STATUSES] },
                            { $ifNull: ['$total_cents', 0] },
                            0,
                          ],
                        },
                      },
                    },
                  },
                ],
                statuses: [
                  {
                    $group: {
                      _id: { $ifNull: ['$status', 'UNKNOWN'] },
                      count: { $sum: 1 },
                      volumeCents: { $sum: { $ifNull: ['$total_cents', 0] } },
                    },
                  },
                  { $sort: { count: -1 } },
                ],
                rails: [
                  {
                    $group: {
                      _id: { $ifNull: ['$payment_rail', 'UNKNOWN'] },
                      count: { $sum: 1 },
                      volumeCents: {
                        $sum: {
                          $cond: [
                            { $in: ['$status', SETTLED_STATUSES] },
                            { $ifNull: ['$total_cents', 0] },
                            0,
                          ],
                        },
                      },
                    },
                  },
                  { $sort: { volumeCents: -1 } },
                ],
                activeUsers: [
                  { $group: { _id: '$user_id' } },
                  { $count: 'count' },
                ],
                series: [
                  {
                    $group: {
                      _id: {
                        $dateTrunc: {
                          date: dateConvert,
                          unit: granularity,
                          startOfWeek: 'monday',
                        },
                      },
                      totalOrders: { $sum: 1 },
                      settledOrders: {
                        $sum: { $cond: [{ $in: ['$status', SETTLED_STATUSES] }, 1, 0] },
                      },
                      orderVolumeCents: {
                        $sum: {
                          $cond: [
                            { $in: ['$status', SETTLED_STATUSES] },
                            { $ifNull: ['$total_cents', 0] },
                            0,
                          ],
                        },
                      },
                    },
                  },
                ],
                topProducts: [
                  { $match: { status: { $in: SETTLED_STATUSES } } },
                  { $unwind: '$items' },
                  {
                    $group: {
                      _id: { $ifNull: ['$items.sku', 'UNKNOWN'] },
                      title: { $first: { $ifNull: ['$items.title', '$items.sku'] } },
                      quantity: { $sum: { $ifNull: ['$items.qty', 0] } },
                      revenueCents: {
                        $sum: {
                          $multiply: [
                            { $ifNull: ['$items.qty', 0] },
                            { $ifNull: ['$items.unit_price_cents', 0] },
                          ],
                        },
                      },
                    },
                  },
                  { $sort: { revenueCents: -1 } },
                  { $limit: 8 },
                ],
                recent: [
                  { $sort: { created_at: -1 } },
                  { $limit: 8 },
                  {
                    $lookup: {
                      from: 'users',
                      let: { buyerId: '$user_id' },
                      pipeline: [
                        { $match: { $expr: { $eq: ['$id', '$$buyerId'] } } },
                        { $project: { _id: 0, email: 1, name: 1 } },
                      ],
                      as: 'buyer',
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      id: 1,
                      order_number: 1,
                      status: 1,
                      payment_rail: 1,
                      total_cents: 1,
                      created_at: 1,
                      buyerEmail: {
                        $ifNull: [{ $arrayElemAt: ['$buyer.email', 0] }, '$user_id'],
                      },
                      buyerName: { $arrayElemAt: ['$buyer.name', 0] },
                    },
                  },
                ],
              },
            },
          ])
          .toArray(),
        treasuryCol
          .aggregate([
            { $match: treasuryMatch },
            {
              $facet: {
                totals: [
                  {
                    $group: {
                      _id: null,
                      grossCents: { $sum: { $ifNull: ['$gross_cents', 0] } },
                      revenueCents: { $sum: { $ifNull: ['$total_revenue_cents', 0] } },
                      feeCents: { $sum: { $ifNull: ['$fee_cents', 0] } },
                      spreadCents: { $sum: { $ifNull: ['$spread_cents', 0] } },
                      gasArbitrageCents: { $sum: { $ifNull: ['$gas_arbitrage_cents', 0] } },
                      ownerProfitCents: { $sum: { $ifNull: ['$net_owner_profit_cents', 0] } },
                      nrPoolInjectedCents: { $sum: { $ifNull: ['$nr_pool_injected_cents', 0] } },
                    },
                  },
                ],
                breakdown: [
                  {
                    $group: {
                      _id: { $ifNull: ['$source_type', 'UNKNOWN'] },
                      grossCents: { $sum: { $ifNull: ['$gross_cents', 0] } },
                      revenueCents: { $sum: { $ifNull: ['$total_revenue_cents', 0] } },
                    },
                  },
                  { $sort: { revenueCents: -1 } },
                ],
                series: [
                  {
                    $group: {
                      _id: {
                        $dateTrunc: {
                          date: dateConvert,
                          unit: granularity,
                          startOfWeek: 'monday',
                        },
                      },
                      revenueCents: { $sum: { $ifNull: ['$total_revenue_cents', 0] } },
                      ownerProfitCents: { $sum: { $ifNull: ['$net_owner_profit_cents', 0] } },
                    },
                  },
                ],
              },
            },
          ])
          .toArray(),
        usersCol
          .aggregate([
            {
              $addFields: {
                registeredAt: {
                  $convert: {
                    input: { $ifNull: ['$createdAt', '$created_at'] },
                    to: 'date',
                    onError: null,
                    onNull: null,
                  },
                },
              },
            },
            { $match: fromIso ? { registeredAt: { $gte: new Date(fromIso) } } : {} },
            {
              $facet: {
                count: [{ $count: 'n' }],
                series: [
                  {
                    $group: {
                      _id: {
                        $dateTrunc: {
                          date: '$registeredAt',
                          unit: granularity,
                          startOfWeek: 'monday',
                        },
                      },
                      newUsers: { $sum: 1 },
                    },
                  },
                ],
              },
            },
          ])
          .toArray(),
        walletCol
          .aggregate([
            { $match: walletMatch },
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 },
                amountCents: { $sum: { $ifNull: ['$amount_cents', 0] } },
              },
            },
          ])
          .toArray(),
        withdrawalsCol
          .aggregate([
            { $match: withdrawalMatch },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                units: { $sum: { $ifNull: ['$amount_nr', 0] } },
              },
            },
          ])
          .toArray(),
        ordersCol
          .aggregate([
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                settledOrders: {
                  $sum: { $cond: [{ $in: ['$status', SETTLED_STATUSES] }, 1, 0] },
                },
                orderVolumeCents: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', SETTLED_STATUSES] },
                      { $ifNull: ['$total_cents', 0] },
                      0,
                    ],
                  },
                },
              },
            },
          ])
          .toArray(),
        treasuryCol
          .aggregate([
            {
              $group: {
                _id: null,
                grossCents: { $sum: { $ifNull: ['$gross_cents', 0] } },
                revenueCents: { $sum: { $ifNull: ['$total_revenue_cents', 0] } },
                ownerProfitCents: { $sum: { $ifNull: ['$net_owner_profit_cents', 0] } },
              },
            },
          ])
          .toArray(),
        usersCol.countDocuments({}),
        PortfolioService.getPlatformAUC().catch(() => null),
        NrTokenService.getPoolStats().catch(() => null),
      ]);

    const orderTotals = (ordersFacet[0]?.totals?.[0] || {}) as any;
    const treasuryTotals = (treasuryFacet[0]?.totals?.[0] || {}) as any;
    const newUsersCount = Number(usersFacet[0]?.count?.[0]?.n || 0);
    const walletGroups = (walletFacet || []) as Array<{ _id: string; amountCents: number }>;
    const walletCreditsCents = Number(walletGroups.find((g) => g._id === 'CREDIT')?.amountCents || 0);
    const walletDebitsCents = Number(walletGroups.find((g) => g._id === 'DEBIT')?.amountCents || 0);
    const withdrawalTotals = (withdrawalsFacet[0] || {}) as any;

    const totalOrders = Number(orderTotals.totalOrders || 0);
    const settledOrders = Number(orderTotals.settledOrders || 0);
    const pendingOrders = Number(orderTotals.pendingOrders || 0);
    const failedOrders = Number(orderTotals.failedOrders || 0);
    const orderVolumeCents = Number(orderTotals.orderVolumeCents || 0);
    const revenueCents = Number(treasuryTotals.revenueCents || 0);
    const ownerProfitCents = Number(treasuryTotals.ownerProfitCents || 0);
    const nrPoolInjectedCents = Number(treasuryTotals.nrPoolInjectedCents || 0);
    const zeroSumDifferenceCents = ownerProfitCents + nrPoolInjectedCents - revenueCents;
    const successRatePct = settledOrders + failedOrders > 0
      ? Number(((settledOrders / (settledOrders + failedOrders)) * 100).toFixed(2))
      : 0;

    const seriesMap = new Map<string, AdminAnalyticsBucket>();
    const ensureBucket = (key: string) => {
      if (!seriesMap.has(key)) {
        seriesMap.set(key, {
          bucket: key,
          label: bucketLabel(key, granularity),
          orderVolumeCents: 0,
          settledOrders: 0,
          totalOrders: 0,
          revenueCents: 0,
          ownerProfitCents: 0,
          newUsers: 0,
        });
      }
      return seriesMap.get(key)!;
    };

    const orderSeries = (ordersFacet[0]?.series || []) as any[];
    const treasurySeries = (treasuryFacet[0]?.series || []) as any[];
    const userSeries = (usersFacet[0]?.series || []) as any[];

    for (const row of orderSeries) {
      const key = toBucketKey(row._id, granularity);
      if (!key) continue;
      const bucket = ensureBucket(key);
      bucket.orderVolumeCents = Number(row.orderVolumeCents || 0);
      bucket.settledOrders = Number(row.settledOrders || 0);
      bucket.totalOrders = Number(row.totalOrders || 0);
    }
    for (const row of treasurySeries) {
      const key = toBucketKey(row._id, granularity);
      if (!key) continue;
      const bucket = ensureBucket(key);
      bucket.revenueCents = Number(row.revenueCents || 0);
      bucket.ownerProfitCents = Number(row.ownerProfitCents || 0);
    }
    for (const row of userSeries) {
      const key = toBucketKey(row._id, granularity);
      if (!key) continue;
      ensureBucket(key).newUsers = Number(row.newUsers || 0);
    }

    const sortedKeys = Array.from(seriesMap.keys()).sort();
    const earliestKey = sortedKeys[0];
    const seriesFrom = from || (earliestKey ? new Date(
      granularity === 'month' ? `${earliestKey}-01T00:00:00.000Z` : `${earliestKey}T00:00:00.000Z`
    ) : now);
    const allKeys = enumerateBuckets(seriesFrom, now, granularity);
    const series = allKeys.map((key) => ensureBucket(key));

    const statusBreakdown: AdminAnalyticsBreakdownRow[] = ((ordersFacet[0]?.statuses || []) as any[]).map((row) => ({
      key: String(row._id || 'UNKNOWN'),
      label: String(row._id || 'UNKNOWN'),
      count: Number(row.count || 0),
      volumeCents: Number(row.volumeCents || 0),
    }));

    const railBreakdown: AdminAnalyticsBreakdownRow[] = ((ordersFacet[0]?.rails || []) as any[]).map((row) => ({
      key: String(row._id || 'UNKNOWN'),
      label: String(row._id || 'UNKNOWN'),
      count: Number(row.count || 0),
      volumeCents: Number(row.volumeCents || 0),
    }));

    const revenueBreakdown: AdminAnalyticsRevenueRow[] = ((treasuryFacet[0]?.breakdown || []) as any[]).map((row) => ({
      key: String(row._id || 'UNKNOWN'),
      label: SOURCE_LABELS[String(row._id)] || String(row._id || 'Other'),
      grossCents: Number(row.grossCents || 0),
      revenueCents: Number(row.revenueCents || 0),
    }));

    const topProducts: AdminAnalyticsTopProduct[] = ((ordersFacet[0]?.topProducts || []) as any[]).map((row) => ({
      sku: String(row._id || 'UNKNOWN'),
      title: String(row.title || row._id || 'Unknown product'),
      quantity: Number(row.quantity || 0),
      revenueCents: Number(row.revenueCents || 0),
    }));

    const recentOrders: AdminAnalyticsRecentOrder[] = ((ordersFacet[0]?.recent || []) as any[]).map((row) => ({
      id: String(row.id || ''),
      orderNumber: String(row.order_number || ''),
      buyerEmail: String(row.buyerEmail || ''),
      buyerName: row.buyerName ? String(row.buyerName) : undefined,
      status: String(row.status || 'UNKNOWN'),
      rail: String(row.payment_rail || 'UNKNOWN'),
      totalCents: Number(row.total_cents || 0),
      createdAt: String(row.created_at || ''),
    }));

    let previousNewUsers = 0;
    let previousOrders = 0;
    let previousRevenue = 0;
    if (previousFrom && previousTo) {
      const [prevUsers, prevOrdersAgg, prevTreasuryAgg] = await Promise.all([
        usersCol.countDocuments({
          $expr: {
            $and: [
              { $gte: [{ $convert: { input: { $ifNull: ['$createdAt', '$created_at'] }, to: 'date', onError: null, onNull: null } }, new Date(previousFrom)] },
              { $lt: [{ $convert: { input: { $ifNull: ['$createdAt', '$created_at'] }, to: 'date', onError: null, onNull: null } }, new Date(previousTo)] },
            ],
          },
        }),
        ordersCol
          .aggregate([
            { $match: { created_at: { $gte: previousFrom, $lt: previousTo } } },
            { $group: { _id: null, n: { $sum: 1 } } },
          ])
          .toArray(),
        treasuryCol
          .aggregate([
            { $match: { created_at: { $gte: previousFrom, $lt: previousTo } } },
            { $group: { _id: null, revenue: { $sum: { $ifNull: ['$total_revenue_cents', 0] } } } },
          ])
          .toArray(),
      ]);
      previousNewUsers = prevUsers;
      previousOrders = Number(prevOrdersAgg[0]?.n || 0);
      previousRevenue = Number(prevTreasuryAgg[0]?.revenue || 0);
    }

    const lifetimeOrderTotals = (lifetimeOrders[0] || {}) as any;
    const lifetimeTreasuryTotals = (lifetimeTreasury[0] || {}) as any;

    const response: AdminAnalyticsResponse = {
      range: {
        key: range,
        label: config.label,
        from: fromIso,
        to: now.toISOString(),
        days: config.days,
        granularity,
      },
      generatedAt: now.toISOString(),
      overview: {
        totalUsers,
        activeUsers: Number((ordersFacet[0]?.activeUsers?.[0]?.count) || 0),
        newUsers: newUsersCount,
        userGrowthPct: pctChange(newUsersCount, previousNewUsers),
        totalOrders,
        settledOrders,
        pendingOrders,
        failedOrders,
        successRatePct,
        orderVolumeCents,
        averageOrderValueCents: settledOrders > 0 ? Math.round(orderVolumeCents / settledOrders) : 0,
        grossTreasuryVolumeCents: Number(treasuryTotals.grossCents || 0),
        revenueCents,
        feeCents: Number(treasuryTotals.feeCents || 0),
        spreadCents: Number(treasuryTotals.spreadCents || 0),
        gasArbitrageCents: Number(treasuryTotals.gasArbitrageCents || 0),
        ownerProfitCents,
        nrPoolInjectedCents,
        zeroSumDifferenceCents,
        isBalanced: zeroSumDifferenceCents === 0,
        custodyUsdCents: Number(custody?.total_custody_usd_cents || 0),
        nrPoolReserveUsdCents: Number(pool?.reserveUsdCents || 0),
        walletCreditsCents,
        walletDebitsCents,
        tokenWithdrawalsCount: Number(withdrawalTotals.count || 0),
        tokenWithdrawalUnits: Number(withdrawalTotals.units || 0),
      },
      lifetime: {
        orderVolumeCents: Number(lifetimeOrderTotals.orderVolumeCents || 0),
        settledOrders: Number(lifetimeOrderTotals.settledOrders || 0),
        totalOrders: Number(lifetimeOrderTotals.totalOrders || 0),
        revenueCents: Number(lifetimeTreasuryTotals.revenueCents || 0),
        ownerProfitCents: Number(lifetimeTreasuryTotals.ownerProfitCents || 0),
        grossTreasuryVolumeCents: Number(lifetimeTreasuryTotals.grossCents || 0),
        totalUsers,
      },
      series,
      statusBreakdown,
      railBreakdown,
      revenueBreakdown,
      topProducts,
      custodyAssets: custody?.assets || [],
      recentOrders,
      dataQuality: {
        notes: [
          'Transaction volume is the value of settled orders (PAID, FULFILLING, FULFILLED); it is not profit.',
          'Revenue is platform fee, spread, and gas-surplus revenue recorded in platform_treasury. Owner profit is the 50% owner share recorded by the split engine.',
          'Custody value is the live oracle valuation of positive user holdings; it is not a cash balance.',
          'The $NXL reserve figure is the AMM reserve balance, separate from cumulative buyback injections.',
          'Wallet credits/debits are ledger movements (cashout proceeds, cashback, purchases), not external fiat deposits.',
        ],
        unavailableMetrics: [
          {
            metric: 'Treasury cash balance',
            reason: 'The database tracks revenue entries and AMM reserve state, but not a reconciled cash/bank account balance.',
            requiredChange: 'Add a treasury account ledger with opening balance, deposits, withdrawals, and reconciliation entries.',
          },
          {
            metric: 'External fiat deposits',
            reason: 'No fiat deposit provider ledger is persisted; wallet credits currently represent cashout proceeds and cashback.',
            requiredChange: 'Persist Stripe/bank deposit events with provider IDs and statuses in a dedicated deposits collection.',
          },
          {
            metric: 'Gross profit / COGS',
            reason: 'Product cost basis is not stored per order line, so gross margin cannot be derived from orders alone.',
            requiredChange: 'Add cost_cents per product/order item and compute COGS at settlement time.',
          },
          {
            metric: 'Refund-adjusted net revenue',
            reason: 'Refunds are not written to platform_treasury as negative revenue entries.',
            requiredChange: 'Record refund reversals in platform_treasury and subtract them in the revenue aggregation.',
          },
        ],
      },
    };

    await RedisCacheService.setCache(cacheKey, response, 30);
    return response;
  }
}
