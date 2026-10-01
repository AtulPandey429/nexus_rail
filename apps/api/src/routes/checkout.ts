import { Router, Request, Response } from 'express';
import { StripeService } from '../services/stripe.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { z } from 'zod';

export const checkoutRouter = Router();

const StripeSessionSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().positive().default(1),
});

// POST /api/v1/checkout/stripe/create-session - Create Stripe Test Checkout Session
checkoutRouter.post('/stripe/create-session', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = StripeSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'Invalid checkout parameters' });
    }

    const { sku, quantity } = parseResult.data;
    const userId = req.user!.id;
    const result = await StripeService.createCheckoutSession(userId, sku, quantity);

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Stripe session creation failed' });
  }
});

// POST /api/v1/webhooks/stripe - Stripe Raw Webhook Listener
checkoutRouter.post('/webhooks/stripe', (req: Request, res: Response) => {
  const signature = (req.headers['stripe-signature'] as string) || 'mock_sig';
  const rawBody = JSON.stringify(req.body);

  const isValid = StripeService.verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
  }

  // Handle checkout.session.completed event
  console.log('✅ [Stripe Webhook] Order payment verified successfully');
  res.json({ received: true, status: 'PAID' });
});
