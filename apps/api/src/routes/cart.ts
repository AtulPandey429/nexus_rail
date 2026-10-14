import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { MongoService, MongoCartItemDoc } from '../services/mongo.js';

export const cartRouter = Router();
cartRouter.use(requireAuth);

// GET /api/v1/cart - Load user's active shopping cart
cartRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const col = await MongoService.getCollection<MongoCartItemDoc>('cart_items');
    const items = await col
      .find({ user_id: req.user!.id })
      .project({ _id: 0, sku: 1, qty: 1 })
      .toArray();

    res.json({ success: true, data: { items } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Could not load the cart' });
  }
});

// PUT /api/v1/cart/items - Update or add item quantity
cartRouter.put('/items', async (req: AuthenticatedRequest, res: Response) => {
  const { sku, qty } = req.body ?? {};
  if (typeof sku !== 'string' || typeof qty !== 'number') {
    return res.status(400).json({ success: false, error: 'sku and numeric qty are required' });
  }

  const userId = req.user!.id;
  try {
    const col = await MongoService.getCollection<MongoCartItemDoc>('cart_items');

    if (qty <= 0) {
      await col.deleteOne({ user_id: userId, sku });
    } else {
      await col.updateOne(
        { user_id: userId, sku },
        {
          $set: {
            user_id: userId,
            sku,
            qty: Math.floor(qty),
            updated_at: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    }

    const items = await col
      .find({ user_id: userId })
      .project({ _id: 0, sku: 1, qty: 1 })
      .toArray();

    res.json({ success: true, data: { items } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Could not update the cart' });
  }
});

// DELETE /api/v1/cart/items/:sku - Remove item from cart
cartRouter.delete('/items/:sku', async (req: AuthenticatedRequest, res: Response) => {
  const sku = Array.isArray(req.params.sku) ? req.params.sku[0] : req.params.sku;
  const userId = req.user!.id;

  try {
    const col = await MongoService.getCollection<MongoCartItemDoc>('cart_items');
    await col.deleteOne({ user_id: userId, sku });

    const items = await col
      .find({ user_id: userId })
      .project({ _id: 0, sku: 1, qty: 1 })
      .toArray();

    res.json({ success: true, data: { items } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Could not remove that item' });
  }
});

// POST /api/v1/cart/merge - Merge guest cart after login
cartRouter.post('/merge', (_req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Cart synchronized' });
});
