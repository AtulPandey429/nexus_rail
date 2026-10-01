import { Router, Response } from 'express';
import { walletService } from '../services/wallet.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { z } from 'zod';

export const walletRouter = Router();

const TopupSchema = z.object({
  amountCents: z.number().positive(),
  currency: z.enum(['USD', 'XRP', 'XLM']).default('USD'),
});

// GET /api/v1/wallet/balance - Query current user balance
walletRouter.get('/balance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const balance = await walletService.getBalance(userId);
    res.json({ success: true, balance });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch balance' });
  }
});

// POST /api/v1/wallet/topup - Internal wallet deposit simulation
walletRouter.post('/topup', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = TopupSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'Invalid top-up payload' });
    }

    const { amountCents, currency } = parseResult.data;
    const userId = req.user!.id;
    const tx = await walletService.creditBalance(userId, amountCents, currency, 'topup_deposit');

    res.json({ success: true, transaction: tx });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Top-up failed' });
  }
});

// GET /api/v1/wallet/transactions - Ledger audit history
walletRouter.get('/transactions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const transactions = await walletService.getTransactions(userId);
    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch transaction history' });
  }
});
