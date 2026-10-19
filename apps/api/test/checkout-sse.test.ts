import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { settlementEmitter } from '../src/services/settlementEvents.js';
import { MongoService, MongoOrderDoc } from '../src/services/mongo.js';
import { checkoutRouter } from '../src/routes/checkout.js';
import { signToken } from '../src/services/jwt.js';

describe('Suite: Real-Time SSE Settlement Stream (FEAT-01)', () => {
  let server: http.Server;
  let port: number;
  let authToken: string;
  const testUserId = `user_sse_${Date.now()}`;
  const paidOrderId = `ord_paid_${Date.now()}`;
  const pendOrderId = `ord_pend_${Date.now()}`;

  before(async () => {
    // Create auth token
    authToken = signToken({ id: testUserId, role: 'user' });

    // Mount Express app
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
      await ordersCol.deleteMany({ id: { $in: [paidOrderId, pendOrderId] } });
    } catch {}
    await MongoService.close();
  });

  it('settlementEmitter registers and dispatches settlement events to subscribers', async () => {
    let receivedEvent: any = null;
    const testEmitterId = `ord_emitter_${Date.now()}`;
    const unsub = settlementEmitter.onSettlement(testEmitterId, (evt) => {
      receivedEvent = evt;
    });

    settlementEmitter.emitSettlement({
      orderId: testEmitterId,
      orderNumber: 'NR-EMITTER-01',
      status: 'PAID',
      paymentRail: 'XLM',
      txHash: '0x123abc456def',
      timestamp: new Date().toISOString(),
    });

    assert.ok(receivedEvent, 'Subscriber should receive emitted event');
    assert.equal(receivedEvent.orderId, testEmitterId);
    assert.equal(receivedEvent.status, 'PAID');
    assert.equal(receivedEvent.paymentRail, 'XLM');

    unsub();
  });

  it('GET /orders/:orderId/stream returns 401 when no token is provided', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/checkout/orders/any-order/stream`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /Authentication required/);
  });

  it('GET /orders/:orderId/stream immediately streams settlement if order is already PAID', async () => {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    await ordersCol.insertOne({
      id: paidOrderId,
      order_number: `NR-PAID-${Date.now()}`,
      user_id: testUserId,
      total_cents: 4999,
      status: 'PAID',
      payment_rail: 'XLM',
      tx_hash: 'tx-already-settled-hash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);

    const res = await fetch(
      `http://localhost:${port}/api/v1/checkout/orders/${paidOrderId}/stream?token=${encodeURIComponent(authToken)}`
    );

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/event-stream/);

    const body = await res.text();
    assert.match(body, /event: settlement/);
    assert.match(body, /"status":"PAID"/);
    assert.match(body, /tx-already-settled-hash/);
  });

  it('GET /orders/:orderId/stream streams real-time settlement when settlementEmitter emits', async () => {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    await ordersCol.insertOne({
      id: pendOrderId,
      order_number: `NR-PEND-${Date.now()}`,
      user_id: testUserId,
      total_cents: 9900,
      status: 'PENDING',
      payment_rail: 'XRP',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);

    const res = await fetch(
      `http://localhost:${port}/api/v1/checkout/orders/${pendOrderId}/stream?token=${encodeURIComponent(authToken)}`
    );

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/event-stream/);

    const reader = res.body?.getReader();
    assert.ok(reader, 'Response should have a readable stream body');

    const decoder = new TextDecoder();
    let accumulated = '';

    // Read initial status event
    const chunk1 = await reader.read();
    accumulated += decoder.decode(chunk1.value, { stream: true });
    assert.match(accumulated, /event: status/);
    assert.match(accumulated, /"status":"PENDING"/);

    // Emit live on-chain settlement
    setTimeout(() => {
      settlementEmitter.emitSettlement({
        orderId: pendOrderId,
        orderNumber: 'NR-PEND-01',
        status: 'PAID',
        paymentRail: 'XRP',
        txHash: 'xrp-live-mined-hash-777',
        timestamp: new Date().toISOString(),
      });
    }, 50);

    // Read the streamed settlement event
    while (!accumulated.includes('xrp-live-mined-hash-777')) {
      const { value, done } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
    }

    assert.match(accumulated, /event: settlement/);
    assert.match(accumulated, /xrp-live-mined-hash-777/);
    assert.match(accumulated, /"status":"PAID"/);
  });
});
