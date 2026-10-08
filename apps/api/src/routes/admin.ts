import { Router, Request, Response } from 'express';
import { masterOrdersStore, OrderRecord } from './orders.js';

export const adminRouter = Router();

// Mock users store for admin user management
const usersStore = [
  { id: 'usr_1', email: 'buyer@example.com', role: 'user', createdAt: '2026-10-01T10:00:00.000Z' },
  { id: 'usr_2', email: 'admin@nexusrail.dev', role: 'admin', createdAt: '2026-10-01T10:00:00.000Z' },
];

// Mock products store for admin product management
const productsStore = [
  { id: 'prod_1', sku: 'NL-NOTE-A5', title: 'Nexus A5 Hardcover Notebook Set', description: 'Premium 120gsm lay-flat notebook', priceCents: 2400, category: 'Stationery', stockQuantity: 50, active: true },
  { id: 'prod_2', sku: 'NL-PEN-SET', title: 'Nexus Precision Gel Pen Set', description: '0.5mm matte black architectural pens (3-pack)', priceCents: 1800, category: 'Stationery', stockQuantity: 120, active: true },
  { id: 'prod_3', sku: 'NL-LAMP', title: 'Nexus Minimalist LED Desk Lamp', description: 'Touch dimmable USB-C architectural lamp', priceCents: 4200, category: 'Lighting', stockQuantity: 30, active: true },
];

// Middleware helper to check admin role
const checkAdmin = (req: Request, res: Response, next: Function) => {
  const role = (req.headers['x-user-role'] as string) || 'admin';
  if (role !== 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } });
  }
  next();
};

adminRouter.use(checkAdmin);

// GET /api/v1/admin/stats
adminRouter.get('/stats', (_req: Request, res: Response) => {
  const totalVolumeCents = masterOrdersStore
    .filter((o) => o.status === 'PAID' || o.status === 'FULFILLING' || o.status === 'FULFILLED')
    .reduce((acc, o) => acc + o.totalCents, 0);

  const statusCounts = {
    PENDING: masterOrdersStore.filter((o) => o.status === 'PENDING').length,
    PAID: masterOrdersStore.filter((o) => o.status === 'PAID').length,
    FULFILLING: masterOrdersStore.filter((o) => o.status === 'FULFILLING').length,
    FULFILLED: masterOrdersStore.filter((o) => o.status === 'FULFILLED').length,
    FAILED: masterOrdersStore.filter((o) => o.status === 'FAILED').length,
  };

  return res.json({
    status: 'success',
    data: {
      totalVolumeCents,
      totalOrdersCount: masterOrdersStore.length,
      statusCounts,
      productsCount: productsStore.length,
      usersCount: usersStore.length,
    },
  });
});

// Admin Products API
adminRouter.get('/products', (_req: Request, res: Response) => {
  return res.json({ status: 'success', data: { products: productsStore } });
});

adminRouter.post('/products', (req: Request, res: Response) => {
  const { sku, title, description, priceCents, category, stockQuantity } = req.body;
  const newProduct = {
    id: `prod_${Date.now()}`,
    sku: sku || `SKU-${Date.now()}`,
    title: title || 'New Desk Kit Product',
    description: description || 'High quality desk accessory',
    priceCents: priceCents || 2500,
    category: category || 'Desk Accessories',
    stockQuantity: stockQuantity || 20,
    active: true,
  };
  productsStore.push(newProduct);
  return res.json({ status: 'success', data: { product: newProduct } });
});

adminRouter.patch('/products/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const prod = productsStore.find((p) => p.id === id || p.sku === id);
  if (!prod) return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } });

  Object.assign(prod, req.body);
  return res.json({ status: 'success', data: { product: prod } });
});

// Admin Orders API
adminRouter.get('/orders', (_req: Request, res: Response) => {
  return res.json({ status: 'success', data: { orders: masterOrdersStore } });
});

// PATCH /api/v1/admin/orders/:id (Status Transition Guard: PAID -> FULFILLING -> FULFILLED)
adminRouter.patch('/orders/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body as { status: OrderRecord['status'] };

  const order = masterOrdersStore.find((o) => o.id === id || o.orderNumber === id);
  if (!order) return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });

  // Valid state transitions rule enforcement
  const allowedTransitions: Record<string, string[]> = {
    PENDING: ['PAID', 'FAILED'],
    PAID: ['FULFILLING', 'FAILED'],
    FULFILLING: ['FULFILLED', 'FAILED'],
    FULFILLED: [],
    FAILED: [],
  };

  if (!allowedTransitions[order.status]?.includes(status)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot transition order status from ${order.status} to ${status}`,
      },
    });
  }

  order.status = status;
  return res.json({ status: 'success', data: { order } });
});

// Admin Users API
adminRouter.get('/users', (_req: Request, res: Response) => {
  return res.json({ status: 'success', data: { users: usersStore } });
});

adminRouter.patch('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  const user = usersStore.find((u) => u.id === id || u.email === id);
  if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });

  if (role === 'user') {
    const adminCount = usersStore.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1 && user.role === 'admin') {
      return res.status(400).json({ error: { code: 'LAST_ADMIN_PROTECTION', message: 'Cannot demote the last remaining admin' } });
    }
  }

  user.role = role;
  return res.json({ status: 'success', data: { user } });
});
