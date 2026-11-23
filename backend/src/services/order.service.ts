import crypto from 'crypto';
import { MongoService, MongoOrderDoc, OrderItem, MongoCartItemDoc } from './mongo.js';
import { ProductService } from './products.js';
import { OrderSequenceService } from './orderSequence.js';
import { CouponService } from './coupon.service.js';

export function formatOrder(order: MongoOrderDoc) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    subtotalCents: order.subtotal_cents ?? order.total_cents,
    discountCents: order.discount_cents ?? 0,
    promoCode: order.promo_code ?? null,
    totalCents: order.total_cents,
    cashbackUsdCents: order.cashback_usd_cents ?? 0,
    cashbackNxlAmount: order.cashback_nxl_amount ?? 0,
    rail: order.payment_rail,
    txHash: order.tx_hash,
    paymentAddress: order.payment_address,
    paymentMemo: order.payment_memo,
    ipfsHash: order.ipfs_cid,
    createdAt: order.created_at,
    items: order.items || [],
  };
}

export class OrderService {
  static async getUserOrders(userId: string) {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const orders = await ordersCol
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .toArray();

    return orders.map(formatOrder);
  }

  static async getOrderById(userId: string, id: string) {
    const variants = OrderSequenceService.getLookupVariants(id);
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const order = await ordersCol.findOne({
      $or: [
        { id: { $in: variants } },
        { order_number: { $in: variants } },
      ],
      user_id: userId,
    });

    if (!order) return null;
    return formatOrder(order);
  }

  static async createOrder(params: {
    userId: string;
    items: Array<{ sku: string; qty: number }>;
    promoCode?: string;
    rail?: string;
    fromCart?: boolean;
  }) {
    const { userId, items, promoCode, rail, fromCart } = params;

    const pricedItems: OrderItem[] = [];

    for (const item of items) {
      if (!item.sku || typeof item.sku !== 'string') {
        throw new Error('Invalid SKU in order items');
      }

      const product = await ProductService.getProductBySku(item.sku);
      if (!product || !product.active) {
        throw new Error(`SKU ${item.sku} is not available for purchase`);
      }

      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty < 1) {
        throw new Error('Quantity must be a positive integer');
      }

      pricedItems.push({
        sku: product.sku,
        title: product.title,
        qty,
        unit_price_cents: product.price_cents,
      });
    }

    const subtotalCents = pricedItems.reduce((sum, item) => sum + item.unit_price_cents * item.qty, 0);
    let discountCents = 0;
    let totalCents = subtotalCents;
    let appliedPromoCode: string | undefined;

    const rawPromo = typeof promoCode === 'string' ? promoCode.trim() : '';
    if (rawPromo) {
      const redeemed = await CouponService.redeemCoupon({
        code: rawPromo,
        userId,
        subtotalCents,
      });
      discountCents = redeemed.discountCents;
      totalCents = redeemed.finalTotalCents;
      appliedPromoCode = redeemed.code;
    }

    const orderId = crypto.randomUUID();
    const orderNumber = await OrderSequenceService.getNextOrderNumber();
    const now = new Date().toISOString();

    const orderDoc: MongoOrderDoc = {
      id: orderId,
      user_id: userId,
      order_number: orderNumber,
      subtotal_cents: subtotalCents,
      discount_cents: discountCents,
      promo_code: appliedPromoCode,
      total_cents: totalCents,
      items: pricedItems,
      payment_rail: rail || 'PENDING',
      status: 'PENDING',
      created_at: now,
      updated_at: now,
    };

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    await ordersCol.insertOne(orderDoc as any);

    if (fromCart) {
      const cartCol = await MongoService.getCollection<MongoCartItemDoc>('cart_items');
      await cartCol.deleteMany({ user_id: userId });
    }

    return formatOrder(orderDoc);
  }
}
