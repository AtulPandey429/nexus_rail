import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { CouponService } from '../services/coupon.service.js';
import { OrderService } from '../services/order.service.js';
import { CashbackMintService } from '../services/cashbackMint.service.js';

export class OrderController {
  /**
   * POST /api/v1/orders/validate-coupon
   * Server-authoritative promo validation
   */
  static async validateCoupon(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const code = String(req.body?.code || '').trim();
      const subtotalCents = Number(req.body?.subtotalCents || 0);
      const result = await CouponService.validateCoupon({
        code,
        userId: req.user!.id,
        subtotalCents,
      });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Invalid promo code' });
    }
  }

  /**
   * GET /api/v1/orders
   * Get authenticated user's order history
   */
  static async getOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const orders = await OrderService.getUserOrders(req.user!.id);
      res.json({ success: true, data: { orders } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Could not load orders' });
    }
  }

  /**
   * GET /api/v1/orders/:id
   * Get specific order details
   */
  static async getOrderById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const order = await OrderService.getOrderById(req.user!.id, id);
      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }
      res.json({ success: true, data: { order } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Could not load order' });
    }
  }

  /**
   * POST /api/v1/orders
   * Create an order with tamper-proof pricing
   */
  static async createOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      res.status(400).json({ success: false, error: 'Order items are required' });
      return;
    }

    try {
      const order = await OrderService.createOrder({
        userId: req.user!.id,
        items,
        promoCode: req.body?.promoCode,
        rail: req.body?.rail,
        fromCart: req.body?.fromCart,
      });

      res.json({ success: true, data: { order } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Could not create the order' });
    }
  }

  /**
   * GET /api/v1/orders/:id/cashback-status
   * Returns durable direct on-chain 1:1 cashback minting status for an order
   */
  static async getCashbackStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const issuance = await CashbackMintService.getOrderCashbackStatus(req.user!.id, id);
      res.json({ success: true, data: issuance });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Could not load cashback status' });
    }
  }

  /**
   * POST /api/v1/orders/:id/claim-cashback
   * Claims direct 1:1 on-chain $NXL cashback onto the user's selected Stellar or XRPL wallet
   */
  static async claimCashback(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rawChain = String(req.body?.chain || req.body?.targetChain || '').toUpperCase();
    const recipientAddress = String(req.body?.recipientAddress || req.body?.walletAddress || '').trim();

    if (rawChain !== 'STELLAR' && rawChain !== 'XRPL') {
      res.status(400).json({ success: false, error: 'chain must be STELLAR or XRPL' });
      return;
    }
    if (!recipientAddress) {
      res.status(400).json({ success: false, error: 'recipientAddress is required' });
      return;
    }

    try {
      const issuance = await CashbackMintService.claimOrderCashback({
        userId: req.user!.id,
        orderId: id,
        targetChain: rawChain,
        recipientAddress,
      });
      res.json({ success: true, data: issuance });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to claim on-chain cashback' });
    }
  }
}
