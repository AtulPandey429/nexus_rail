import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import {
  NrTokenService,
  NR_MICRO_SCALE,
  GENESIS_RESERVE_USD_CENTS,
  GENESIS_POOL_NR_MICRO,
  computeSpotPriceUsd,
  computeBuyQuoteFromPool,
  computeSellQuoteFromPool,
} from '../src/services/nrToken.service.js';
import { walletService } from '../src/services/wallet.js';
import { MongoService, MongoOrderDoc, MongoTokenPoolDoc } from '../src/services/mongo.js';
import { swapRouter } from '../src/routes/swap.routes.js';
import { checkoutRouter } from '../src/routes/checkout.routes.js';
import { adminRouter } from '../src/routes/admin.routes.js';
import { signToken } from '../src/services/jwt.js';

describe('Suite: Module 1 — $NR Native Token & Constant-Product AMM', () => {
  let server: http.Server;
  let baseUrl: string;
  let userToken: string;
  let adminToken: string;
  let poolSnapshotBefore: MongoTokenPoolDoc | null = null;

  const stamp = Date.now();
  const testUserId = `user_nr_test_${stamp}`;
  const testAdminId = `admin_nr_test_${stamp}`;
  const testOrderId = `ord_nr_pay_${stamp}`;
  const testOrderNumber = `#NRTEST${String(stamp).slice(-5)}`;
  const testRefPrefix = `NR-TEST-${stamp}`;

  before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key-32-chars-long!';
    userToken = signToken({ id: testUserId, email: 'buyer@nexusrail.test', role: 'user' });
    adminToken = signToken({ id: testAdminId, email: 'admin@nexusrail.test', role: 'admin' });

    // Snapshot pool state before tests so integration mutations can be restored cleanly
    await NrTokenService.ensureGenesisPool();
    const poolCol = await MongoService.getCollection<MongoTokenPoolDoc>('token_pool');
    poolSnapshotBefore = await poolCol.findOne({ symbol: 'NR' });

    const app = express();
    app.use(express.json());
    app.use('/api/v1/swap', swapRouter);
    app.use('/api/v1/checkout', checkoutRouter);
    app.use('/api/v1/admin', adminRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    try {
      const ordersCol = await MongoService.getCollection('orders');
      const balancesCol = await MongoService.getCollection('wallet_balances');
      const ledgerCol = await MongoService.getCollection('wallet_ledger');
      const historyCol = await MongoService.getCollection('token_price_history');
      const poolCol = await MongoService.getCollection<MongoTokenPoolDoc>('token_pool');

      await ordersCol.deleteMany({ user_id: testUserId });
      await balancesCol.deleteMany({ user_id: testUserId });
      await ledgerCol.deleteMany({ user_id: testUserId });
      await historyCol.deleteMany({
        reference_id: { $regex: new RegExp(`(${testRefPrefix}|ADMIN:${testAdminId})`) },
      });

      if (poolSnapshotBefore) {
        const { _id, ...rest } = poolSnapshotBefore;
        await poolCol.updateOne({ symbol: 'NR' }, { $set: rest });
      }
    } catch {}
    await MongoService.close();
  });

  it('T1.1: Genesis pool initializes at $1.00 spot price and GET /api/v1/swap/nr-pool responds 200', async () => {
    assert.equal(GENESIS_RESERVE_USD_CENTS, 10_000_000);
    assert.equal(GENESIS_POOL_NR_MICRO, 100_000_000_000);
    assert.equal(computeSpotPriceUsd(GENESIS_RESERVE_USD_CENTS, GENESIS_POOL_NR_MICRO), 1.0);

    const res = await fetch(`${baseUrl}/api/v1/swap/nr-pool`);
    const json: any = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.symbol, 'NR');
    assert.ok(json.data.spotPriceUsd > 0);
    assert.ok(Array.isArray(json.data.history));
  });

  it('T1.2: Constant-product Buy quote preserves BigInt k invariant and raises spot price', () => {
    const kBefore = BigInt(GENESIS_RESERVE_USD_CENTS) * BigInt(GENESIS_POOL_NR_MICRO);
    const buy = computeBuyQuoteFromPool(GENESIS_RESERVE_USD_CENTS, GENESIS_POOL_NR_MICRO, 100_000); // $1,000.00

    assert.equal(buy.feeCents, 500); // 0.5% of $1,000 = $5.00
    assert.equal(buy.feePoolCents + buy.feeOwnerCents, buy.feeCents);
    assert.ok(buy.nrOut > 985 && buy.nrOut < 986, `Expected ~985.197 NR, got ${buy.nrOut}`);
    assert.ok(buy.spotAfterUsd > buy.spotBeforeUsd, 'Spot price must strictly increase after a buy');

    const kAfter = BigInt(buy.finalReserveUsdCents) * BigInt(buy.finalPoolNrMicro);
    assert.ok(kAfter > kBefore, 'Invariant k must grow after 50% fee pool injection');
  });

  it('T1.3: Sell quote enforces ceiling invariant and splits exit fee 50/50', () => {
    const buy = computeBuyQuoteFromPool(GENESIS_RESERVE_USD_CENTS, GENESIS_POOL_NR_MICRO, 100_000);
    const kAfterBuy = BigInt(buy.finalReserveUsdCents) * BigInt(buy.finalPoolNrMicro);

    const sell = computeSellQuoteFromPool(buy.finalReserveUsdCents, buy.finalPoolNrMicro, 500 * NR_MICRO_SCALE);
    assert.ok(sell.grossUsdCents > 0);
    assert.ok(sell.netUsdOutCents < sell.grossUsdCents);
    assert.equal(sell.feePoolCents + sell.feeOwnerCents, sell.feeCents);

    const kAfterSell = BigInt(sell.finalReserveUsdCents) * BigInt(sell.finalPoolNrMicro);
    assert.ok(kAfterSell >= kAfterBuy, 'Pool invariant must never shrink below pre-sell k');
  });

  it('T1.4: Revenue injection raises $NR floor price while keeping pool_nr_micro constant', async () => {
    const beforeStats = await NrTokenService.getPoolStats();
    const injected = await NrTokenService.injectRevenueToPool(50_000, `${testRefPrefix}-REV`); // +$500.00
    const afterStats = await NrTokenService.getPoolStats();

    assert.equal(afterStats.poolNrMicro, beforeStats.poolNrMicro, 'Pool NR supply must remain unchanged');
    assert.equal(injected.reserveUsdCents, beforeStats.reserveUsdCents + 50_000);
    assert.ok(afterStats.spotPriceUsd > beforeStats.spotPriceUsd, 'Spot price must increase after revenue injection');
  });

  it('T1.5: Atomic overdraft defense rejects debiting more NR than available balance', async () => {
    await assert.rejects(
      async () => walletService.debitBalance(testUserId, 50 * NR_MICRO_SCALE, 'NR', 'overdraft_check'),
      /Insufficient NR balance/
    );
  });

  it('T1.6 & T1.7: POST /api/v1/checkout/nr/pay applies 10% discount and blocks double-payment replay', async () => {
    const stats = await NrTokenService.getPoolStats();
    // Credit user with plenty of NR (500 NR)
    const initialNrMicro = 500 * NR_MICRO_SCALE;
    await walletService.creditBalance(testUserId, initialNrMicro, 'NR', `${testRefPrefix}-SEED`);

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const now = new Date().toISOString();
    await ordersCol.insertOne({
      id: testOrderId,
      user_id: testUserId,
      order_number: testOrderNumber,
      total_cents: 10_000, // $100.00
      items: [{ sku: 'RAIL-ONE', title: 'Rail One', qty: 1, unit_price_cents: 10_000 }],
      payment_rail: 'PENDING',
      status: 'PENDING',
      created_at: now,
      updated_at: now,
    } as any);

    // T1.6: Pay order with $NR -> $90.00 net (10% discount + 0% fee)
    const payRes = await fetch(`${baseUrl}/api/v1/checkout/nr/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ orderId: testOrderNumber }),
    });
    const payJson: any = await payRes.json();
    assert.equal(payRes.status, 200);
    assert.equal(payJson.success, true);
    assert.equal(payJson.orderStatus, 'PAID');
    assert.equal(payJson.data.originalCents, 10_000);
    assert.equal(payJson.data.nrDiscountCents, 1_000);
    assert.equal(payJson.data.finalPaidCents, 9_000);

    const expectedPaidMicro = Math.max(1, Math.round(((90) / stats.spotPriceUsd) * NR_MICRO_SCALE));
    const balAfter = await walletService.getBalance(testUserId);
    assert.ok(Math.abs(balAfter.NR - (initialNrMicro - expectedPaidMicro)) <= 5, 'NR balance must reflect discounted debit');

    // T1.7: Replay guard must reject second payment on already PAID order
    const replayRes = await fetch(`${baseUrl}/api/v1/checkout/nr/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ orderId: testOrderNumber }),
    });
    const replayJson: any = await replayRes.json();
    assert.equal(replayRes.status, 400);
    assert.equal(replayJson.success, false);
    assert.match(replayJson.error, /already paid/i);
  });

  it('T1.8: Admin RBAC guard rejects non-admin and permits admin reserve adjustment', async () => {
    const forbiddenRes = await fetch(`${baseUrl}/api/v1/admin/nr-pool/adjust-reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ deltaUsdCents: 25_000, note: 'unauthorized' }),
    });
    assert.equal(forbiddenRes.status, 403);

    const before = await NrTokenService.getPoolStats();
    const okRes = await fetch(`${baseUrl}/api/v1/admin/nr-pool/adjust-reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ deltaUsdCents: 25_000, note: 'verified_test' }),
    });
    const okJson: any = await okRes.json();
    assert.equal(okRes.status, 200);
    assert.equal(okJson.success, true);
    assert.equal(okJson.data.reserveUsdCents, before.reserveUsdCents + 25_000);
    assert.ok(okJson.data.spotPriceUsd > before.spotPriceUsd);
  });
});
