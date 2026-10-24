import { Router, Request, Response } from 'express';
import { ProductService } from '../services/products.js';

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
    const products = await ProductService.getActiveProducts();
    const product = products.find((p) => p.id === productId || p.sku === productId);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    product.upvotes_count++;
    res.json({ success: true, upvotes_count: product.upvotes_count });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Upvote failed' });
  }
});
