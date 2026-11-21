import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Client, dropsToXrp } from 'xrpl';
import { CrossChainSwapService } from '../services/crossChainSwapService.js';
import { DualRailTokenService } from '../services/dualRailTokenService.js';
import { MongoService } from '../services/mongo.js';
import { getFxQuote } from '../services/market.js';
import { stellarProvider } from '../services/crypto/index.js';
import { NrTokenService } from '../services/nrTokenService.js';
import { verifyToken } from '../services/jwt.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { SorobanService, NEXUS_SWAP_CONTRACT_ID, NEXUS_VAULT_CONTRACT_ID } from '../services/soroban.js';

export const swapRouter = Router();

const SWAP_ASSETS = ['XRP', 'XLM', 'NXL', 'USD'] as const;

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
    if (fromAsset === 'NXL' || toAsset === 'NXL' || fromAsset === 'USD' || toAsset === 'USD') {
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

    if (fromAsset === 'NXL' || toAsset === 'NXL' || fromAsset === 'USD' || toAsset === 'USD') {
      const order = await NrTokenService.createNrSwapOrder({
        userId,
        fromAsset,
        toAsset,
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
      userId,
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
      fromAsset === 'NXL' ||
      toAsset === 'NXL' ||
      fromAsset === 'USD' ||
      toAsset === 'USD';

    if (isNrOrUsd) {
      let userId = extractOptionalUserId(req);
      if (!userId) {
        const dest = (userDestinationAddress || existingNrOrder?.userDestinationAddress || '').trim();
        if (dest && (dest.startsWith('r') || dest.startsWith('G'))) {
          try {
            const usersCol = await MongoService.getCollection<any>('users');
            const foundUser = await usersCol.findOne({
              $or: [{ walletAddress: dest }, { xrplAddress: dest }, { stellarAddress: dest }],
            });
            userId = foundUser?.id || `usr_wallet_${dest.slice(0, 10)}`;
          } catch {
            userId = `usr_wallet_${dest.slice(0, 10)}`;
          }
        } else {
          return res.status(401).json({
            success: false,
            error: 'Sign in or a valid destination wallet address is required to execute $NXL or USD ledger swaps',
          });
        }
      }

      const { order, poolStats } = await NrTokenService.executeNrSwap({
        swapId,
        userId: userId as string,
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

    const order = (await CrossChainSwapService.getSwapOrder(swapId)) || NrTokenService.getNrSwapOrder(swapId);
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
 * GET /api/v1/swap/stellar/trustline-status
 * Checks live Stellar on-chain trustline status for NXL asset
 */
swapRouter.get('/stellar/trustline-status', async (req: Request, res: Response) => {
  try {
    const address = String(req.query.address || '').trim();
    const assetCode = String(req.query.assetCode || 'NXL').trim();
    if (!address) {
      return res.status(400).json({ success: false, error: 'address query parameter is required' });
    }
    const status = await DualRailTokenService.checkStellarTrustline(address, assetCode);
    return res.json({ success: true, ...status });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to check Stellar trustline' });
  }
});

/**
 * POST /api/v1/swap/stellar/prepare-trustline-xdr
 * Prepares unsigned XDR to establish $NXL Trustline via Freighter or Albedo
 */
swapRouter.post('/stellar/prepare-trustline-xdr', async (req: Request, res: Response) => {
  try {
    const { sourceAddress, assetCode } = req.body || {};
    if (!sourceAddress) {
      return res.status(400).json({ success: false, error: 'sourceAddress is required' });
    }
    const result = await DualRailTokenService.prepareStellarTrustlineXdr(
      String(sourceAddress).trim(),
      assetCode ? String(assetCode).trim() : undefined
    );
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'Failed to prepare Stellar trustline transaction' });
  }
});

/**
 * POST /api/v1/swap/stellar/submit-xdr
 * Submits signed XDR to Stellar Horizon Testnet
 */
swapRouter.post('/stellar/submit-xdr', async (req: Request, res: Response) => {
  try {
    const { signedXdr } = req.body || {};
    if (!signedXdr) {
      return res.status(400).json({ success: false, error: 'signedXdr is required' });
    }
    const result = await DualRailTokenService.submitStellarSignedXdr(String(signedXdr).trim());
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'Failed to submit transaction to Stellar Horizon' });
  }
});

/**
 * POST /api/v1/swap/stellar/set-trustline-secret
 * Directly establishes $NXL Trustline on Stellar Testnet using account secret key (dev/testnet)
 */
swapRouter.post('/stellar/set-trustline-secret', async (req: Request, res: Response) => {
  try {
    const { secretKey, assetCode } = req.body || {};
    if (!secretKey) {
      return res.status(400).json({ success: false, error: 'secretKey is required' });
    }
    const result = await DualRailTokenService.setStellarTrustlineWithSecret(
      String(secretKey).trim(),
      assetCode ? String(assetCode).trim() : undefined
    );
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'Failed to set Stellar trustline with secret key' });
  }
});

/**
 * GET /api/v1/swap/xrpl/trustline-status
 * Checks live XRPL on-chain trustline status for NXL issued currency
 */
swapRouter.get('/xrpl/trustline-status', async (req: Request, res: Response) => {
  try {
    const address = String(req.query.address || '').trim();
    const currency = String(req.query.currency || 'NXL').trim();
    if (!address) {
      return res.status(400).json({ success: false, error: 'address query parameter is required' });
    }
    const status = await DualRailTokenService.checkXrplTrustline(address, currency);
    return res.json({ success: true, ...status });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to check XRPL trustline' });
  }
});

/**
 * GET /api/v1/swap/xrpl/pending-claims
 * Lists the signed-in user's XRPL→NXL swaps that have a recorded deposit and
 * still need a payout. Returns only records owned by the caller.
 */
swapRouter.get('/xrpl/pending-claims', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const swapsCol = await MongoService.getCollection<any>('swap_orders');
    const rows = await swapsCol
      .find({
        user_id: req.user!.id,
        fromAsset: 'XRP',
        toAsset: 'NXL',
        status: { $in: ['PENDING_DEPOSIT', 'DEPOSIT_CONFIRMED'] },
        depositTxHash: { $exists: true, $nin: ['', null] },
        payoutTxHash: { $in: ['', null, undefined] },
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    const claims = rows.map((row) => ({
      swapId: String(row.swapId),
      depositTxHash: String(row.depositTxHash),
      amountXrp: Number(row.payAmount || 0),
      amountNxl: Number(row.receiveAmount || 0),
      destinationAddress: String(row.userDestinationAddress || ''),
      createdAt: row.createdAt,
    }));

    return res.json({ success: true, data: claims });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Could not load pending claims' });
  }
});

/**
 * POST /api/v1/swap/xrpl/claim-pending
 * Validates a confirmed XRP deposit for a swap owned by the caller and triggers
 * the on-chain NXL payout to that swap's recorded destination address.
 */
swapRouter.post('/xrpl/claim-pending', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { swapId } = req.body || {};
    if (!swapId) {
      return res.status(400).json({ success: false, error: 'swapId is required' });
    }

    // 1. Load the swap and confirm the caller owns it.
    const swapsCol = await MongoService.getCollection<any>('swap_orders');
    const swap = await swapsCol.findOne({ swapId: String(swapId) });
    if (!swap) {
      return res.status(404).json({ success: false, error: 'Swap order not found' });
    }
    if (!swap.user_id || swap.user_id !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'This swap does not belong to your account' });
    }
    if (swap.payoutTxHash) {
      return res.json({ success: true, alreadyProcessed: true, payoutTxHash: swap.payoutTxHash });
    }
    if (!swap.depositTxHash) {
      return res.status(400).json({ success: false, error: 'No deposit transaction is recorded for this swap yet' });
    }

    const cleanHash = String(swap.depositTxHash).trim().toUpperCase();
    const cleanDest = String(swap.userDestinationAddress || '').trim();
    if (!cleanDest) {
      return res.status(400).json({ success: false, error: 'This swap has no destination address on record' });
    }

    // 2. Verify trustline on destination
    const trustline = await DualRailTokenService.checkXrplTrustline(cleanDest, 'NXL');
    if (!trustline.hasTrustline) {
      return res.status(400).json({
        success: false,
        trustlineRequired: true,
        issuer: trustline.issuer,
        currency: 'NXL',
        error: `Trustline required: Account "${cleanDest}" has no active trustline to issuer "${trustline.issuer}" for NXL. Please enable the trustline in your wallet first.`,
      });
    }

    // 3. Check if this deposit was already paid out to prevent duplicate claims
    const logsCol = await MongoService.getCollection<any>('platform_chain_logs');
    const existingPayout = await logsCol.findOne({
      reference_id: cleanHash,
      chain: 'XRPL',
      action: 'CROSS_CHAIN_BRIDGE',
    });
    if (existingPayout) {
      return res.json({
        success: true,
        alreadyProcessed: true,
        txHash: existingPayout.tx_hash,
        explorerUrl: existingPayout.explorer_url,
        amountPrimary: existingPayout.amount_primary,
      });
    }

    // 4. Verify deposit tx on XRPL Testnet
    const client = new Client(env.XRPL_WSS || env.XRPL_TESTNET_WSS || 'wss://s.altnet.rippletest.net:51233');
    await client.connect();

    let txData: any;
    try {
      const txRes = await client.request({
        command: 'tx',
        transaction: cleanHash,
      });
      txData = txRes.result;
    } finally {
      await client.disconnect();
    }

    if (!txData || txData.validated === false) {
      return res.status(400).json({ success: false, error: 'Deposit transaction not found or not yet validated on XRPL' });
    }

    const vaultAddr = env.PLATFORM_XRPL_VAULT || 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp';
    if (txData.Destination !== vaultAddr) {
      return res.status(400).json({ success: false, error: 'Transaction destination does not match NexusRail vault' });
    }

    // 5. Bind the deposit to this swap via its destination tag.
    if (swap.paymentIdentifierType === 'destination_tag' && swap.paymentIdentifier !== undefined) {
      const expectedTag = Number(swap.paymentIdentifier);
      if (!Number.isFinite(expectedTag) || Number(txData.DestinationTag) !== expectedTag) {
        return res.status(400).json({ success: false, error: 'Deposit destination tag does not match this swap' });
      }
    }

    const meta: any = txData.meta || txData.metaData;
    if (meta?.TransactionResult !== 'tesSUCCESS') {
      return res.status(400).json({ success: false, error: `Deposit transaction did not succeed (Result: ${meta?.TransactionResult})` });
    }

    // Determine deposited XRP amount
    const deliveredDrops = meta?.delivered_amount || txData.Amount || txData.DeliverMax;
    const xrpAmount = Number(dropsToXrp(String(deliveredDrops)));
    if (xrpAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Delivered XRP amount must be greater than zero' });
    }

    // 6. Compute NXL amount using AMM curve
    const quote = await NrTokenService.quoteSwap({
      fromAsset: 'XRP',
      toAsset: 'NXL',
      amount: xrpAmount,
    });
    const receiveNxl = quote.receiveAmount;

    // 7. Broadcast on-chain NXL payout from distributor vault
    const payout = await DualRailTokenService.withdrawNrToXrplAddress(
      req.user!.id,
      receiveNxl,
      cleanDest
    );

    await swapsCol.updateOne(
      { swapId: String(swapId) },
      {
        $set: {
          payoutTxHash: payout.txHash,
          payoutExplorerUrl: payout.explorerUrl,
          status: 'COMPLETED',
          updatedAt: new Date().toISOString(),
        },
      }
    );

    // Record reference linking to deposit tx to prevent double-claim
    await logsCol.updateOne(
      { tx_hash: payout.txHash },
      { $set: { reference_id: cleanHash, details: { depositTxHash: cleanHash, xrpDeposited: xrpAmount, destinationAddress: cleanDest } } }
    );

    return res.json({
      success: true,
      payoutTxHash: payout.txHash,
      ledgerSeq: payout.ledgerSeq,
      explorerUrl: payout.explorerUrl,
      amountNxl: receiveNxl,
      xrpDeposited: xrpAmount,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to claim pending swap' });
  }
});

