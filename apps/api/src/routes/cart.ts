import { Router, Request, Response } from 'express';

export const cartRouter = Router();

// In-memory cart store per user for showcase/demo
const userCarts: Record<string, { sku: string; qty: number }[]> = {
  'demo-user-1': [{ sku: 'NL-NOTE-A5', qty: 1 }],
};

// GET /api/v1/cart
cartRouter.get('/', (req: Request, res: Response) => {
  const userId = (req.headers['x-user-id'] as string) || 'demo-user-1';
  const cart = userCarts[userId] || [];
  return res.json({ status: 'success', data: { items: cart } });
});

// PUT /api/v1/cart/items
cartRouter.put('/items', (req: Request, res: Response) => {
  const userId = (req.headers['x-user-id'] as string) || 'demo-user-1';
  const { sku, qty } = req.body;

  if (!sku || typeof qty !== 'number') {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'sku and numeric qty required' } });
  }

  if (!userCarts[userId]) {
    userCarts[userId] = [];
  }

  const existing = userCarts[userId].find((item) => item.sku === sku);
  if (existing) {
    if (qty <= 0) {
      userCarts[userId] = userCarts[userId].filter((item) => item.sku !== sku);
    } else {
      existing.qty = qty;
    }
  } else if (qty > 0) {
    userCarts[userId].push({ sku, qty });
  }

  return res.json({ status: 'success', data: { items: userCarts[userId] } });
});

// DELETE /api/v1/cart/items/:sku
cartRouter.delete('/items/:sku', (req: Request, res: Response) => {
  const userId = (req.headers['x-user-id'] as string) || 'demo-user-1';
  const { sku } = req.params;

  if (userCarts[userId]) {
    userCarts[userId] = userCarts[userId].filter((item) => item.sku !== sku);
  }

  return res.json({ status: 'success', data: { items: userCarts[userId] || [] } });
});

// POST /api/v1/cart/merge (Guest cart to logged-in user cart)
cartRouter.post('/merge', (req: Request, res: Response) => {
  const userId = (req.headers['x-user-id'] as string) || 'demo-user-1';
  const { guestItems } = req.body; // Array of { sku, qty }

  if (Array.isArray(guestItems)) {
    if (!userCarts[userId]) userCarts[userId] = [];

    guestItems.forEach((gItem) => {
      const existing = userCarts[userId].find((item) => item.sku === gItem.sku);
      if (existing) {
        existing.qty += gItem.qty;
      } else {
        userCarts[userId].push({ sku: gItem.sku, qty: gItem.qty });
      }
    });
  }

  return res.json({ status: 'success', data: { items: userCarts[userId] } });
});
