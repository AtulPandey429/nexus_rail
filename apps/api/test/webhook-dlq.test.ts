import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { MongoService, MongoOrderDoc, MongoWebhookEventDoc } from '../src/services/mongo.js';
import { StripeService } from '../src/services/stripe.js';
import { WebhookDlqWorker } from '../src/workers/webhookDlq.js';
import { settlementEmitter } from '../src/services/settlementEvents.js';

describe('Suite: Webhook Dead-Letter Queue (DLQ) & Auto-Reconciler (FEAT-04)', () => {
  const testOrderId = `ord_dlq_${Date.now()}`;
  const testEventId = `evt_test_dlq_${Date.now()}`;
  const testSessionId = `cs_test_${Date.now()}`;

  before(async () => {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    await ordersCol.insertOne({
      id: testOrderId,
      order_number: `NR-DLQ-${Date.now()}`,
      user_id: 'user_dlq_test',
      total_cents: 19900,
      items: [],
      payment_rail: 'STRIPE',
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);
  });

  after(async () => {
    try {
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      await ordersCol.deleteMany({ id: testOrderId });

      const eventsCol = await MongoService.getCollection<MongoWebhookEventDoc>('webhook_events');
      await eventsCol.deleteMany({ id: testEventId });
    } catch {}
    await MongoService.close();
  });

  it('StripeService.fulfillOrderFromSession marks pending order PAID and emits settlement', async () => {
    let receivedSettlement: any = null;
    const unsub = settlementEmitter.onSettlement(testOrderId, (evt) => {
      receivedSettlement = evt;
    });

    const mockSession = {
      id: testSessionId,
      client_reference_id: testOrderId,
      payment_intent: 'pi_test_123456789',
      metadata: { orderId: testOrderId },
    };

    const res = await StripeService.fulfillOrderFromSession(mockSession);
    assert.equal(res.orderId, testOrderId);
    assert.equal(res.status, 'PAID');

    // Verify in database
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const order = await ordersCol.findOne({ id: testOrderId });
    assert.ok(order);
    assert.equal(order.status, 'PAID');
    assert.equal(order.stripe_session_id, testSessionId);

    // Verify settlement emission
    assert.ok(receivedSettlement);
    assert.equal(receivedSettlement.orderId, testOrderId);
    assert.equal(receivedSettlement.status, 'PAID');
    assert.equal(receivedSettlement.paymentRail, 'STRIPE');

    unsub();
  });

  it('WebhookDlqWorker starts, stops, and safely sweeps empty queue without throwing', async () => {
    WebhookDlqWorker.startWorker();
    const result = await WebhookDlqWorker.retryFailedEvents();
    assert.equal(typeof result.processedCount, 'number');
    assert.equal(typeof result.failedCount, 'number');
    WebhookDlqWorker.stopWorker();
  });

  it('WebhookDlqWorker picks up FAILED webhook event, fulfills order, and transitions event to PROCESSED', async () => {
    const unfulfilledOrderId = `ord_unfulfilled_${Date.now()}`;
    const recoverableEventId = `evt_recover_${Date.now()}`;

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    await ordersCol.insertOne({
      id: unfulfilledOrderId,
      order_number: `NR-RECOV-${Date.now()}`,
      user_id: 'user_dlq_recov',
      total_cents: 8900,
      items: [],
      payment_rail: 'STRIPE',
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);

    // Simulate transiently failed webhook stored in DLQ
    const eventsCol = await MongoService.getCollection<MongoWebhookEventDoc>('webhook_events');
    await eventsCol.insertOne({
      id: recoverableEventId,
      source: 'STRIPE',
      type: 'checkout.session.completed',
      payload: {
        id: `cs_recov_${Date.now()}`,
        client_reference_id: unfulfilledOrderId,
        metadata: { orderId: unfulfilledOrderId },
      },
      status: 'FAILED',
      retry_count: 1,
      last_error: 'Simulated connection timeout during network spike',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Run DLQ sweeper
    const sweepResult = await WebhookDlqWorker.retryFailedEvents();
    assert.ok(sweepResult.processedCount >= 1, 'Should have processed at least 1 recovered event');

    // Verify order was marked PAID
    const order = await ordersCol.findOne({ id: unfulfilledOrderId });
    assert.ok(order);
    assert.equal(order.status, 'PAID', 'Order should be automatically fulfilled by DLQ sweeper');

    // Verify event transitioned to PROCESSED
    const updatedEvent = await eventsCol.findOne({ id: recoverableEventId });
    assert.ok(updatedEvent);
    assert.equal(updatedEvent.status, 'PROCESSED');

    // Clean up
    await ordersCol.deleteOne({ id: unfulfilledOrderId });
    await eventsCol.deleteOne({ id: recoverableEventId });
  });
});
