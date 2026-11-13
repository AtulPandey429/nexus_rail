import { Router, Response } from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { MongoService, MongoOrderDoc } from '../services/mongo.js';
import { ProductService } from '../services/products.js';
import { NrTokenService } from '../services/nrTokenService.js';
import { RedisCacheService } from '../services/redis.js';
import { PortfolioService } from '../services/portfolioService.js';
import { z } from 'zod';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const AdjustReserveSchema = z.object({
  deltaUsdCents: z.number().int().refine((n) => n !== 0, 'deltaUsdCents must be non-zero'),
  note: z.string().max(160).optional(),
});

const AllocationItemSchema = z.object({
  symbol: z.enum(['GOLD_G', 'SILVER_G', 'XRP', 'XLM', 'USDC', 'NR']),
  label: z.string().min(1).max(60),
  unitQty: z.number().positive(),
});

const UpsertProductSchema = z.object({
  sku: z.string().min(2).max(64),
  title: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  price_cents: z.number().int().positive().optional(),
  category: z.string().min(2).max(40).default('baskets'),
  stock_quantity: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  rail: z.enum(['stellar', 'xrpl', 'multi']).optional(),
  tag: z.string().max(60).optional(),
  is_basket: z.boolean().optional(),
  is_live_asset: z.boolean().optional(),
  allocations: z.array(AllocationItemSchema).optional(),
});

const PatchProductSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
  price_cents: z.number().int().positive().optional(),
  stock_quantity: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  category: z.string().min(2).max(40).optional(),
  tag: z.string().max(60).optional(),
  allocations: z.array(AllocationItemSchema).optional(),
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
    const products = await ProductService.getAllProductsForAdmin();
    res.json({ success: true, data: { products } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/products', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = UpsertProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid product payload', details: parsed.error.format() });
  }

  try {
    const product = await ProductService.upsertAdminProduct(parsed.data);
    await RedisCacheService.invalidateCache('products:active');
    res.status(201).json({ success: true, data: { product } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to save product' });
  }
});

adminRouter.patch('/products/:sku', async (req: AuthenticatedRequest, res: Response) => {
  const sku = (Array.isArray(req.params.sku) ? req.params.sku[0] : req.params.sku).trim();
  const parsed = PatchProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid product update payload', details: parsed.error.format() });
  }

  try {
    const product = await ProductService.patchProductBySku(sku, parsed.data);
    if (!product) {
      return res.status(404).json({ success: false, error: `Product ${sku} not found` });
    }
    await RedisCacheService.invalidateCache('products:active');
    res.json({ success: true, data: { product } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update product' });
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

adminRouter.get('/portfolios', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const auc = await PortfolioService.getPlatformAUC();
    res.json({ success: true, data: auc });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to aggregate platform AUC' });
  }
});
