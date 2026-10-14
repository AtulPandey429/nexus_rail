import { Router, Request, Response } from 'express';
import { MongoService, MongoOrderDoc } from '../services/mongo.js';

export const analyticsRouter = Router();

analyticsRouter.get('/summary', async (_req: Request, res: Response) => {
  try {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const orders = await ordersCol.find().toArray();
    const paid = orders.filter((row) => ['PAID', 'FULFILLING', 'FULFILLED'].includes(row.status));
    const totalRevenueCents = paid.reduce((sum, row) => sum + (row.total_cents || 0), 0);
    const railBreakdown: Record<string, number> = {};
    for (const row of paid) {
      const rail = row.payment_rail || 'UNKNOWN';
      railBreakdown[rail] = (railBreakdown[rail] || 0) + 1;
    }

    res.json({
      success: true,
      data: {
        totalRevenueCents,
        totalOrders: paid.length,
        railBreakdown,
        averageOrderValueCents: paid.length ? Math.round(totalRevenueCents / paid.length) : 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Could not load analytics' });
  }
});
