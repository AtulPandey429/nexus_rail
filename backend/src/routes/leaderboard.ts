import { Router, Request, Response } from 'express';
import { ProductService } from '../services/products.js';
import { RedisCacheService } from '../services/redis.js';

export const leaderboardRouter = Router();

// GET /api/v1/products/leaderboard - Fetch top trending products leaderboard
leaderboardRouter.get('/leaderboard', async (_req: Request, res: Response) => {
  try {
    const products = await ProductService.getActiveProducts();
    const sortedLeaderboard = [...products].sort((a, b) => b.upvotes_count - a.upvotes_count);
    res.json({ success: true, count: sortedLeaderboard.length, data: sortedLeaderboard });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

// POST /api/v1/products/:id/upvote - Cast upvote for product
leaderboardRouter.post('/:id/upvote', async (req: Request, res: Response) => {
  try {
    const productId = req.params.id as string;
    const upvotes = await ProductService.incrementUpvotes(productId);
    await RedisCacheService.invalidateCache('products:active');
    res.json({ success: true, upvotes_count: upvotes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upvote failed';
    res.status(message === 'Product not found' ? 404 : 500).json({ success: false, error: message });
  }
});
