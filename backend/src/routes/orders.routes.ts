import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { OrderController } from '../controllers/order.controller.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

// POST /api/v1/orders/validate-coupon - Server-authoritative promo validation
ordersRouter.post('/validate-coupon', OrderController.validateCoupon);

// GET /api/v1/orders - Get user's order history
ordersRouter.get('/', OrderController.getOrders);

// GET /api/v1/orders/:id - Get specific order details
ordersRouter.get('/:id', OrderController.getOrderById);

// POST /api/v1/orders - Create an order with tamper-proof pricing
ordersRouter.post('/', OrderController.createOrder);
