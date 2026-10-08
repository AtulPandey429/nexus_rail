import { Router, Request, Response } from 'express';

export const ordersRouter = Router();

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string;
  status: 'PENDING' | 'PAID' | 'FULFILLING' | 'FULFILLED' | 'FAILED';
  totalCents: number;
  rail: string;
  items: { sku: string; qty: number; unitPriceCents: number }[];
  createdAt: string;
  idempotencyKey?: string;
}

// In-memory orders store
export const masterOrdersStore: OrderRecord[] = [
  {
    id: 'ord_1001',
    orderNumber: 'NR-1001',
    userId: 'demo-user-1',
    status: 'PAID',
    totalCents: 2400,
    rail: 'STRIPE',
    items: [{ sku: 'NL-NOTE-A5', qty: 1, unitPriceCents: 2400 }],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'ord_1002',
    orderNumber: 'NR-1002',
    userId: 'demo-user-1',
    status: 'FULFILLED',
    totalCents: 4200,
    rail: 'STRIPE',
    items: [{ sku: 'NL-LAMP', qty: 1, unitPriceCents: 4200 }],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

// POST /api/v1/orders
ordersRouter.post('/', (req: Request, res: Response) => {
  const userId = (req.headers['x-user-id'] as string) || 'demo-user-1';
  const idempotencyKey = req.headers['idempotency-key'] as string;
  const { rail = 'STRIPE', items = [] } = req.body;

  if (idempotencyKey) {
    const existing = masterOrdersStore.find((o) => o.idempotencyKey === idempotencyKey);
    if (existing) {
      return res.json({ status: 'success', data: { order: existing } });
    }
  }

  const orderItems = items.length > 0 ? items : [{ sku: 'NL-NOTE-A5', qty: 1, unitPriceCents: 2400 }];
  const totalCents = orderItems.reduce((acc: number, item: any) => acc + (item.unitPriceCents || 2400) * item.qty, 0);

  const orderNum = `NR-${1000 + masterOrdersStore.length + 1}`;
  const newOrder: OrderRecord = {
    id: `ord_${Date.now()}`,
    orderNumber: orderNum,
    userId,
    status: 'PENDING',
    totalCents,
    rail,
    items: orderItems,
    createdAt: new Date().toISOString(),
    idempotencyKey,
  };

  masterOrdersStore.unshift(newOrder);
  return res.json({ status: 'success', data: { order: newOrder } });
});

// GET /api/v1/orders
ordersRouter.get('/', (req: Request, res: Response) => {
  const userId = (req.headers['x-user-id'] as string) || 'demo-user-1';
  const userOrders = masterOrdersStore.filter((o) => o.userId === userId);
  return res.json({ status: 'success', data: { orders: userOrders } });
});

// GET /api/v1/orders/:id
ordersRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const order = masterOrdersStore.find((o) => o.id === id || o.orderNumber === id);
  if (!order) {
    return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
  }
  return res.json({ status: 'success', data: { order } });
});
