import { Router, Request, Response } from 'express';
import { RwaOracleService } from '../../services/rwa/oracleService.js';
import { RwaTokenIssuerService } from '../../services/rwa/tokenIssuerService.js';
import { RwaPerpsService } from '../../services/rwa/perpsService.js';

export const rwaModularRouter = Router();

// GET /api/v1/rwa/oracle/rates
rwaModularRouter.get('/oracle/rates', async (_req: Request, res: Response) => {
  try {
    const rates = await RwaOracleService.getLiveCommodityRates();
    return res.json({ status: 'success', data: rates });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'ORACLE_FETCH_FAILED', message: error.message } });
  }
});

// POST /api/v1/rwa/tokens/mint
rwaModularRouter.post('/tokens/mint', async (req: Request, res: Response) => {
  try {
    const { assetCode = 'nGOLD', amountGrams = 1.0, recipientWallet = 'GBRPYHIL2CI3FNQ4BXLFMNDLF2C' } = req.body;
    const result = await RwaTokenIssuerService.issueRwaToken(assetCode, amountGrams, recipientWallet);
    return res.json({ status: 'success', data: result });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'MINT_FAILED', message: error.message } });
  }
});

// GET /api/v1/rwa/perps/quote
rwaModularRouter.get('/perps/quote', (req: Request, res: Response) => {
  try {
    const pair = (req.query.pair as any) || 'XAU/USD';
    const leverage = parseInt(req.query.leverage as string) || 2;
    const size = parseFloat(req.query.size as string) || 100;
    const quote = RwaPerpsService.getPerpsQuote(pair, leverage, size);
    return res.json({ status: 'success', data: quote });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'QUOTE_FAILED', message: error.message } });
  }
});
