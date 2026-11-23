import crypto from 'crypto';
import {
  MongoService,
  MongoCouponDoc,
  MongoOrderDoc,
  MongoUserHoldingDoc,
  MongoPortfolioEventDoc,
} from './mongo.js';
import { walletService } from './wallet.js';
import { NrTokenService, NR_MICRO_SCALE } from './nrToken.service.js';

export const DEFAULT_CASHBACK_PERCENT = 2; // 2% automatic $NXL cashback

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discountPercent: number;
  subtotalCents: number;
  discountCents: number;
  finalTotalCents: number;
  estimatedCashbackUsdCents: number;
  estimatedCashbackNxl: number;
  message: string;
}

const DEFAULT_COUPONS: Array<Omit<MongoCouponDoc, '_id' | 'used_count' | 'created_at'>> = [
  {
    code: 'NEXUS10',
    discount_percent: 10,
    min_order_cents: 1000,
    requires_nr_holder: false,
    active: true,
    description: '10% off orders of $10 or more',
  },
  {
    code: 'STELLAR',
    discount_percent: 10,
    min_order_cents: 1000,
    requires_nr_holder: false,
    active: true,
    description: '10% off with Stellar rail promo',
  },
  {
    code: 'XRPL',
    discount_percent: 10,
    min_order_cents: 1000,
    requires_nr_holder: false,
    active: true,
    description: '10% off with XRPL rail promo',
  },
  {
    code: 'WELCOME15',
    discount_percent: 15,
    min_order_cents: 1000,
    requires_nr_holder: false,
    first_order_only: true,
    active: true,
    description: '15% off your very first NexusRail order',
  },
  {
    code: 'NRHOLDER20',
    discount_percent: 20,
    min_order_cents: 1000,
    requires_nr_holder: true,
    active: true,
    description: '20% VIP discount for $NXL token holders (min 1 $NXL)',
  },
  {
    code: 'AGENT15',
    discount_percent: 15,
    min_order_cents: 1000,
    requires_nr_holder: false,
    active: true,
    description: '15% AI Assistant special discount',
  },
];

let couponsSeeded = false;

export class CouponService {
  /**
   * Ensures default platform promo codes exist in MongoDB `coupons` collection
   */
  static async ensureDefaultCoupons(): Promise<void> {
    if (couponsSeeded) return;
    const col = await MongoService.getCollection<MongoCouponDoc>('coupons');
    const now = new Date().toISOString();

    for (const seed of DEFAULT_COUPONS) {
      await col.updateOne(
        { code: seed.code },
        {
          $setOnInsert: {
            ...seed,
            used_count: 0,
            created_at: now,
          },
        },
        { upsert: true }
      );
    }
    couponsSeeded = true;
  }

  /**
   * Checks whether a user holds at least 1 $NXL across wallet balance or portfolio holdings
   */
  static async userHoldsNxl(userId: string): Promise<boolean> {
    const balance = await walletService.getBalance(userId);
    if ((balance.NXL || 0) >= NR_MICRO_SCALE) {
      return true;
    }
    const holdingsCol = await MongoService.getCollection<MongoUserHoldingDoc>('user_holdings');
    const holding = await holdingsCol.findOne({ user_id: userId, symbol: 'NXL' });
    return Number(holding?.quantity || 0) >= 1;
  }

  /**
   * Computes estimated 2% $NXL cashback for a given order total in USD cents
   */
  static async estimateCashback(finalTotalCents: number): Promise<{
    cashbackUsdCents: number;
    cashbackNxl: number;
    spotPriceCents: number;
  }> {
    const cashbackUsdCents = Math.max(0, Math.round((finalTotalCents * DEFAULT_CASHBACK_PERCENT) / 100));
    let spotPriceCents = 100;
    try {
      const pool = await NrTokenService.getPoolStats();
      spotPriceCents = Math.max(1, pool.spotPriceCents);
    } catch {
      spotPriceCents = 100;
    }
    const cashbackNxl = Number((cashbackUsdCents / spotPriceCents).toFixed(4));
    return { cashbackUsdCents, cashbackNxl, spotPriceCents };
  }

  /**
   * Validates a coupon server-side without incrementing usage count
   */
  static async validateCoupon(params: {
    code: string;
    userId: string;
    subtotalCents: number;
  }): Promise<CouponValidationResult> {
    await this.ensureDefaultCoupons();

    const cleanCode = String(params.code || '').trim().toUpperCase();
    const subtotalCents = Math.max(0, Math.round(Number(params.subtotalCents) || 0));

    if (!cleanCode) {
      throw new Error('Please enter a promo code.');
    }

    const col = await MongoService.getCollection<MongoCouponDoc>('coupons');
    const coupon = await col.findOne({ code: cleanCode });

    if (!coupon || !coupon.active) {
      throw new Error(`Promo code "${cleanCode}" is not valid or has ended.`);
    }

    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
      throw new Error(`Promo code "${cleanCode}" has expired.`);
    }

