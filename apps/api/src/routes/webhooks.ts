import { Router, Request, Response } from 'express';
import { StripeService } from '../services/stripe.js';

export const webhooksRouter = Router();

export async function stripeWebhookHandler(req: Request, res: Response) {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const result = await StripeService.markCheckoutPaid(raw, req.header('stripe-signature'));
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Webhook rejected' });
  }
}

webhooksRouter.post('/stripe', stripeWebhookHandler);
