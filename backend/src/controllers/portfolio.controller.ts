import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { PortfolioService } from '../services/portfolio.service.js';
import type { AssetSymbol } from '../types/index.js';

export class PortfolioController {
  /**
   * GET /api/v1/portfolio
   */
  static async getPortfolio(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const portfolio = await PortfolioService.getUserPortfolio(req.user!.id);
      res.json({
        success: true,
        data: portfolio,
      });
    } catch (error: any) {
      console.error('❌ [PortfolioController] GET / error:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to fetch user portfolio',
      });
    }
  }

  /**
   * POST /api/v1/portfolio/sell
   */
  static async sellHolding(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const symbol = String(req.body?.symbol || '').trim().toUpperCase() as AssetSymbol;
      const quantity = Number(req.body?.quantity);

      if (!symbol || !quantity || isNaN(quantity) || quantity <= 0) {
        res.status(400).json({
          success: false,
          error: 'A valid asset symbol and positive quantity are required for cashout',
        });
        return;
      }

      const result = await PortfolioService.sellHolding(req.user!.id, {
        symbol,
        quantity,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      const msg = error?.message || 'Cashout execution failed';
      const status = msg.includes('Insufficient') ? 400 : 500;
      res.status(status).json({
        success: false,
        error: msg,
      });
    }
  }
}
