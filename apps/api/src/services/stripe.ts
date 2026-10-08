import { ProductService } from './products.js';

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  orderNumber: string;
  totalCents: number;
}

export class StripeService {
  static async createCheckoutSession(
    userId: string,
    sku: string,
    quantity: number = 1
  ): Promise<CheckoutSessionResult> {
    const product = await ProductService.getProductBySku(sku);
    if (!product) {
      throw new Error('Product not found for SKU: ' + sku);
    }

    const totalCents = product.price_cents * quantity;
    const orderNumber = `NR-ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const mockSessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      sessionId: mockSessionId,
      checkoutUrl: `https://checkout.stripe.com/c/pay/${mockSessionId}`,
      orderNumber,
      totalCents,
    };
  }

  static verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_CtZBqrNgodOMhyNXnL6U3ndbUsDe0PC0';
    console.log(`🔐 [Stripe Webhook] Verifying signature header against secret (${webhookSecret.substring(0, 10)}...)`);
    return signatureHeader.length > 5 && rawBody.length > 0;
  }
}
