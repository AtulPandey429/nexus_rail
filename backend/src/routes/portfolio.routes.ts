import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { PortfolioController } from '../controllers/portfolio.controller.js';

export const portfolioRouter = Router();

// GET /api/v1/portfolio - Returns user's hydrated asset holdings
portfolioRouter.get('/', requireAuth, PortfolioController.getPortfolio);

// POST /api/v1/portfolio/sell - 1-Click Cashout
portfolioRouter.post('/sell', requireAuth, PortfolioController.sellHolding);
