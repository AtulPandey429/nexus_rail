import { Router, Request, Response } from 'express';
import { RatesService } from '../services/rates.js';
import { chainRegistry } from '../services/crypto/index.js';

export const cryptoRouter = Router();

// GET /api/v1/crypto/rates - Get live exchange rates for USD, XRP, XLM
cryptoRouter.get('/rates', async (_req: Request, res: Response) => {
  try {
    const rates = await RatesService.getExchangeRates();
    res.json({ success: true, data: rates });
  } catch (error) {
    res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch exchange rates' });
  }
});

// GET /api/v1/crypto/providers - Discover all registered multi-chain providers
cryptoRouter.get('/providers', async (_req: Request, res: Response) => {
  try {
    const providers = chainRegistry.getAllProviders();
    const list = await Promise.all(
      providers.map(async (p) => {
        let balanceInfo = { balance: 0, currency: p.assetSymbol };
        try {
          balanceInfo = await p.getAccountBalance();
        } catch {
          // Continue if node temporarily unreachable
        }
        return {
          chainId: p.chainId,
          assetSymbol: p.assetSymbol,
          network: p.network,
          vaultBalance: balanceInfo.balance,
          isTestnet: p.network === 'testnet',
        };
      })
    );
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/crypto/balance/:chain - Fetch live testnet account balance
cryptoRouter.get('/balance/:chain', async (req: Request, res: Response) => {
  try {
    const chainId = String(req.params.chain || '');
    const address = req.query.address ? String(req.query.address) : undefined;
    const provider = chainRegistry.getRequiredProvider(chainId);
    const balance = await provider.getAccountBalance(address);
    res.json({
      success: true,
      chain: provider.chainId,
      network: provider.network,
      data: balance,
    });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message });
  }
});

// GET /api/v1/crypto/verify/:chain/:txHash - Direct transaction verification
cryptoRouter.get('/verify/:chain/:txHash', async (req: Request, res: Response) => {
  try {
    const chainId = String(req.params.chain || '');
    const txHash = String(req.params.txHash || '');
    const provider = chainRegistry.getRequiredProvider(chainId);
    const result = await provider.verifyPayment('manual_verify', txHash);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message });
  }
});
