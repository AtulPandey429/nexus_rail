import { Router, Request, Response } from 'express';
import { StripeService } from '../services/stripe.js';
import { masterOrdersStore } from './orders.js';

export const webhooksRouter = Router();

// POST /api/v1/webhooks/stripe - Official Master Plan Stripe Webhook Listener
webhooksRouter.post('/stripe', (req: Request, res: Response) => {
  const signature = (req.headers['stripe-signature'] as string) || 'mock_sig_test_mode';
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  // 1. Verify Cryptographic Webhook Signature
  const isValid = StripeService.verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    return res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Stripe signature verification failed' } });
  }

  // 2. Extract Event Details (checkout.session.completed)
  const event = req.body || {};
  const eventType = event.type || 'checkout.session.completed';
  const orderId = event.data?.object?.metadata?.orderId || event.data?.object?.client_reference_id;

  console.log(`🔔 [Stripe Webhook] Received Event: ${eventType} | Order ID: ${orderId || 'NR-1001'}`);

  // 3. Update Order Status from PENDING -> PAID
  if (orderId) {
    const order = masterOrdersStore.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (order && order.status === 'PENDING') {
      order.status = 'PAID';
      console.log(`✅ [Stripe Webhook] Updated Order ${order.orderNumber} status to PAID`);
    }
  }

  return res.json({ received: true, status: 'PAID', eventType });
});
