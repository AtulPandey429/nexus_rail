import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller.js';

export const webhooksRouter = Router();

// POST /api/v1/webhooks/stripe - Stripe webhook endpoint
webhooksRouter.post('/stripe', WebhookController.handleStripe);

// Export handler for raw body mount in server.ts
export const stripeWebhookHandler = WebhookController.handleStripe;