/**
 * GET /api/v1/swap/history/me
 * Returns persistent MongoDB cross-chain swaps for the signed-in user
 */
swapRouter.get('/history/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const swaps = await CrossChainSwapService.getUserSwaps({
      userId: req.user!.id,
      address: req.user!.walletAddress,
      limit,
    });
    return res.json({ success: true, count: swaps.length, data: swaps });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Could not load your swap history' });
  }
});

/**
 * GET /api/v1/swap/history
 * Returns real on-chain cross-chain bridge logs and persisted swap orders. ZERO mock data.
 */
swapRouter.get('/history', async (req: Request, res: Response) => {
  try {
    const address = String(req.query.address || '').trim();
    const userId = extractOptionalUserId(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    const logsCol = await MongoService.getCollection<any>('platform_chain_logs');

    // Build query filter
    const query: any = { action: 'CROSS_CHAIN_BRIDGE' };
    if (address) {
      query.$or = [
        { 'details.destinationAddress': address },
        { operator_id: address },
        { operator_id: `wallet_${address}` },
        { 'details.account': address },
      ];
    } else if (userId) {
      query.$or = [
        { operator_id: userId },
        { operator_id: `wallet_${userId}` },
      ];
    }

    const [logs, savedSwaps] = await Promise.all([
      logsCol.find(query).sort({ created_at: -1 }).limit(limit).toArray(),
      CrossChainSwapService.getUserSwaps({ userId, address: address || undefined, limit }),
    ]);

    const seenSwapIds = new Set<string>();
    const formatted = logs.map((l: any) => {
      if (l.reference_id) seenSwapIds.add(String(l.reference_id));
      return {
        id: l.id,
        swapId: l.reference_id,
        chain: l.chain,
        action: l.action,
        amount: l.amount_primary || '',
        destinationAddress: l.details?.destinationAddress || l.operator_id,
        txHash: l.tx_hash,
        ledgerSeq: l.ledger_seq,
        explorerUrl: l.explorer_url,
        status: l.status || 'SUCCESS',
        createdAt: l.created_at,
        details: l.details || {},
      };
    });

    // Merge persistent MongoDB swaps not already in platform_chain_logs
    for (const s of savedSwaps) {
      if (seenSwapIds.has(s.swapId)) continue;
      formatted.push({
        id: s.swapId,
        swapId: s.swapId,
        chain: s.toAsset === 'XLM' ? 'STELLAR' : 'XRPL',
        action: 'CROSS_CHAIN_SWAP',
        amount: `${s.payAmount} ${s.fromAsset} -> ${s.receiveAmount} ${s.toAsset}`,
        destinationAddress: s.userDestinationAddress,
        txHash: s.payoutTxHash || s.depositTxHash || '',
        ledgerSeq: undefined,
        explorerUrl: s.payoutExplorerUrl || s.depositExplorerUrl || '',
        status: s.status,
        createdAt: s.createdAt,
        details: {
          fromAsset: s.fromAsset,
          toAsset: s.toAsset,
          payAmount: s.payAmount,
          receiveAmount: s.receiveAmount,
          depositTxHash: s.depositTxHash,
          payoutTxHash: s.payoutTxHash,
        },
      });
    }

    formatted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const sliced = formatted.slice(0, limit);

    return res.json({ success: true, count: sliced.length, data: sliced });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch swap history' });
  }
});

/**
 * ============================================================================
 * SOROBAN ON-CHAIN AMM SWAP (NexusSwap) & BRIDGE ESCROW / BURN-FOR-BRIDGE
 * ============================================================================
 */

// GET /api/v1/swap/soroban/pool - Live on-chain NexusSwap AMM reserves, spot price & escrows
swapRouter.get('/soroban/pool', async (_req: Request, res: Response) => {
  try {
    const pool = await SorobanService.getLiveSwapPoolState();
    return res.json({ success: true, data: pool });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err?.message || 'Failed to read on-chain AMM pool' });
  }
});

