import { Router, Request, Response } from 'express';
import { RwaGoldService, tokenIssuanceUnavailable } from '../services/rwaGold.js';

export const rwaGoldRouter = Router();

rwaGoldRouter.get('/live-prices', async (_req: Request, res: Response) => {
  try {
    const prices = await RwaGoldService.fetchLiveCommodityPrices();
    res.json({ status: 'success', success: true, data: prices });
  } catch (error) {
    res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'Metal prices are unavailable' });
  }
});

rwaGoldRouter.post('/issue-token', (_req: Request, res: Response) => {
  try {
    tokenIssuanceUnavailable();
  } catch (error) {
    res.status(501).json({ success: false, error: error instanceof Error ? error.message : 'Token issuance is not available' });
  }
});
