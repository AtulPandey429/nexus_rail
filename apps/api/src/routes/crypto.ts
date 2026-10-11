import { Router, Request, Response } from 'express';
import { SorobanService } from '../services/soroban.js';
import { RatesService } from '../services/rates.js';

export const cryptoRouter = Router();

// GET /api/v1/crypto/rates - Get live exchange rates for USD, XRP, XLM
cryptoRouter.get('/rates', async (_req: Request, res: Response) => {
  try {
    const rates = await RatesService.getExchangeRates();
    res.json({ success: true, data: rates });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch exchange rates' });
  }
});

// GET /api/v1/crypto/soroban/status/:txHash - Query Soroban contract execution state
cryptoRouter.get('/soroban/status/:txHash', async (req: Request, res: Response) => {
  try {
    const txHash = Array.isArray(req.params.txHash) ? req.params.txHash[0] : req.params.txHash;
    const status = await SorobanService.getContractExecutionStatus(txHash);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch Soroban contract status' });
  }
});
