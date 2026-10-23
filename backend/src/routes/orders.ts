import { Router, Response } from 'express';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { MongoService, MongoOrderDoc, OrderItem, MongoCartItemDoc } from '../services/mongo.js';
import { ProductService } from '../services/products.js';
import { OrderSequenceService } from '../services/orderSequence.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

function formatOrder(order: MongoOrderDoc) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    totalCents: order.total_cents,
    rail: order.payment_rail,
    txHash: order.tx_hash,
    paymentAddress: order.payment_address,
    paymentMemo: order.payment_memo,
    ipfsHash: order.ipfs_cid,
    createdAt: order.created_at,
    items: order.items || [],
  };
}

// GET /api/v1/orders - Get user's order history
ordersRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const orders = await ordersCol
      .find({ user_id: req.user!.id })
      .sort({ created_at: -1 })
      .toArray();

    res.json({ success: true, data: { orders: orders.map(formatOrder) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Could not load orders' });
  }
});

// GET /api/v1/orders/:id - Get specific order details
ordersRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const variants = OrderSequenceService.getLookupVariants(id);
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const order = await ordersCol.findOne({
      $or: [
        { id: { $in: variants } },
        { order_number: { $in: variants } },
      ],
      user_id: req.user!.id,
    });

    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, data: { order: formatOrder(order) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Could not load order' });
  }
});

// POST /api/v1/orders - Create an order with tamper-proof pricing
ordersRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    return res.status(400).json({ success: false, error: 'Order items are required' });
  }

  try {
    const pricedItems: OrderItem[] = [];

    // Server-side price validation directly from verified MongoDB catalog
    for (const item of items) {
      if (!item.sku || typeof item.sku !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid SKU in order items' });
      }

      const product = await ProductService.getProductBySku(item.sku);
      if (!product || !product.active) {
        return res.status(400).json({ success: false, error: `SKU ${item.sku} is not available for purchase` });
      }

      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({ success: false, error: 'Quantity must be a positive integer' });
      }

      pricedItems.push({
        sku: product.sku,
        title: product.title,
        qty,
        unit_price_cents: product.price_cents,
      });
    }

    const totalCents = pricedItems.reduce((sum, item) => sum + item.unit_price_cents * item.qty, 0);
    const orderId = crypto.randomUUID();
    const orderNumber = await OrderSequenceService.getNextOrderNumber();
    const now = new Date().toISOString();

    const orderDoc: MongoOrderDoc = {
      id: orderId,
      user_id: req.user!.id,
      order_number: orderNumber,
      total_cents: totalCents,
      items: pricedItems,
      payment_rail: req.body?.rail || 'PENDING',
      status: 'PENDING',
      created_at: now,
      updated_at: now,
    };

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    await ordersCol.insertOne(orderDoc as any);

    // If order was created from cart, clear user's cart
    if (req.body?.fromCart) {
      const cartCol = await MongoService.getCollection<MongoCartItemDoc>('cart_items');
      await cartCol.deleteMany({ user_id: req.user!.id });
    }

    res.json({ success: true, data: { order: formatOrder(orderDoc) } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Could not create the order' });
  }
});
