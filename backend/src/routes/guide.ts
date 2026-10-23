import { Router, Response } from 'express';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { MongoService, MongoGuideMessageDoc } from '../services/mongo.js';
import { ProductService } from '../services/products.js';
import { AIRouterService } from '../services/ai/aiRouter.js';

export const guideRouter = Router();
guideRouter.use(requireAuth);

guideRouter.get('/messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const col = await MongoService.getCollection<MongoGuideMessageDoc>('guide_messages');
    const messages = await col
      .find({ user_id: req.user!.id })
      .sort({ created_at: 1 })
      .toArray();

    res.json({
      success: true,
      data: {
        messages: messages.map((row) => ({
          role: row.role,
          body: row.body,
          suggestedSkus: row.suggested_skus ?? [],
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load guide messages' });
  }
});

guideRouter.post('/messages', async (req: AuthenticatedRequest, res: Response) => {
  const message = req.body?.message;
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  try {
    const col = await MongoService.getCollection<MongoGuideMessageDoc>('guide_messages');
    const now = new Date().toISOString();

    const products = await ProductService.getActiveProducts();
    const catalog = products
      .map((product) => `${product.sku}: ${product.title} ($${(product.price_cents / 100).toFixed(2)})`)
      .join('\n');

    // 1. Save user question to MongoDB Atlas
    await col.insertOne({
      id: crypto.randomUUID(),
      user_id: req.user!.id,
      role: 'user',
      body: message.trim(),
      suggested_skus: [],
      created_at: now,
    });

    // 2. Chat completion
    let aiReply = 'I can help you explore our hardware catalog. Check out Rail One or our Relay Desk Mat.';
    try {
      const ai = await AIRouterService.chatCompletion([
        {
          role: 'system',
          content: `You recommend products from this catalog only. Mention SKUs exactly when you recommend them.\n${catalog || 'The catalog is empty.'}`,
        },
        { role: 'user', content: message },
      ]);
      aiReply = ai.reply;
    } catch {
      if (catalog) {
        aiReply = `Here are the products currently available in our catalog:\n${catalog}`;
      }
    }

    const suggestedSkus = products
      .map((product) => product.sku)
      .filter((sku) => aiReply.includes(sku));

    // 3. Save assistant reply to MongoDB Atlas
    await col.insertOne({
      id: crypto.randomUUID(),
      user_id: req.user!.id,
      role: 'assistant',
      body: aiReply,
      suggested_skus: suggestedSkus,
      created_at: new Date().toISOString(),
    });

    // 4. Return complete thread
    const thread = await col
      .find({ user_id: req.user!.id })
      .sort({ created_at: 1 })
      .toArray();

    res.json({
      success: true,
      data: {
        reply: aiReply,
        suggestedSkus,
        messages: thread.map((row) => ({
          role: row.role,
          body: row.body,
          suggestedSkus: row.suggested_skus ?? [],
        })),
      },
    });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message || 'The catalog guide failed' });
  }
});
