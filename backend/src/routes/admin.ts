import { Router, Response } from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { MongoService, MongoOrderDoc } from '../services/mongo.js';
import { ProductService } from '../services/products.js';
import { NrTokenService } from '../services/nrTokenService.js';
import { z } from 'zod';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const AdjustReserveSchema = z.object({
  deltaUsdCents: z.number().int().refine((n) => n !== 0, 'deltaUsdCents must be non-zero'),
  note: z.string().max(160).optional(),
});

const transitions: Record<string, string[]> = {
  PENDING: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['FULFILLING', 'FAILED'],
  FULFILLING: ['FULFILLED', 'FAILED'],
  FULFILLED: [],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

adminRouter.get('/stats', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const productsCol = await MongoService.getCollection('products');
    const usersCol = await MongoService.getCollection('users');

    const [orders, productsCount, usersCount] = await Promise.all([
      ordersCol.find().toArray(),
      productsCol.countDocuments(),
      usersCol.countDocuments(),
    ]);

    const paid = orders.filter((row) => ['PAID', 'FULFILLING', 'FULFILLED'].includes(row.status));
    const totalVolumeCents = paid.reduce((sum, row) => sum + (row.total_cents || 0), 0);

    res.json({
      success: true,
      status: 'success',
      data: {
        totalVolumeCents,
        totalOrdersCount: orders.length,
        productsCount,
        usersCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.get('/orders', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const orders = await ordersCol.find().sort({ created_at: -1 }).toArray();

    res.json({
      success: true,
      status: 'success',
      data: {
        orders: orders.map((row) => ({
          id: row.id,
          orderNumber: row.order_number,
          status: row.status,
          totalCents: row.total_cents,
          createdAt: row.created_at,
          buyerEmail: row.user_id,
          rail: row.payment_rail,
          items: row.items,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.patch('/orders/:id', async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const status = req.body?.status;

  try {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const current = await ordersCol.findOne({ $or: [{ id }, { order_number: id }] });
    if (!current) return res.status(404).json({ success: false, error: 'Order not found' });

    if (!transitions[current.status]?.includes(status)) {
      return res.status(400).json({ success: false, error: `Cannot change ${current.status} to ${status}` });
    }

    const updated = await ordersCol.findOneAndUpdate(
      { id: current.id },
      { $set: { status, updated_at: new Date().toISOString() } },
      { returnDocument: 'after' }
    );

    res.json({ success: true, status: 'success', data: { order: updated } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.get('/products', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const products = await ProductService.getActiveProducts();
    res.json({ success: true, data: { products } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.get('/users', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const usersCol = await MongoService.getCollection('users');
    const users = await usersCol.find({}, { projection: { passwordHash: 0 } }).toArray();
    res.json({ success: true, data: { users } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.get('/nr-pool', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await NrTokenService.getPoolStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load $NR pool' });
  }
});

adminRouter.post('/nr-pool/adjust-reserve', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = AdjustReserveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid reserve adjustment payload', details: parsed.error.format() });
  }

  try {
    const stats = await NrTokenService.adminAdjustReserve({
      deltaUsdCents: parsed.data.deltaUsdCents,
      adminId: req.user!.id,
      note: parsed.data.note,
    });
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Reserve adjustment failed' });
  }
});
