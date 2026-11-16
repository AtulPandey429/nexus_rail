import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CrossChainSwapService } from '../services/crossChainSwapService.js';
import { getFxQuote } from '../services/market.js';
import { stellarProvider } from '../services/crypto/index.js';
import { NrTokenService } from '../services/nrTokenService.js';
import { verifyToken } from '../services/jwt.js';

export const swapRouter = Router();

const SWAP_ASSETS = ['XRP', 'XLM', 'NR', 'NXL', 'USD'] as const;

const initiateSwapSchema = z.object({
  fromAsset: z.enum(SWAP_ASSETS),
  toAsset: z.enum(SWAP_ASSETS),
  amount: z.number().positive(),
  userDestinationAddress: z.string().optional().default(''),
  userSourceAddress: z.string().optional(),
});

const executeSwapSchema = z.object({
  swapId: z.string().optional(),
  fromAsset: z.enum(SWAP_ASSETS).optional(),
  toAsset: z.enum(SWAP_ASSETS).optional(),
  amount: z.number().positive().optional(),
  userDestinationAddress: z.string().optional(),
  depositTxHash: z.string().optional(),
  userSourceSecret: z.string().optional(),
});

function extractOptionalUserId(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  try {
    return verifyToken(authHeader.slice('Bearer '.length).trim()).id;
  } catch {
    return undefined;
  }
}

/**
 * GET /api/v1/swap/nr-pool
 * Returns live $NR AMM pool telemetry, spot price, reserve backing, and 24h history ticks
 */
swapRouter.get('/nr-pool', async (_req: Request, res: Response) => {
  try {
    const stats = await NrTokenService.getPoolStats();
    return res.json({ success: true, data: stats });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to load NR pool stats' });
  }
});

/**
 * POST /api/v1/swap/quote
 * Returns live swap quote, exchange rate, AMM impact, and estimated received amount
 */
swapRouter.post('/quote', async (req: Request, res: Response) => {
  try {
    const { fromAsset = 'XRP', toAsset = 'XLM', amount = 100 } = req.body || {};
    if (fromAsset === 'NR' || fromAsset === 'NXL' || toAsset === 'NR' || toAsset === 'NXL' || fromAsset === 'USD' || toAsset === 'USD') {
      const q = await NrTokenService.quoteSwap({ fromAsset, toAsset, amount: Number(amount) || 100 });
      return res.json({
        success: true,
        ...q,
        amount: q.payAmount,
      });
    }

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
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/swap/initiate
 * Initiates an authoritative cross-chain or $NR AMM escrow swap order
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

    const { fromAsset, toAsset, amount, userDestinationAddress, userSourceAddress } = parsed.data;
    const userId = extractOptionalUserId(req);

    if (fromAsset === 'NR' || fromAsset === 'NXL' || toAsset === 'NR' || toAsset === 'NXL' || fromAsset === 'USD' || toAsset === 'USD') {
      const order = await NrTokenService.createNrSwapOrder({
        userId,
        fromAsset: fromAsset === 'NXL' ? 'NR' : fromAsset,
        toAsset: toAsset === 'NXL' ? 'NR' : toAsset,
        amount,
        userDestinationAddress,
      });
      return res.json({ success: true, data: order });
    }

    if (!userDestinationAddress || userDestinationAddress.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Valid destination address is required for cross-chain swaps',
      });
    }

    const order = await CrossChainSwapService.createSwapOrder({
      fromAsset,
      toAsset,
      amount,
      userDestinationAddress,
      userSourceAddress,
    });

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
 * Confirms the user's deposit and executes either $NR AMM settlement or cross-chain hot wallet payout
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

    const { swapId, fromAsset, toAsset, amount, userDestinationAddress, depositTxHash, userSourceSecret } = parsed.data;
    const existingNrOrder = swapId ? NrTokenService.getNrSwapOrder(swapId) : undefined;
    const isNrOrUsd =
      Boolean(existingNrOrder) ||
      fromAsset === 'NR' ||
      fromAsset === 'NXL' ||
      toAsset === 'NR' ||
      toAsset === 'NXL' ||
      fromAsset === 'USD' ||
      toAsset === 'USD';

    if (isNrOrUsd) {
      const userId = extractOptionalUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Sign in is required to execute $NR or USD ledger swaps',
        });
      }

      const { order, poolStats } = await NrTokenService.executeNrSwap({
        swapId,
        userId,
        fromAsset,
        toAsset,
        amount,
        depositTxHash,
        userDestinationAddress,
      });

      return res.json({
        success: true,
        data: order,
        poolStats,
      });
    }

    if (!swapId) {
      return res.status(400).json({ success: false, error: 'swapId is required' });
    }

    const result = await CrossChainSwapService.executeSwap({
      swapId,
      depositTxHash,
      userSourceSecret,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    const status = err.message?.includes('Insufficient') ? 400 : 500;
    return res.status(status).json({ success: false, error: err.message });
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

    const order = CrossChainSwapService.getSwapOrder(swapId) || NrTokenService.getNrSwapOrder(swapId);
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