    if (typeof coupon.max_uses === 'number' && coupon.used_count >= coupon.max_uses) {
      throw new Error(`Promo code "${cleanCode}" has reached its usage limit.`);
    }

    if (coupon.issued_to_user_id && coupon.issued_to_user_id !== params.userId) {
      throw new Error(`Promo code "${cleanCode}" is reserved for another account.`);
    }

    if (subtotalCents < (coupon.min_order_cents || 0)) {
      const minUsd = ((coupon.min_order_cents || 0) / 100).toFixed(2);
      throw new Error(`Add at least $${minUsd} to your cart to use "${cleanCode}".`);
    }

    if (coupon.first_order_only) {
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const paidCount = await ordersCol.countDocuments({
        user_id: params.userId,
        status: { $in: ['PAID', 'FULFILLING', 'FULFILLED'] },
      });
      if (paidCount > 0) {
        throw new Error(`"${cleanCode}" is only available on your first paid order.`);
      }
    }

    if (coupon.requires_nr_holder) {
      const holds = await this.userHoldsNxl(params.userId);
      if (!holds) {
        throw new Error(`"${cleanCode}" requires holding at least 1 $NXL token in your wallet or portfolio.`);
      }
    }

    const safePercent = Math.min(50, Math.max(1, coupon.discount_percent));
    const discountCents = Math.round((subtotalCents * safePercent) / 100);
    const finalTotalCents = Math.max(100, subtotalCents - discountCents);
    const appliedDiscountCents = Math.max(0, subtotalCents - finalTotalCents);
    const { cashbackUsdCents, cashbackNxl } = await this.estimateCashback(finalTotalCents);

