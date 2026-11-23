import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { CartController } from '../controllers/cart.controller.js';

export const cartRouter = Router();
cartRouter.use(requireAuth);

// GET /api/v1/cart - Load user's active shopping cart
cartRouter.get('/', CartController.getCart);

// PUT /api/v1/cart/items - Update or add item quantity
cartRouter.put('/items', CartController.updateCartItem);

// DELETE /api/v1/cart - Clear user's active cart
cartRouter.delete('/', CartController.clearCart);
