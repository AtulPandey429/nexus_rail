import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { z } from 'zod';

export const reviewRouter = Router();

const ReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().min(5),
});

const mockReviews = [
  {
    id: 'rev_1',
    productId: 'PROD-XRP-KIT',
    userId: 'usr_verified_1',
    userName: 'Alex V.',
    rating: 5,
    comment: 'XRPL validator hardware synced in 10 minutes! Flawless transaction verification.',
    verifiedPurchase: true,
    createdAt: new Date().toISOString(),
  },
];

// GET /api/v1/products/:id/reviews - Fetch verified product reviews
reviewRouter.get('/:id/reviews', (req: Request, res: Response) => {
  res.json({ success: true, count: mockReviews.length, data: mockReviews });
});

// POST /api/v1/products/:id/reviews - Submit verified buyer review
reviewRouter.post('/:id/reviews', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const parseResult = ReviewSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ success: false, error: 'Invalid review fields' });
  }

  const { rating, comment } = parseResult.data;
  const newReview = {
    id: `rev_${Date.now()}`,
    productId: req.params.id as string,
    userId: req.user!.id,
    userName: 'Verified Buyer',
    rating,
    comment,
    verifiedPurchase: true,
    createdAt: new Date().toISOString(),
  };

  mockReviews.push(newReview);
  res.json({ success: true, data: newReview });
});
