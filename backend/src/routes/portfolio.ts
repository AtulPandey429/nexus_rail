import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { PortfolioService } from '../services/portfolioService.js';
import type { AssetSymbol } from '../types/index.js';

export const portfolioRouter = Router();

/**
 * GET /api/v1/portfolio
 * Returns user's hydrated asset holdings, real-time valuation, cost basis, and unrealized P&L
 */
portfolioRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolio = await PortfolioService.getUserPortfolio(req.user!.id);
    return res.json({
      success: true,
      data: portfolio,
    });
  } catch (error: any) {
    console.error('❌ [portfolioRouter] GET / error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to fetch user portfolio',
    });
  }
});

/**
 * POST /api/v1/portfolio/sell
 * 1-Click Cashout: Liquidates a holding quantity at live oracle price minus 0.5% platform spread
 */
portfolioRouter.post('/sell', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const symbol = String(req.body?.symbol || '').trim().toUpperCase() as AssetSymbol;
    const quantity = Number(req.body?.quantity);

    if (!symbol || !quantity || isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'A valid asset symbol and positive quantity are required for cashout',
      });
    }

    const result = await PortfolioService.sellHolding(req.user!.id, {
      symbol,
      quantity,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const msg = error?.message || 'Cashout execution failed';
    const status = msg.includes('Insufficient') ? 400 : 500;
    return res.status(status).json({
      success: false,
      error: msg,
    });
  }
});
