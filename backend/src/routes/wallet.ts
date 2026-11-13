import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { walletService } from '../services/wallet.js';
import { PortfolioService } from '../services/portfolioService.js';
import type { AssetSymbol } from '../types/index.js';

export const walletRouter = Router();

walletRouter.get('/balance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ success: true, balance: await walletService.getBalance(req.user!.id) });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch balance' });
  }
});

walletRouter.get('/portfolio', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolio = await PortfolioService.getUserPortfolio(req.user!.id);
    res.json({ success: true, data: portfolio });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch portfolio' });
  }
});

walletRouter.post('/portfolio/sell', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const symbol = String(req.body?.symbol || '').trim().toUpperCase() as AssetSymbol;
    const quantity = Number(req.body?.quantity);
    if (!symbol || !quantity || isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, error: 'Valid symbol and positive quantity are required' });
    }
    const result = await PortfolioService.sellHolding(req.user!.id, { symbol, quantity });
    res.json({ success: true, data: result });
  } catch (error: any) {
    const msg = error?.message || 'Cashout execution failed';
    const status = msg.includes('Insufficient') ? 400 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

walletRouter.post('/topup', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.status(400).json({
    success: false,
    error: 'Wallet credits are recorded only after a confirmed provider payment. This route does not mint a balance.',
  });
});

walletRouter.get('/transactions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ success: true, transactions: await walletService.getTransactions(req.user!.id) });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch transactions' });
  }
});
