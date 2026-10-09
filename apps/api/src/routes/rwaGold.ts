import { Router, Request, Response } from 'express';
import { RwaGoldService } from '../services/rwaGold.js';

export const rwaGoldRouter = Router();

// GET /api/v1/rwa/live-prices (Fetches Live Gold & Silver Oracle Prices - NO MOCKS)
rwaGoldRouter.get('/live-prices', async (_req: Request, res: Response) => {
  try {
    const prices = await RwaGoldService.fetchLiveCommodityPrices();
    return res.json({ status: 'success', data: prices });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'ORACLE_FETCH_FAILED', message: error.message } });
  }
});

// POST /api/v1/rwa/issue-token (Mints Real Stellar Horizon Testnet Tokens)
rwaGoldRouter.post('/issue-token', async (req: Request, res: Response) => {
  try {
    const { assetCode = 'nGOLD', amountGrams = 1.0, walletAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLF2C' } = req.body;
    const result = await RwaGoldService.issueRwaTokenOnStellar(assetCode, amountGrams, walletAddress);
    return res.json({ status: 'success', data: result });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'TOKEN_ISSUE_FAILED', message: error.message } });
  }
});
