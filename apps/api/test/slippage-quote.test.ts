import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { RatesService } from '../src/services/rates.js';
import { MongoService, MongoOrderDoc } from '../src/services/mongo.js';
import { checkoutRouter } from '../src/routes/checkout.js';
import { signToken } from '../src/services/jwt.js';

describe('Suite: Cryptographic Quote Ticket & Slippage Protection (FEAT-02)', () => {
  let server: http.Server;
  let port: number;
  let authToken: string;
  const testUserId = `user_slippage_${Date.now()}`;
  const testOrderId = `ord_slip_${Date.now()}`;

  before(async () => {
    authToken = signToken({ id: testUserId, role: 'user' });

    const app = express();
    app.use(express.json());
    app.use('/api/v1/checkout', checkoutRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    try {
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      await ordersCol.deleteMany({ id: testOrderId });
    } catch {}
    await MongoService.close();
  });

  it('generateQuoteTicket produces authentic cryptographic ticket with valid HMAC signature', async () => {
    const ticket = await RatesService.generateQuoteTicket('ord_test_hmac_1', 12900, 'XLM', 300);

    assert.ok(ticket.ticketId.startsWith('qt_'));
    assert.equal(ticket.orderId, 'ord_test_hmac_1');
    assert.equal(ticket.amountUsdCents, 12900);
    assert.equal(ticket.assetSymbol, 'XLM');
    assert.ok(ticket.cryptoAmount > 0);
    assert.ok(ticket.rateUsd > 0);
    assert.ok(typeof ticket.signature === 'string' && ticket.signature.length === 64);

    // Verify authenticity
    const isValid = RatesService.verifyQuoteTicket(ticket);
    assert.equal(isValid, true, 'Original ticket should verify cleanly');

    // Tampered ticket must fail verification
    const tamperedTicket = { ...ticket, cryptoAmount: ticket.cryptoAmount + 100 };
    const isTamperedValid = RatesService.verifyQuoteTicket(tamperedTicket);
    assert.equal(isTamperedValid, false, 'Tampered ticket must fail HMAC verification');
  });

  it('evaluateSlippage accepts active quotes regardless of market fluctuations', async () => {
    const ticket = await RatesService.generateQuoteTicket('ord_test_active', 10000, 'XRP', 300);
    // Spot price drops 10% but ticket is still active within 5-min TTL
    const crashedRate = ticket.rateUsd * 0.9;
    const result = RatesService.evaluateSlippage(ticket, crashedRate, 1.5);

    assert.equal(result.isExpired, false);
    assert.equal(result.isAcceptable, true, 'Active ticket should be accepted at locked price');
  });

  it('evaluateSlippage quarantines expired quotes when adverse slippage exceeds 1.5%', async () => {
    // Generate expired quote ticket (negative TTL)
    const expiredTicket = await RatesService.generateQuoteTicket('ord_test_expired', 10000, 'XLM', -10);
    assert.ok(new Date(expiredTicket.expiresAt).getTime() < Date.now());

    // Scenario A: Price is stable or higher (no adverse slippage)
    const stableResult = RatesService.evaluateSlippage(expiredTicket, expiredTicket.rateUsd * 1.01, 1.5);
    assert.equal(stableResult.isExpired, true);
    assert.equal(stableResult.isAcceptable, true, 'Stable or favorable expired quote is accepted');

    // Scenario B: Price dropped by 5% (exceeds 1.5% tolerance)
    const crashedResult = RatesService.evaluateSlippage(expiredTicket, expiredTicket.rateUsd * 0.95, 1.5);
    assert.equal(crashedResult.isExpired, true);
    assert.equal(crashedResult.isAcceptable, false, 'Adverse slippage > 1.5% must be rejected/quarantined');
    assert.ok(crashedResult.slippagePercent > 1.5);
    assert.ok(crashedResult.deliveredUsdCents < 10000);
  });

  it('POST /quote/refresh generates fresh quote ticket for pending order', async () => {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    await ordersCol.insertOne({
      id: testOrderId,
      order_number: `NR-SLIP-${Date.now()}`,
      user_id: testUserId,
      total_cents: 12900,
      items: [],
      payment_rail: 'XLM',
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);

    const res = await fetch(`http://localhost:${port}/api/v1/checkout/quote/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ orderId: testOrderId, chain: 'stellar' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.quoteTicket);
    assert.equal(body.quoteTicket.orderId, testOrderId);
    assert.equal(body.quoteTicket.assetSymbol, 'XLM');
    assert.ok(body.amountXlm);
    assert.ok(body.expiresAt);
  });
});
