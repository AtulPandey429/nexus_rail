import Stripe from 'stripe';
import { requiredEnv } from '../config/env.js';
import { MongoService, MongoOrderDoc, MongoCartItemDoc, OrderItem } from './mongo.js';
import { ProductService } from './products.js';
import { settlementEmitter } from './settlementEvents.js';
import { OrderSequenceService } from './orderSequence.js';
import crypto from 'crypto';

function stripe(): Stripe {
  return new Stripe(requiredEnv('STRIPE_SECRET_KEY'));
}

export class StripeService {
  static async createCheckoutFromCart(userId: string, customClientUrl?: string) {
    const cartCol = await MongoService.getCollection<MongoCartItemDoc>('cart_items');
    const lines = await cartCol.find({ user_id: userId }).toArray();
    if (lines.length === 0) throw new Error('Cart is empty');

    const priced: OrderItem[] = [];
    for (const line of lines) {
      const product = await ProductService.getProductBySku(line.sku);
      if (!product || !product.active) throw new Error(`SKU ${line.sku} is not for sale`);
      priced.push({
        sku: product.sku,
        title: product.title,
        qty: line.qty,
        unit_price_cents: product.price_cents,
      });
    }

    const totalCents = priced.reduce((sum, line) => sum + line.unit_price_cents * line.qty, 0);
    const orderId = crypto.randomUUID();
    const orderNumber = await OrderSequenceService.getNextOrderNumber();
    const now = new Date().toISOString();

    const orderDoc: MongoOrderDoc = {
      id: orderId,
      user_id: userId,
      order_number: orderNumber,
      total_cents: totalCents,
      items: priced,
      payment_rail: 'STRIPE',
      status: 'PENDING',
      created_at: now,
      updated_at: now,
    };

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    await ordersCol.insertOne(orderDoc as any);

    // Resolve client origin dynamically (e.g. Vercel deployment URL or localhost)
    let fallbackOrigin = 'https://nexus-rail.vercel.app';
    try {
      const envAppUrl = process.env.APP_URL;
      if (envAppUrl) fallbackOrigin = envAppUrl;
    } catch {
      // quiet fallback
    }

    const origin = (customClientUrl || fallbackOrigin).replace(/\/+$/, '');
    const amountDollars = (totalCents / 100).toFixed(2);

    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      client_reference_id: orderId,
      success_url: `${origin}/app/receipt?orderId=${orderId}&rail=STRIPE&amount=${amountDollars}`,
      cancel_url: `${origin}/app/cart`,
      metadata: { orderId },
      line_items: priced.map((line) => ({
        quantity: line.qty,
        price_data: {
          currency: 'usd',
          unit_amount: line.unit_price_cents,
          product_data: { name: line.title },
        },
      })),
    });

    if (!session.url || !session.id) throw new Error('Stripe did not return a checkout URL');

    await ordersCol.updateOne({ id: orderId }, { $set: { stripe_session_id: session.id } });

    return {
      sessionId: session.id,
      url: session.url,
      orderId,
      orderNumber,
      totalCents,
    };
  }

  static constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return stripe().webhooks.constructEvent(rawBody, signature, requiredEnv('STRIPE_WEBHOOK_SECRET'));
  }

  static async fulfillOrderFromSession(session: any): Promise<{ orderId: string; status: string }> {
    const orderId = session?.metadata?.orderId || session?.client_reference_id;
    if (!orderId) throw new Error('Stripe session did not include an order id');

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const result = await ordersCol.findOneAndUpdate(
      { id: orderId, status: { $ne: 'PAID' } },
      {
        $set: {
          status: 'PAID',
          stripe_session_id: session.id,
          updated_at: new Date().toISOString(),
        },
      },
      { returnDocument: 'after' }
    );

    const doc: any = (result as any)?.value || result;

    // Broadcast SSE settlement event
    settlementEmitter.emitSettlement({
      orderId,
      orderNumber: doc?.order_number,
      status: 'PAID',
      paymentRail: 'STRIPE',
      txHash: session.payment_intent ? String(session.payment_intent) : `stripe_${session.id}`,
      timestamp: new Date().toISOString(),
    });

    return { orderId, status: 'PAID' };
  }

  static async markCheckoutPaid(rawBody: Buffer, signature: string | undefined) {
    if (!signature) throw new Error('Missing Stripe-Signature header');
    let event: Stripe.Event;
    try {
      event = this.constructWebhookEvent(rawBody, signature);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Stripe signature verification failed');
    }

    if (event.type !== 'checkout.session.completed') {
      return { received: true, ignored: event.type };
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const fulfilled = await this.fulfillOrderFromSession(session);

    return { received: true, order: fulfilled };
  }
}
