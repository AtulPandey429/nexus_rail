import { Router, Request, Response } from 'express';
import { SorobanService } from '../services/soroban.js';

export const cryptoRouter = Router();

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