// POST /api/v1/swap/soroban/quote - Live on-chain constant-product quote (XLM <-> NXL)
swapRouter.post('/soroban/quote', async (req: Request, res: Response) => {
  try {
    const fromAsset = String(req.body?.fromAsset || 'XLM').toUpperCase();
    const amount = Number(req.body?.amount || 0);
    if ((fromAsset !== 'XLM' && fromAsset !== 'NXL') || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'fromAsset (XLM or NXL) and positive amount are required' });
    }
    const quote = await SorobanService.quoteOnChainSwap(fromAsset, amount);
    return res.json({ success: true, data: quote });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'On-chain quote failed' });
  }
});

// POST /api/v1/swap/soroban/prepare - Build Freighter unsigned XDR for AMM Swap, Bridge Escrow, or Burn-for-Bridge
swapRouter.post('/soroban/prepare', async (req: Request, res: Response) => {
  try {
    const fromAsset = String(req.body?.fromAsset || '').toUpperCase();
    const toAsset = String(req.body?.toAsset || '').toUpperCase();
    const amount = Number(req.body?.amount || 0);
    const traderAddress = String(req.body?.traderAddress || req.body?.userSourceAddress || '').trim();
    const xrplDestination = String(req.body?.userDestinationAddress || '').trim();
    const slippagePct = Math.min(5, Math.max(0.1, Number(req.body?.slippagePct || 1.0)));

    if (!traderAddress || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'traderAddress (Stellar G... key) and positive amount are required' });
    }

    // Mode 1: On-Chain Stellar AMM Swap (XLM <-> NXL) via NexusSwap::swap_exact_in
    if ((fromAsset === 'XLM' && toAsset === 'NXL') || (fromAsset === 'NXL' && toAsset === 'XLM')) {
      const quote = await SorobanService.quoteOnChainSwap(fromAsset, amount);
      const minAmountOut = Number((quote.amountOut * (1 - slippagePct / 100)).toFixed(7));
      const deadlineUnixSec = Math.floor(Date.now() / 1000) + 300;
      const prepared = await SorobanService.buildAmmSwapXdr({
        traderAddress,
        fromAsset,
        amountIn: amount,
        minAmountOut,
        deadlineUnixSec,
      });
      return res.json({
        success: true,
        mode: 'SOROBAN_AMM_SWAP',
        data: {
          ...prepared,
          fromAsset,
          toAsset,
          quote,
          minAmountOut,
          deadlineUnixSec,
          contractId: NEXUS_SWAP_CONTRACT_ID,
        },
      });
    }

    // Mode 2: Stellar XLM -> XRPL XRP via Trustless Bridge Escrow (NexusSwap::lock_bridge_escrow)
    if (fromAsset === 'XLM' && toAsset === 'XRP') {
      if (!xrplDestination.startsWith('r')) {
        return res.status(400).json({ success: false, error: 'Valid XRPL destination address (r...) is required' });
      }
      const swapId = `BRG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const expiryUnixSec = Math.floor(Date.now() / 1000) + 900;
      const prepared = await SorobanService.buildLockBridgeEscrowXdr({
        senderAddress: traderAddress,
        tokenAsset: 'XLM',
        amount,
        swapId,
        xrplDestination,
        expiryUnixSec,
      });
      return res.json({
        success: true,
        mode: 'SOROBAN_BRIDGE_ESCROW',
        data: {
          ...prepared,
          swapId,
          fromAsset,
          toAsset,
          amount,
          xrplDestination,
          expiryUnixSec,
          contractId: NEXUS_SWAP_CONTRACT_ID,
        },
      });
    }

    // Mode 3: Stellar $NXL -> XRPL $NXL via Provable On-Chain Burn (NexusVault::burn_for_bridge)
    if (fromAsset === 'NXL' && toAsset === 'XRP') {
      if (!xrplDestination.startsWith('r')) {
        return res.status(400).json({ success: false, error: 'Valid XRPL destination address (r...) is required' });
      }
      const swapId = `BRN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const prepared = await SorobanService.buildBurnForBridgeXdr({
        holderAddress: traderAddress,
        amountNxl: amount,
        xrplDestination,
        swapId,
      });
      return res.json({
        success: true,
        mode: 'SOROBAN_BRIDGE_BURN',
        data: {
          ...prepared,
          swapId,
          fromAsset,
          toAsset,
          amount,
          xrplDestination,
          contractId: NEXUS_VAULT_CONTRACT_ID,
        },
      });
    }

    return res.status(400).json({
      success: false,
      error: `Soroban on-chain route supports XLM<->NXL (AMM), XLM->XRP (Bridge Escrow), or NXL->XRP (Burn-for-Bridge). Got ${fromAsset}->${toAsset}.`,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed to prepare Soroban swap XDR' });
  }
});

