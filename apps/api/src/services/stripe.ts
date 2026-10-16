import Stripe from 'stripe';
import { requiredEnv } from '../config/env.js';
import { MongoService, MongoOrderDoc, MongoCartItemDoc, OrderItem } from './mongo.js';
import { ProductService } from './products.js';
import crypto from 'crypto';

function stripe(): Stripe {
  return new Stripe(requiredEnv('STRIPE_SECRET_KEY'));
}

export class StripeService {
  static async createCheckoutFromCart(userId: string) {
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
    const orderNumber = `NR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
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

    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      client_reference_id: orderId,
      success_url: `${requiredEnv('APP_URL')}/app/orders?orderId=${orderId}`,
      cancel_url: `${requiredEnv('APP_URL')}/app/cart`,
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

  static async markCheckoutPaid(rawBody: Buffer, signature: string | undefined) {
    if (!signature) throw new Error('Missing Stripe-Signature header');
    let event: Stripe.Event;
    try {
      event = stripe().webhooks.constructEvent(rawBody, signature, requiredEnv('STRIPE_WEBHOOK_SECRET'));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Stripe signature verification failed');
    }

    if (event.type !== 'checkout.session.completed') {
      return { received: true, ignored: event.type };
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId || session.client_reference_id;
    if (!orderId) throw new Error('Stripe session did not include an order id');

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const updated = await ordersCol.findOneAndUpdate(
      { id: orderId, status: 'PENDING' },
      { $set: { status: 'PAID', updated_at: new Date().toISOString() } },
      { returnDocument: 'after' }
    );

    return { received: true, order: updated };
  }
}
