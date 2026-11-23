import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { MongoService, MongoOrderDoc } from '../services/mongo.js';
import { TreasuryService } from '../services/treasury.service.js';
import { RedisCacheService } from '../services/redis.js';

const SETTLED_STATUSES = ['PAID', 'FULFILLING', 'FULFILLED'];

export class AnalyticsController {
  /**
   * GET /api/v1/analytics/summary
   */
  static async getSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const cacheKey = 'analytics:summary';
      if (!forceRefresh) {
        const cached = await RedisCacheService.getCache<any>(cacheKey);
        if (cached) {
          res.json({ success: true, cached: true, data: cached });
          return;
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
  }
}
