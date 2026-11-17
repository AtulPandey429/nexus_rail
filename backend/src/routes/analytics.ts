import { Router, Response } from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { MongoService, MongoOrderDoc } from '../services/mongo.js';
import { TreasuryService } from '../services/treasuryService.js';
import { RedisCacheService } from '../services/redis.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, requireAdmin);

const SETTLED_STATUSES = ['PAID', 'FULFILLING', 'FULFILLED'];

analyticsRouter.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const cacheKey = 'analytics:summary';
    if (!forceRefresh) {
      const cached = await RedisCacheService.getCache<any>(cacheKey);
      if (cached) {
        return res.json({ success: true, cached: true, data: cached });
      }
    }

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const [orderAgg, treasury] = await Promise.all([
      ordersCol
        .aggregate<{
          totals: Array<{ totalOrders: number; settledOrders: number; totalVolumeCents: number }>;
          rails: Array<{ _id: string; count: number }>;
        }>([
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
                    totalVolumeCents: {
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
              rails: [
                { $match: { status: { $in: SETTLED_STATUSES } } },
                {
                  $group: {
                    _id: { $ifNull: ['$payment_rail', 'UNKNOWN'] },
                    count: { $sum: 1 },
                  },
                },
              ],
            },
          },
        ])
        .toArray()
        .then((rows) => rows[0] || { totals: [], rails: [] }),
      TreasuryService.getTreasurySummary().catch(() => null),
    ]);

    const totals = orderAgg.totals[0] || { totalOrders: 0, settledOrders: 0, totalVolumeCents: 0 };
    const railBreakdown: Record<string, number> = {};
    for (const row of orderAgg.rails) {
      railBreakdown[String(row._id || 'UNKNOWN')] = Number(row.count || 0);
    }

    const payload = {
      totalVolumeCents: Number(totals.totalVolumeCents || 0),
      totalRevenueCents: Number(treasury?.totalRevenueCents || 0),
      netOwnerProfitCents: Number(treasury?.netOwnerProfitCents || 0),
      totalOrders: Number(totals.totalOrders || 0),
      settledOrders: Number(totals.settledOrders || 0),
      railBreakdown,
      averageOrderValueCents:
        totals.settledOrders > 0 ? Math.round(totals.totalVolumeCents / totals.settledOrders) : 0,
      timestamp: new Date().toISOString(),
    };

    await RedisCacheService.setCache(cacheKey, payload, 30);
    res.json({ success: true, cached: false, data: payload });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Could not load analytics' });
  }
});
