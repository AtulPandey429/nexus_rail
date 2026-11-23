import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { CouponService } from '../src/services/coupon.service.js';
import { MongoService, MongoOrderDoc } from '../src/services/mongo.js';
import { walletService } from '../src/services/wallet.js';
import { NR_MICRO_SCALE } from '../src/services/nrToken.service.js';

describe('Phase 2 (M7): Tamper-Proof Smart Coupons & Automatic 2% $NXL Cashback', () => {
  const runId = crypto.randomBytes(4).toString('hex');
  const testUserId = `usr_m7_test_${runId}`;
  const createdOrderIds: string[] = [];

  after(async () => {
    try {
      const ordersCol = await MongoService.getCollection('orders');
      if (createdOrderIds.length > 0) {
        await ordersCol.deleteMany({ id: { $in: createdOrderIds } });
      }
      const balancesCol = await MongoService.getCollection('wallet_balances');
      const ledgerCol = await MongoService.getCollection('wallet_ledger');
      const holdingsCol = await MongoService.getCollection('user_holdings');
      const eventsCol = await MongoService.getCollection('portfolio_events');
      await balancesCol.deleteMany({ user_id: testUserId });
      await ledgerCol.deleteMany({ user_id: testUserId });
      await holdingsCol.deleteMany({ user_id: testUserId });
      await eventsCol.deleteMany({ user_id: testUserId });
      await MongoService.close();
    } catch {
      // quiet cleanup
    }
  });

  it('validates NEXUS10 server-side with exact 10% discount and 2% cashback preview', async () => {
    const res = await CouponService.validateCoupon({
      code: 'nexus10',
      userId: testUserId,
      subtotalCents: 10000, // $100.00
    });

    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.code, 'NEXUS10');
    assert.strictEqual(res.discountPercent, 10);
    assert.strictEqual(res.discountCents, 1000);
    assert.strictEqual(res.finalTotalCents, 9000);
    assert.strictEqual(res.estimatedCashbackUsdCents, 180); // 2% of $90.00
    assert.ok(res.estimatedCashbackNxl > 0);
  });

  it('enforces NRHOLDER20 token-gating (rejects at 0 $NXL, approves at >= 1 $NXL)', async () => {
    await assert.rejects(
      () =>
        CouponService.validateCoupon({
          code: 'NRHOLDER20',
          userId: testUserId,
          subtotalCents: 10000,
        }),
      /at least 1 \$NXL/i
    );

    // Credit 2 $NXL to user wallet
    await walletService.creditBalance(testUserId, 2 * NR_MICRO_SCALE, 'NXL', `m7_seed_${runId}`);

    const vipRes = await CouponService.validateCoupon({
      code: 'NRHOLDER20',
      userId: testUserId,
      subtotalCents: 10000,
    });
    assert.strictEqual(vipRes.valid, true);
    assert.strictEqual(vipRes.discountPercent, 20);
    assert.strictEqual(vipRes.discountCents, 2000);
    assert.strictEqual(vipRes.finalTotalCents, 8000);
  });

  it('allows WELCOME15 on first order and awards 2% $NXL cashback strictly once (idempotent)', async () => {
    const firstOrderRes = await CouponService.validateCoupon({
      code: 'WELCOME15',
      userId: testUserId,
      subtotalCents: 10000,
    });
    assert.strictEqual(firstOrderRes.discountCents, 1500);
    assert.strictEqual(firstOrderRes.finalTotalCents, 8500);

    const beforeBal = await walletService.getBalance(testUserId);

    const orderId = `ord_m7_cashback_${runId}`;
    const orderNumber = `#M7CB${runId.toUpperCase()}`;
    createdOrderIds.push(orderId);

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const now = new Date().toISOString();
    const paidOrder: MongoOrderDoc = {
      id: orderId,
      user_id: testUserId,
      order_number: orderNumber,
      subtotal_cents: 10000,
      discount_cents: 1500,
      promo_code: 'WELCOME15',
      total_cents: 8500, // $85.00 -> 2% cashback = $1.70 (170 cents)
      items: [{ sku: 'TEST-SKU', title: 'Test Order', qty: 1, unit_price_cents: 10000 }],
      payment_rail: 'XLM',
      status: 'PAID',
      created_at: now,
      updated_at: now,
    };
    await ordersCol.insertOne(paidOrder);

    // First cashback award -> must credit
    const firstAward = await CouponService.awardOrderCashback(paidOrder);
    assert.strictEqual(firstAward.credited, true);
    assert.strictEqual(firstAward.cashbackUsdCents, 170);
    assert.ok(firstAward.cashbackNxl > 0);

    const afterFirstBal = await walletService.getBalance(testUserId);
    assert.ok(afterFirstBal.NXL > beforeBal.NXL, 'User $NXL balance must increase after cashback');

    // Duplicate cashback attempt -> must be a no-op
    const secondAward = await CouponService.awardOrderCashback(paidOrder);
    assert.strictEqual(secondAward.credited, false);

    const afterSecondBal = await walletService.getBalance(testUserId);
    assert.strictEqual(afterSecondBal.NXL, afterFirstBal.NXL, 'Duplicate cashback must never double-credit');

    // Now that user has a PAID order, WELCOME15 must reject
    await assert.rejects(
      () =>
        CouponService.validateCoupon({
          code: 'WELCOME15',
          userId: testUserId,
          subtotalCents: 10000,
        }),
      /first paid order/i
    );
  });
});
