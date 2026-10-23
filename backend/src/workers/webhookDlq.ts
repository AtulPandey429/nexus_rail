import { MongoService, MongoWebhookEventDoc } from '../services/mongo.js';
import { StripeService } from '../services/stripe.js';

export class WebhookDlqWorker {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Sweeps and recovers transiently failed or unfulfilled webhook events
   */
  static async retryFailedEvents(): Promise<{ processedCount: number; failedCount: number }> {
    let processedCount = 0;
    let failedCount = 0;

    try {
      const eventsCol = await MongoService.getCollection<MongoWebhookEventDoc>('webhook_events');
      const recoverableEvents = await eventsCol
        .find({
          status: { $in: ['FAILED', 'PENDING'] },
          retry_count: { $lt: 5 },
        })
        .limit(20)
        .toArray();

      if (recoverableEvents.length === 0) {
        return { processedCount: 0, failedCount: 0 };
      }

      console.log(`🔄 [WebhookDlqWorker] Recovering ${recoverableEvents.length} pending/failed webhook events...`);

      for (const event of recoverableEvents) {
        try {
          if (event.source === 'STRIPE' && event.type === 'checkout.session.completed') {
            await StripeService.fulfillOrderFromSession(event.payload);
            await eventsCol.updateOne(
              { id: event.id },
              {
                $set: {
                  status: 'PROCESSED',
                  updated_at: new Date().toISOString(),
                },
              }
            );
            processedCount++;
            console.log(`✅ [Webhook DLQ] Recovered event ${event.id} and marked order PAID`);
          } else {
            // Unsupported or irrelevant event type, mark processed
            await eventsCol.updateOne(
              { id: event.id },
              { $set: { status: 'PROCESSED', updated_at: new Date().toISOString() } }
            );
            processedCount++;
          }
        } catch (err: any) {
          failedCount++;
          await eventsCol.updateOne(
            { id: event.id },
            {
              $set: {
                status: 'FAILED',
                last_error: err.message,
                updated_at: new Date().toISOString(),
              },
              $inc: { retry_count: 1 },
            }
          );
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [WebhookDlqWorker Poll Warning]:', err.message);
    }

    return { processedCount, failedCount };
  }

  static startWorker(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('🔄 [WebhookDlqWorker] Background DLQ Retry Sweeper Started (60s tick)');

    this.timer = setInterval(async () => {
      await this.retryFailedEvents();
    }, 60000);
    this.timer.unref?.();
  }

  static stopWorker(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }
}
