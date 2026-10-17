import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { walletService } from '../services/wallet.js';

export const walletRouter = Router();

walletRouter.get('/balance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ success: true, balance: await walletService.getBalance(req.user!.id) });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch balance' });
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
