import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { CrossChainSwapService } from '../src/services/crossChainSwapService.js';
import { resolveUnderpaidOrder } from '../src/services/underpaidOrderService.js';
import { MongoService, MongoOrderDoc } from '../src/services/mongo.js';
import { walletService } from '../src/services/wallet.js';

describe('Phase 1 (M6): MongoDB Swaps Persistence & UNDERPAID Slippage Recovery', () => {
  const testRunId = crypto.randomBytes(4).toString('hex');
  const testUserId = `usr_m6_test_${testRunId}`;
  const createdSwapIds: string[] = [];
  const createdOrderIds: string[] = [];

  after(async () => {
    try {
      const swapsCol = await MongoService.getCollection('swaps');
      if (createdSwapIds.length > 0) {
        await swapsCol.deleteMany({ swapId: { $in: createdSwapIds } });
      }
      const ordersCol = await MongoService.getCollection('orders');
      if (createdOrderIds.length > 0) {
        await ordersCol.deleteMany({ id: { $in: createdOrderIds } });
      }
      const balancesCol = await MongoService.getCollection('wallet_balances');
      const ledgerCol = await MongoService.getCollection('wallet_ledger');
      await balancesCol.deleteMany({ user_id: testUserId });
      await ledgerCol.deleteMany({ user_id: testUserId });
      await MongoService.close();
    } catch {
      // quiet cleanup
    }
  });

  it('persists cross-chain swaps to MongoDB and recovers them after RAM cache clear', async () => {
    const validStellarAddress = 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC';
    const created = await CrossChainSwapService.createSwapOrder({
      userId: testUserId,
      fromAsset: 'XRP',
      toAsset: 'XLM',
      amount: 12,
      userDestinationAddress: validStellarAddress,
    });
    createdSwapIds.push(created.swapId);

    // Simulate server restart by clearing in-memory Map completely
    CrossChainSwapService.clearMemoryCache();

    const reloaded = await CrossChainSwapService.getSwapOrder(created.swapId);
    assert.ok(reloaded, 'Swap order must be recovered from MongoDB after cache clear');
    assert.strictEqual(reloaded!.swapId, created.swapId);
    assert.strictEqual(reloaded!.userId, testUserId);
    assert.strictEqual(reloaded!.payAmount, 12);
    assert.strictEqual(reloaded!.status, 'PENDING_DEPOSIT');

    const userHistory = await CrossChainSwapService.getUserSwaps({ userId: testUserId, limit: 10 });
    assert.ok(
      userHistory.some((s) => s.swapId === created.swapId),
      'Persisted swap must appear in user swap history'
    );
  });

  it('resolves UNDERPAID order via TOPUP_USD, marks PAID, debits shortfall, and blocks duplicate resolution', async () => {
    await walletService.creditBalance(testUserId, 2000, 'USD', `m6_seed_${testRunId}`);
    const beforeBal = await walletService.getBalance(testUserId);

    const orderId = `ord_m6_topup_${testRunId}`;
    const orderNumber = `#M6TP${testRunId.toUpperCase()}`;
    createdOrderIds.push(orderId);

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const now = new Date().toISOString();
    await ordersCol.insertOne({
      id: orderId,
      user_id: testUserId,
      order_number: orderNumber,
      total_cents: 10000,
      items: [{ sku: 'TEST-SKU', title: 'Test Item', qty: 1, unit_price_cents: 10000 }],
      payment_rail: 'XLM',
      status: 'UNDERPAID',
      underpaid_cents: 350,
      slippage_percent: 3.5,
      created_at: now,
      updated_at: now,
    });

    const result = await resolveUnderpaidOrder({
      orderId,
      userId: testUserId,
      mode: 'TOPUP_USD',
    });

    assert.strictEqual(result.orderStatus, 'PAID');
    assert.strictEqual(result.shortfallPaidCents, 350);

    const afterBal = await walletService.getBalance(testUserId);
    assert.strictEqual(afterBal.USD, beforeBal.USD - 350);

    const dbOrder = await ordersCol.findOne({ id: orderId });
    assert.strictEqual(dbOrder?.status, 'PAID');
    assert.strictEqual(dbOrder?.underpaid_cents, 0);

    // Duplicate resolution must fail cleanly
    await assert.rejects(
      () => resolveUnderpaidOrder({ orderId, userId: testUserId, mode: 'TOPUP_USD' }),
      /already paid/i
    );
  });

  it('resolves UNDERPAID order via REFUND_WALLET, credits paid USD back, and prevents double refund', async () => {
    const beforeBal = await walletService.getBalance(testUserId);

    const orderId = `ord_m6_refund_${testRunId}`;
    const orderNumber = `#M6RF${testRunId.toUpperCase()}`;
    createdOrderIds.push(orderId);

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const now = new Date().toISOString();
    await ordersCol.insertOne({
      id: orderId,
      user_id: testUserId,
      order_number: orderNumber,
      total_cents: 5000,
      items: [{ sku: 'TEST-SKU-2', title: 'Test Item 2', qty: 1, unit_price_cents: 5000 }],
      payment_rail: 'XRP',
      status: 'UNDERPAID',
      underpaid_cents: 200,
      slippage_percent: 4.0,
      created_at: now,
      updated_at: now,
    });

    const result = await resolveUnderpaidOrder({
      orderId,
      userId: testUserId,
      mode: 'REFUND_WALLET',
    });

    assert.strictEqual(result.orderStatus, 'REFUNDED');
    assert.strictEqual(result.refundedCents, 4800);
    assert.ok(result.refundTxHash);

    const afterBal = await walletService.getBalance(testUserId);
    assert.strictEqual(afterBal.USD, beforeBal.USD + 4800);

    // Duplicate refund must be blocked
    await assert.rejects(
      () => resolveUnderpaidOrder({ orderId, userId: testUserId, mode: 'REFUND_WALLET' }),
      /already been refunded/i
    );
  });
});