    return {
      valid: true,
      code: coupon.code,
      discountPercent: safePercent,
      subtotalCents,
      discountCents: appliedDiscountCents,
      finalTotalCents,
      estimatedCashbackUsdCents: cashbackUsdCents,
      estimatedCashbackNxl: cashbackNxl,
      message: `${coupon.code} applied — ${safePercent}% off (-$${(appliedDiscountCents / 100).toFixed(2)})`,
    };
  }

  /**
   * Validates and atomically redeems a coupon when creating an order
   */
  static async redeemCoupon(params: {
    code: string;
    userId: string;
    subtotalCents: number;
  }): Promise<CouponValidationResult> {
    const validated = await this.validateCoupon(params);
    const col = await MongoService.getCollection<MongoCouponDoc>('coupons');

    const updateFilter: any = { code: validated.code, active: true };
    const existing = await col.findOne({ code: validated.code });
    if (typeof existing?.max_uses === 'number') {
      updateFilter.used_count = { $lt: existing.max_uses };
    }

    const res = await col.updateOne(updateFilter, { $inc: { used_count: 1 } });
    if (res.modifiedCount === 0) {
      throw new Error(`Promo code "${validated.code}" could not be redeemed. Please try again.`);
    }

    return validated;
  }

  /**
   * Issues or returns the verified AI bargain coupon (AGENT15) for a user
   */
  static async issueAgentBargainCoupon(_userId: string): Promise<{ code: string; discountPercent: number; description: string }> {
    await this.ensureDefaultCoupons();
    return {
      code: 'AGENT15',
      discountPercent: 15,
      description: '15% AI Assistant special discount on orders $10+',
    };
  }

  /**
   * Atomically awards 2% $NXL cashback once an order is PAID.
   * Strict once-only idempotency guarded by Mongo conditional update on `cashback_credited`.
   */
  static async awardOrderCashback(order: MongoOrderDoc): Promise<{
    credited: boolean;
    cashbackUsdCents: number;
    cashbackNxl: number;
  }> {
    if (order.cashback_credited === true) {
      return {
        credited: false,
        cashbackUsdCents: order.cashback_usd_cents || 0,
        cashbackNxl: order.cashback_nxl_amount || 0,
      };
    }

    if (!order.user_id || !order.total_cents || order.total_cents <= 0) {
      return { credited: false, cashbackUsdCents: 0, cashbackNxl: 0 };
    }

    const { cashbackUsdCents, cashbackNxl, spotPriceCents } = await this.estimateCashback(order.total_cents);
    if (cashbackUsdCents <= 0 || cashbackNxl <= 0) {
      return { credited: false, cashbackUsdCents: 0, cashbackNxl: 0 };
    }

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const claimRes: any = await ordersCol.findOneAndUpdate(
      {
        id: order.id,
        status: { $in: ['PAID', 'FULFILLING', 'FULFILLED'] },
        cashback_credited: { $ne: true },
      },
      {
        $set: {
          cashback_credited: true,
          cashback_usd_cents: cashbackUsdCents,
          cashback_nxl_amount: cashbackNxl,
          updated_at: new Date().toISOString(),
        },
      },
      { returnDocument: 'after' }
    );

    const claimedDoc = claimRes?.value || claimRes;
    if (!claimedDoc) {
      return { credited: false, cashbackUsdCents: 0, cashbackNxl: 0 };
    }

    // 1. Credit user's spendable $NXL wallet balance (micro-NXL scale)
    const nxlMicro = Math.max(1, Math.round(cashbackNxl * NR_MICRO_SCALE));
    await walletService.creditBalance(
      order.user_id,
      nxlMicro,
      'NXL',
      `cashback:${order.order_number}`
    );

    // 2. Reflect cashback in user_holdings & portfolio_events for live P&L visibility
    try {
      const now = new Date().toISOString();
      const holdingsCol = await MongoService.getCollection<MongoUserHoldingDoc>('user_holdings');
      const eventsCol = await MongoService.getCollection<MongoPortfolioEventDoc>('portfolio_events');

      const existing = await holdingsCol.findOne({ user_id: order.user_id, symbol: 'NXL' });
      if (existing) {
        const newQty = Number((existing.quantity + cashbackNxl).toFixed(6));
        await holdingsCol.updateOne(
          { _id: existing._id },
          { $set: { quantity: newQty, updated_at: now } }
        );
      } else {
        await holdingsCol.insertOne({
          id: `hld_${crypto.randomUUID()}`,
          user_id: order.user_id,
          symbol: 'NXL',
          label: '$NXL Native Utility Token',
          quantity: cashbackNxl,
          total_cost_cents: 0, // Free loyalty reward -> 100% net profit
          avg_buy_price_cents: 0,
          realized_pnl_cents: 0,
          updated_at: now,
        });
      }

      await eventsCol.insertOne({
        id: `pevt_${crypto.randomUUID()}`,
        user_id: order.user_id,
        type: 'CASHBACK_REWARD',
        symbol: 'NXL',
        quantity_delta: cashbackNxl,
        unit_price_cents: spotPriceCents,
        total_usd_cents: cashbackUsdCents,
        fee_cents: 0,
        reference_id: order.order_number,
        created_at: now,
      });
    } catch (err: any) {
      console.warn('⚠️ [CouponService] Cashback portfolio sync warning:', err?.message);
    }

    return { credited: true, cashbackUsdCents, cashbackNxl };
  }

  /**
   * Lists all coupons for Admin management
   */
  static async listCoupons(): Promise<MongoCouponDoc[]> {
    await this.ensureDefaultCoupons();
    const col = await MongoService.getCollection<MongoCouponDoc>('coupons');
    return col.find({}).sort({ created_at: -1 }).toArray();
  }

  /**
   * Creates or updates a coupon from Admin Console
   */
  static async upsertCoupon(input: {
    code: string;
    discountPercent: number;
    minOrderCents?: number;
    requiresNrHolder?: boolean;
    firstOrderOnly?: boolean;
    active?: boolean;
    maxUses?: number;
    description?: string;
  }): Promise<MongoCouponDoc> {
    const cleanCode = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,24}$/.test(cleanCode)) {
      throw new Error('Coupon code must be 3–24 uppercase letters or numbers.');
    }

    const discountPercent = Math.min(50, Math.max(1, Math.round(input.discountPercent)));
    const col = await MongoService.getCollection<MongoCouponDoc>('coupons');
    const now = new Date().toISOString();

    await col.updateOne(
      { code: cleanCode },
      {
        $set: {
          code: cleanCode,
          discount_percent: discountPercent,
          min_order_cents: Math.max(0, Math.round(input.minOrderCents ?? 1000)),
          requires_nr_holder: Boolean(input.requiresNrHolder),
          first_order_only: Boolean(input.firstOrderOnly),
          active: input.active ?? true,
          ...(typeof input.maxUses === 'number' ? { max_uses: input.maxUses } : {}),
          ...(input.description ? { description: input.description.trim() } : {}),
        },
        $setOnInsert: {
          used_count: 0,
          created_at: now,
        },
      },
      { upsert: true }
    );

    return (await col.findOne({ code: cleanCode }))!;
  }
}
