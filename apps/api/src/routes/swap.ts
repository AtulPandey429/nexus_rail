import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CrossChainSwapService } from '../services/crossChainSwapService.js';
import { getFxQuote } from '../services/market.js';

export const swapRouter = Router();

const initiateSwapSchema = z.object({
  fromAsset: z.enum(['XRP', 'XLM']),
  toAsset: z.enum(['XLM', 'XRP']),
  amount: z.number().positive(),
  userDestinationAddress: z.string().min(10),
  userSourceAddress: z.string().optional(),
});

const executeSwapSchema = z.object({
  swapId: z.string(),
  depositTxHash: z.string().optional(),
  userSourceSecret: z.string().optional(),
});

/**
 * POST /api/v1/swap/quote
 * Returns live swap quote, exchange rate, and estimated received amount
 */
swapRouter.post('/quote', async (req: Request, res: Response) => {
  try {
    const { fromAsset, toAsset, amount } = req.body;
    const fx = await getFxQuote();
    const fromUsd = fromAsset === 'XRP' ? fx.xrpUsd : fx.xlmUsd;
    const toUsd = toAsset === 'XLM' ? fx.xlmUsd : fx.xrpUsd;
    const rate = fromUsd / toUsd;
    const receiveAmount = Number(((amount || 100) * rate).toFixed(4));

    return res.json({
      success: true,
      fromAsset,
      toAsset,
      amount: amount || 100,
      exchangeRate: Number(rate.toFixed(4)),
      receiveAmount,
      xlmUsd: fx.xlmUsd,
      xrpUsd: fx.xrpUsd,
      expiresInSeconds: 45,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/swap/initiate
 * Initiates an authoritative cross-chain escrow swap order
 */
swapRouter.post('/initiate', async (req: Request, res: Response) => {
  try {
    const parsed = initiateSwapSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid swap request parameters',
        details: parsed.error.format(),
      });
    }

    const order = await CrossChainSwapService.createSwapOrder(parsed.data);

    return res.json({
      success: true,
      data: order,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/swap/execute
 * Confirms the user's deposit to the platform vault and triggers the server hot wallet payout
 */
swapRouter.post('/execute', async (req: Request, res: Response) => {
  try {
    const parsed = executeSwapSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid execution parameters',
        details: parsed.error.format(),
      });
    }

    const result = await CrossChainSwapService.executeSwap(parsed.data);

    return res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/swap/:swapId
 * Fetches current swap status and on-chain transaction references
 */
swapRouter.get('/:swapId', (req: Request, res: Response) => {
  const swapId = String(req.params.swapId);
  const order = CrossChainSwapService.getSwapOrder(swapId);

  if (!order) {
    return res.status(404).json({ success: false, error: 'Swap order not found' });
  }

  return res.json({ success: true, data: order });
});
