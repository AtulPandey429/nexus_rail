import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { CartService } from '../services/cart.service.js';

export class CartController {
  /**
   * GET /api/v1/cart - Load user's active shopping cart
   */
  static async getCart(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const items = await CartService.getCart(req.user!.id);
      res.json({ success: true, data: { items } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Could not load the cart' });
    }
  }

  /**
   * PUT /api/v1/cart/items - Update or add item quantity
   */
  static async updateCartItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { sku, qty } = req.body ?? {};
    if (typeof sku !== 'string' || typeof qty !== 'number') {
      res.status(400).json({ success: false, error: 'sku and numeric qty are required' });
      return;
    }

    try {
      const items = await CartService.updateItem(req.user!.id, sku, qty);
      res.json({ success: true, data: { items } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Could not update the cart' });
    }
  }

  /**
   * DELETE /api/v1/cart - Clear user's active cart after payment
   */
  static async clearCart(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await CartService.clearCart(req.user!.id);
      res.json({ success: true, data: { items: [] } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Could not clear cart' });
    }
  }
}
