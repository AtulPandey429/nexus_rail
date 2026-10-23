import { Router, Request, Response } from 'express';
import { RwaOracleService } from '../../services/rwa/oracleService.js';

export const rwaModularRouter = Router();

rwaModularRouter.get('/oracle/rates', async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, status: 'success', data: await RwaOracleService.getLiveCommodityRates() });
  } catch (error) {
    res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'Metal prices are unavailable' });
  }
});

rwaModularRouter.post('/tokens/mint', (_req: Request, res: Response) => {
  res.status(501).json({
    success: false,
    error: 'Token issuance is not available. A licensed issuer and custody provider are required.',
  });
});

rwaModularRouter.get('/perps/quote', (_req: Request, res: Response) => {
  res.status(501).json({ success: false, error: 'Perpetual quotes are not connected to a provider.' });
});
