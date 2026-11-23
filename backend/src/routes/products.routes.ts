import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ProductController } from '../controllers/product.controller.js';

export const productRouter = Router();

// GET /api/v1/products - Fetch active live-hydrated catalog
productRouter.get('/', ProductController.getProducts);

// GET /api/v1/products/leaderboard - Top trending products leaderboard
productRouter.get('/leaderboard', ProductController.getLeaderboard);

// GET /api/v1/products/:sku - Single product by SKU
productRouter.get('/:sku', ProductController.getProductBySku);

// POST /api/v1/products/:id/upvote - Cast upvote for product
productRouter.post('/:id/upvote', ProductController.upvoteProduct);

// GET & POST /api/v1/products/:id/reviews - Product reviews
productRouter.get('/:id/reviews', ProductController.getReviews);
productRouter.post('/:id/reviews', requireAuth, ProductController.createReview);
