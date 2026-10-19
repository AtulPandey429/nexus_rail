import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CrossChainSwapService } from '../services/crossChainSwapService.js';
import { getFxQuote } from '../services/market.js';
import { stellarProvider } from '../services/crypto/index.js';

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
 * POST /api/v1/swap/stellar/prepare-xdr
 * Builds unsigned transaction XDR for Freighter browser extension
 */
swapRouter.post('/stellar/prepare-xdr', async (req: Request, res: Response) => {
  try {
    const { swapId, sourcePublicKey } = req.body || {};
    if (!swapId || !sourcePublicKey) {
      return res.status(400).json({ success: false, error: 'swapId and sourcePublicKey are required' });
    }

    const order = CrossChainSwapService.getSwapOrder(swapId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Swap order not found or expired' });
    }

    if (order.fromAsset !== 'XLM') {
      return res.status(400).json({ success: false, error: 'Source asset is not XLM for this swap order' });
    }

    const memoText = String(order.paymentIdentifier);
    const xdr = await stellarProvider.buildPaymentXdr(
      sourcePublicKey,
      order.payAmount,
      memoText
    );

    return res.json({
      success: true,
      xdr,
      destination: order.platformDepositAddress,
      amountXlm: order.payAmount,
      memo: memoText,
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
  } catch (error: any) {
    return res.status(502).json({ success: false, error: error.message || 'Failed to prepare Stellar XDR' });
  }
});

/**
 * POST /api/v1/swap/stellar/submit-xdr
 * Submits client-signed Freighter XDR to Stellar Horizon testnet
 */
swapRouter.post('/stellar/submit-xdr', async (req: Request, res: Response) => {
  try {
    const { signedXdr } = req.body || {};
    if (!signedXdr) {
      return res.status(400).json({ success: false, error: 'signedXdr is required' });
    }

    const result = await stellarProvider.submitSignedXdr(signedXdr);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    return res.status(502).json({ success: false, error: error.message || 'Horizon submission rejected' });
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