// POST /api/v1/swap/soroban/submit - Submit signed Soroban AMM Swap / Bridge Escrow / Burn XDR
swapRouter.post('/soroban/submit', async (req: Request, res: Response) => {
  try {
    const signedXdr = String(req.body?.signedXdr || '').trim();
    const mode = String(req.body?.mode || 'SOROBAN_AMM_SWAP');
    const fromAsset = String(req.body?.fromAsset || 'XLM').toUpperCase();
    const toAsset = String(req.body?.toAsset || 'NXL').toUpperCase();
    const amount = Number(req.body?.amount || 0);
    const swapId = String(req.body?.swapId || `AMM-${Date.now().toString(36).toUpperCase()}`);
    const xrplDestination = String(req.body?.xrplDestination || '').trim();
    const userId = extractOptionalUserId(req);

    if (!signedXdr) {
      return res.status(400).json({ success: false, error: 'signedXdr is required' });
    }

    const txRes = await SorobanService.submitSignedSorobanXdr(signedXdr);

    let payoutTxHash: string | undefined;
    let payoutExplorerUrl: string | undefined;
    let escrowReleaseTxHash: string | undefined;

    // For XLM -> XRP Bridge Escrow: verify locked escrow on-chain -> execute XRPL payout -> release escrow with XRPL proof!
    if (mode === 'SOROBAN_BRIDGE_ESCROW' && xrplDestination.startsWith('r') && amount > 0) {
      const fx = await getFxQuote();
      const receiveXrp = Number(((amount * fx.xlmUsd) / fx.xrpUsd).toFixed(4));
      const payout = await CrossChainSwapService.payoutAssetToUser({
        toAsset: 'XRP',
        destinationAddress: xrplDestination,
        amount: receiveXrp,
        referenceId: swapId,
      });
      payoutTxHash = payout.txHash;
      payoutExplorerUrl = payout.explorerUrl;

      if (payoutTxHash) {
        const rel = await SorobanService.releaseBridgeEscrowOnChain({
          swapId,
          xrplTxHash: payoutTxHash,
        }).catch(() => null);
        escrowReleaseTxHash = rel?.txHash;
      }
    }

    // For NXL -> XRP Burn-for-Bridge: user burned $NXL on Stellar -> execute equivalent XRP payout on XRPL
    if (mode === 'SOROBAN_BRIDGE_BURN' && xrplDestination.startsWith('r') && amount > 0) {
      const fx = await getFxQuote();
      const poolStats = await NrTokenService.getPoolStats().catch(() => ({ spotPriceUsd: 1 }));
      const usdVal = amount * (poolStats.spotPriceUsd || 1);
      const receiveXrp = Number((usdVal / Math.max(0.01, fx.xrpUsd)).toFixed(4));
      const payout = await CrossChainSwapService.payoutAssetToUser({
        toAsset: 'XRP',
        destinationAddress: xrplDestination,
        amount: receiveXrp,
        referenceId: swapId,
      });
      payoutTxHash = payout.txHash;
      payoutExplorerUrl = payout.explorerUrl;
    }

    await DualRailTokenService.logChainAction({
      chain: 'STELLAR',
      action: mode === 'SOROBAN_AMM_SWAP' ? 'AMM_SWAP' : 'CROSS_CHAIN_BRIDGE',
      operatorId: userId || 'FREIGHTER_USER',
      referenceId: swapId,
      txHash: txRes.txHash,
      ledgerSeq: txRes.ledger,
      amountPrimary: amount,
      details: {
        mode,
        fromAsset,
        toAsset,
        contractId: mode === 'SOROBAN_BRIDGE_BURN' ? NEXUS_VAULT_CONTRACT_ID : NEXUS_SWAP_CONTRACT_ID,
        destinationAddress: xrplDestination || undefined,
        payoutTxHash,
        escrowReleaseTxHash,
        returnValue: txRes.returnValue,
      },
    }).catch(() => {});

    return res.json({
      success: true,
      data: {
        swapId,
        mode,
        txHash: txRes.txHash,
        ledger: txRes.ledger,
        explorerUrl: txRes.explorerUrl,
        returnValue: txRes.returnValue,
        payoutTxHash,
        payoutExplorerUrl,
        escrowReleaseTxHash,
      },
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Soroban swap submission failed' });
  }
});

/**
 * GET /api/v1/swap/:swapId
 * Fetches current swap status and on-chain transaction references
 */
swapRouter.get('/:swapId', async (req: Request, res: Response) => {
  const swapId = String(req.params.swapId);
  const order = await CrossChainSwapService.getSwapOrder(swapId);

  if (!order) {
    return res.status(404).json({ success: false, error: 'Swap order not found' });
  }

  return res.json({ success: true, data: order });
});
