import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { stripeWebhookHandler } from '../src/routes/webhooks.js';

describe('Suite: Stripe Webhook Route & Raw Buffer Enforcer', () => {
  test('Strictly rejects parsed JSON object bodies without raw Buffer', async () => {
    let statusCode = 200;
    let jsonPayload: any = null;

    const mockReq: any = {
      body: { id: 'evt_test_123', type: 'checkout.session.completed' },
      header: () => 't=123,v1=abcdef',
    };

    const mockRes: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonPayload = data;
        return this;
      },
    };

    await stripeWebhookHandler(mockReq, mockRes);

    assert.equal(statusCode, 400);
    assert.equal(jsonPayload.success, false);
    assert.match(jsonPayload.error, /raw unparsed Buffer/);
  });

  test('Strictly rejects requests missing stripe-signature header', async () => {
    let statusCode = 200;
    let jsonPayload: any = null;

    const mockReq: any = {
      body: Buffer.from(JSON.stringify({ id: 'evt_test_123' })),
      header: () => undefined,
    };

    const mockRes: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonPayload = data;
        return this;
      },
    };

    await stripeWebhookHandler(mockReq, mockRes);

    assert.equal(statusCode, 400);
    assert.equal(jsonPayload.success, false);
    assert.match(jsonPayload.error, /Missing stripe-signature header/);
  });
});
