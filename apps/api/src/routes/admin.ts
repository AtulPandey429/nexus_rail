import { Router, Response } from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { MongoService, MongoOrderDoc } from '../services/mongo.js';
import { ProductService } from '../services/products.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

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
