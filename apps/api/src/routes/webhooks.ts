import { Router, Request, Response } from 'express';
import { StripeService } from '../services/stripe.js';
import { MongoService, MongoWebhookEventDoc } from '../services/mongo.js';

export const webhooksRouter = Router();

export async function stripeWebhookHandler(req: Request, res: Response) {
  try {
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        success: false,
        error: 'Stripe webhook requires raw unparsed Buffer payload for HMAC signature validation',
      });
    }

    const signature = req.header('stripe-signature');
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing stripe-signature header',
      });
    }

    // 1. Verify cryptographic HMAC signature
    const event = StripeService.constructWebhookEvent(req.body, signature);

    // 2. Persist to Webhook Dead-Letter Queue (DLQ) idempotently
    const eventsCol = await MongoService.getCollection<MongoWebhookEventDoc>('webhook_events');
    const existing = await eventsCol.findOne({ id: event.id });

    if (existing && existing.status === 'PROCESSED') {
      return res.json({ success: true, received: true, duplicate: true, eventId: event.id });
    }

    const now = new Date().toISOString();
    await eventsCol.updateOne(
      { id: event.id },
      {
        $setOnInsert: {
          id: event.id,
          source: 'STRIPE',
          type: event.type,
          payload: event.data.object,
          status: 'PENDING',
          retry_count: 0,
          created_at: now,
        },
        $set: { updated_at: now },
      },
      { upsert: true }
    );

    // 3. Immediately acknowledge Stripe with 200 OK (< 50ms) to prevent timeout retries
    res.json({ success: true, received: true, eventId: event.id });

    // 4. Process event asynchronously
    try {
      if (event.type === 'checkout.session.completed') {
        await StripeService.fulfillOrderFromSession(event.data.object);
      }
      await eventsCol.updateOne(
        { id: event.id },
        { $set: { status: 'PROCESSED', updated_at: new Date().toISOString() } }
      );
    } catch (procErr: any) {
      console.error(`❌ [Webhook DLQ] Async fulfillment failed for ${event.id}:`, procErr.message);
      await eventsCol.updateOne(
        { id: event.id },
        {
          $set: {
            status: 'FAILED',
            last_error: procErr.message,
            updated_at: new Date().toISOString(),
          },
          $inc: { retry_count: 1 },
        }
      );
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Webhook rejected' });
  }
}
