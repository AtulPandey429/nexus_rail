import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { ProductService } from '../services/products.js';
import { RedisCacheService } from '../services/redis.js';
import { MongoService } from '../services/mongo.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

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

export class ProductController {
  /**
   * GET /api/v1/products
   * Fetch active catalog with 60s Redis Cache-Aside
   */
  static async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const cacheKey = 'products:active';
      const cachedData = !forceRefresh ? await RedisCacheService.getCache<any[]>(cacheKey) : null;

      if (cachedData) {
        res.json({
          success: true,
          cached: true,
          count: cachedData.length,
          data: cachedData,
        });
        return;
      }

      const products = await ProductService.getActiveProducts(forceRefresh);
      await RedisCacheService.setCache(cacheKey, products, 60);

      res.json({
        success: true,
        cached: false,
        count: products.length,
        data: products,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch products',
      });
    }
  }

  /**
   * GET /api/v1/products/leaderboard
   */
  static async getLeaderboard(_req: Request, res: Response): Promise<void> {
    try {
      const products = await ProductService.getActiveProducts();
      const sortedLeaderboard = [...products].sort((a, b) => b.upvotes_count - a.upvotes_count);
      res.json({ success: true, count: sortedLeaderboard.length, data: sortedLeaderboard });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
    }
  }

  /**
   * GET /api/v1/products/:sku
   * Fetch single product by SKU
   */
  static async getProductBySku(req: Request, res: Response): Promise<void> {
    try {
      const sku = Array.isArray(req.params.sku) ? req.params.sku[0] : req.params.sku;
      const product = await ProductService.getProductBySku(sku);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }
      res.json({ success: true, data: product });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch product details',
      });
    }
  }

  /**
   * POST /api/v1/products/:id/upvote
   */
  static async upvoteProduct(req: Request, res: Response): Promise<void> {
    try {
      const productId = req.params.id as string;
      const upvotes = await ProductService.incrementUpvotes(productId);
      await RedisCacheService.invalidateCache('products:active');
      res.json({ success: true, upvotes_count: upvotes });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upvote failed';
      res.status(message === 'Product not found' ? 404 : 500).json({ success: false, error: message });
    }
  }

  /**
   * GET /api/v1/products/:id/reviews
   */
  static async getReviews(req: Request, res: Response): Promise<void> {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const product = (await ProductService.getProductBySku(id)) || (await ProductService.getProductById(id));
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      const reviewsCol = await MongoService.getCollection<MongoReviewDoc>('product_reviews');
      const reviews = await reviewsCol
        .find({ $or: [{ product_id: product.id }, { sku: product.sku }] })
        .sort({ created_at: -1 })
        .toArray();

      res.json({ success: true, count: reviews.length, data: reviews });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/v1/products/:id/reviews
   */
  static async createReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    const parsed = ReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid review fields' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const product = (await ProductService.getProductBySku(id)) || (await ProductService.getProductById(id));
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      const ordersCol = await MongoService.getCollection('orders');
      const paidOrder = await ordersCol.findOne({
        user_id: req.user!.id,
        status: 'PAID',
        'items.sku': product.sku,
      });
      const verified = Boolean(paidOrder);

      const review: MongoReviewDoc = {
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
      await reviewsCol.insertOne(review as any);
      res.status(201).json({ success: true, data: review });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
