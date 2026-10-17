import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { db, dbError } from '../db/supabase.js';
import { ProductService } from '../services/products.js';
import { AIRouterService } from '../services/ai/aiRouter.js';

export const guideRouter = Router();
guideRouter.use(requireAuth);

guideRouter.get('/messages', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await db()
    .from('guide_messages')
    .select('role, body, suggested_skus')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({
    success: true,
    data: {
      messages: (data ?? []).map((row) => ({ role: row.role, body: row.body, suggestedSkus: row.suggested_skus ?? [] })),
    },
  });
});

guideRouter.post('/messages', async (req: AuthenticatedRequest, res: Response) => {
  const message = req.body?.message;
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }
  try {
    const products = await ProductService.getActiveProducts();
    const catalog = products.map((product) => `${product.sku}: ${product.title} ($${(product.price_cents / 100).toFixed(2)})`).join('\n');
    const savedUser = await db().from('guide_messages').insert({ user_id: req.user!.id, role: 'user', body: message, suggested_skus: [] });
    if (savedUser.error) throw dbError(savedUser.error, 'Could not save the question');
    const ai = await AIRouterService.chatCompletion([
      {
        role: 'system',
        content: `You recommend products from this catalog only. Mention SKUs exactly when you recommend them.\n${catalog || 'The catalog is empty.'}`,
      },
      { role: 'user', content: message },
    ]);
    const suggestedSkus = products.map((product) => product.sku).filter((sku) => ai.reply.includes(sku));
    const savedAssistant = await db().from('guide_messages').insert({
      user_id: req.user!.id,
      role: 'assistant',
      body: ai.reply,
      suggested_skus: suggestedSkus,
    });
    if (savedAssistant.error) throw dbError(savedAssistant.error, 'Could not save the reply');
    const thread = await db()
      .from('guide_messages')
      .select('role, body, suggested_skus')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: true });
    if (thread.error) throw dbError(thread.error, 'Could not load the thread');
    res.json({
      success: true,
      data: {
        reply: ai.reply,
        suggestedSkus,
        messages: (thread.data ?? []).map((row) => ({ role: row.role, body: row.body, suggestedSkus: row.suggested_skus ?? [] })),
      },
    });
  } catch (error) {
    res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'The catalog guide failed' });
  }
});
