import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { MongoService } from '../services/mongo.js';
import { ProductService } from '../services/products.js';
import crypto from 'crypto';

export const reviewRouter = Router();

const ReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().min(5),
});

export interface MongoReviewDoc {
  id: string;
  product_id: string;
  sku: string;
  user_id: string;
  rating: number;
  comment: string;
  verified_purchase: boolean;
  created_at: string;
}

reviewRouter.get('/:id/reviews', async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const product = (await ProductService.getProductBySku(id)) || (await ProductService.getProductById(id));
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    const reviewsCol = await MongoService.getCollection<MongoReviewDoc>('product_reviews');
    const reviews = await reviewsCol
      .find({ $or: [{ product_id: product.id }, { sku: product.sku }] })
      .sort({ created_at: -1 })
      .toArray();

    res.json({ success: true, count: reviews.length, data: reviews });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reviewRouter.post('/:id/reviews', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid review fields' });
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const product = (await ProductService.getProductBySku(id)) || (await ProductService.getProductById(id));
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    // Check if user has a verified paid order for this item
    const ordersCol = await MongoService.getCollection('orders');
    const paidOrder = await ordersCol.findOne({
      user_id: req.user!.id,
      status: 'PAID',
      'items.sku': product.sku,
    });
    const verified = Boolean(paidOrder);

    const reviewDoc: MongoReviewDoc = {
      id: crypto.randomUUID(),
      product_id: product.id,
      sku: product.sku,
      user_id: req.user!.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      verified_purchase: verified,
      created_at: new Date().toISOString(),
    };

    const reviewsCol = await MongoService.getCollection<MongoReviewDoc>('product_reviews');
    await reviewsCol.insertOne(reviewDoc as any);

    res.json({ success: true, data: reviewDoc });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
