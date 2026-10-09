import { Router, Request, Response } from 'express';
import { StripeService } from '../services/stripe.js';
import { XRPLService } from '../services/xrpl.js';
import { StellarService } from '../services/stellar.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { z } from 'zod';

export const checkoutRouter = Router();

const StripeSessionSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().positive().default(1),
});

const XRPLInvoiceSchema = z.object({
  orderId: z.string(),
  amountXrp: z.number().positive(),
});

const StellarInvoiceSchema = z.object({
  orderId: z.string(),
  amountXlm: z.number().positive(),
});

// POST /api/v1/checkout/stellar/create-invoice - Generate Stellar Horizon payment invoice with Memo text
checkoutRouter.post('/stellar/create-invoice', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = StellarInvoiceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'Invalid Stellar invoice parameters' });
    }

    const { orderId, amountXlm } = parseResult.data;
    const invoice = await StellarService.createPaymentInvoice(orderId, amountXlm);

    res.json({ success: true, invoice });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Stellar invoice generation failed' });
  }
});

// POST /api/v1/checkout/xrpl/create-invoice - Generate XRPL payment invoice with Destination Tag
checkoutRouter.post('/xrpl/create-invoice', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = XRPLInvoiceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'Invalid XRPL invoice parameters' });
    }

    const { orderId, amountXrp } = parseResult.data;
    const invoice = await XRPLService.createPaymentInvoice(orderId, amountXrp);

    res.json({ success: true, invoice });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'XRPL invoice generation failed' });
  }
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
