import { Router, Request, Response } from 'express';
import { SuperPlatformService } from '../services/superPlatform.js';

const router = Router();

// Lumoscore AI Credit Risk Evaluation
router.post('/risk-score', (req: Request, res: Response) => {
  const { walletAddress, orderAmountCents } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ error: 'walletAddress is required' });
  }
  const assessment = SuperPlatformService.evaluateCreditRisk(walletAddress, orderAmountCents || 10000);
  return res.json({ status: 'success', data: assessment });
});

// UPI Instant Fiat Payment Link
router.post('/upi-payment', (req: Request, res: Response) => {
  const { amountInr, orderId } = req.body;
  const payment = SuperPlatformService.createUpiPayment(amountInr || 4150, orderId || 'NR_948102');
  return res.json({ status: 'success', data: payment });
});

// TRON TRC20 USDT Invoice
router.post('/tron-usdt', (req: Request, res: Response) => {
  const { amountUsdt } = req.body;
  const invoice = SuperPlatformService.createTronUsdtInvoice(amountUsdt || 49.9);
  return res.json({ status: 'success', data: invoice });
});

// Ostium Perps Quote Engine
router.get('/ostium-quote', (req: Request, res: Response) => {
  const pair = (req.query.pair as any) || 'XAU/USD';
  const leverage = parseInt(req.query.leverage as string) || 10;
  const quote = SuperPlatformService.getOstiumQuote(pair, leverage);
  return res.json({ status: 'success', data: quote });
});

export default router;
