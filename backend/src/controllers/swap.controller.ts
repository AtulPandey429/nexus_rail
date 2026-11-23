import { Request, Response } from 'express';
import { z } from 'zod';
import { Client, dropsToXrp } from 'xrpl';
import { CrossChainSwapService } from '../services/crossChainSwap.service.js';
import { DualRailTokenService } from '../services/dualRailToken.service.js';
import { MongoService } from '../services/mongo.js';
import { getFxQuote } from '../services/market.js';
import { stellarProvider } from '../services/crypto/index.js';
import { NrTokenService } from '../services/nrToken.service.js';
import { verifyToken } from '../services/jwt.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { SorobanService, NEXUS_SWAP_CONTRACT_ID, NEXUS_VAULT_CONTRACT_ID } from '../services/soroban.js';
import { STELLAR_TESTNET, XRPL_TESTNET } from '../utils/constants.js';

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

export class SwapController {
  /**
   * GET /api/v1/swap/nr-pool
   */
  static async getNrPool(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await NrTokenService.getPoolStats();
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to load NR pool stats' });
    }
  }

  /**
   * POST /api/v1/swap/quote
   */
  static async getQuote(req: Request, res: Response): Promise<void> {
    try {
      const { fromAsset = 'XRP', toAsset = 'XLM', amount = 100 } = req.body || {};
      if (fromAsset === 'NXL' || toAsset === 'NXL' || fromAsset === 'USD' || toAsset === 'USD') {
        const q = await NrTokenService.quoteSwap({ fromAsset, toAsset, amount: Number(amount) || 100 });
        res.json({
          success: true,
          ...q,
          amount: q.payAmount,
        });
        return;
      }

      const fx = await getFxQuote();
      const fromUsd = fromAsset === 'XRP' ? fx.xrpUsd : fx.xlmUsd;
      const toUsd = toAsset === 'XLM' ? fx.xlmUsd : fx.xrpUsd;
      const rate = fromUsd / toUsd;
      const receiveAmount = Number(((amount || 100) * rate).toFixed(4));

      res.json({
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
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/swap/initiate
   */
  static async initiateSwap(req: Request, res: Response): Promise<void> {
    try {
      const parsed = initiateSwapSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid swap request parameters',
          details: parsed.error.format(),
        });
        return;
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
        res.json({ success: true, data: order });
        return;
      }

      if (!userDestinationAddress || userDestinationAddress.length < 10) {
        res.status(400).json({
          success: false,
          error: 'Valid destination address is required for cross-chain swaps',
        });
        return;
      }

      const order = await CrossChainSwapService.createSwapOrder({
        userId,
        fromAsset,
        toAsset,
        amount,
        userDestinationAddress,
        userSourceAddress,
      });

      res.json({
        success: true,
        data: order,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/swap/execute
   */
  static async executeSwap(req: Request, res: Response): Promise<void> {
    try {
      const parsed = executeSwapSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid execution parameters',
          details: parsed.error.format(),
        });
        return;
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
            res.status(401).json({
              success: false,
              error: 'Sign in or a valid destination wallet address is required to execute $NXL or USD ledger swaps',
            });
            return;
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

        res.json({
          success: true,
          data: order,
          poolStats,
        });
        return;
      }

      if (!swapId) {
        res.status(400).json({ success: false, error: 'swapId is required' });
        return;
      }

      const result = await CrossChainSwapService.executeSwap({
        swapId,
        depositTxHash,
        userSourceSecret,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      const status = err.message?.includes('Insufficient') ? 400 : 500;
      res.status(status).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/swap/stellar/prepare-xdr
   */
  static async prepareStellarXdr(req: Request, res: Response): Promise<void> {
    try {
      const { swapId, sourcePublicKey } = req.body || {};
      if (!swapId || !sourcePublicKey) {
        res.status(400).json({ success: false, error: 'swapId and sourcePublicKey are required' });
        return;
      }

      const order = (await CrossChainSwapService.getSwapOrder(swapId)) || NrTokenService.getNrSwapOrder(swapId);
      if (!order) {
        res.status(404).json({ success: false, error: 'Swap order not found or expired' });
        return;
      }

      if (order.fromAsset !== 'XLM') {
        res.status(400).json({ success: false, error: 'Source asset is not XLM for this swap order' });
        return;
      }

      const memoText = String(order.paymentIdentifier);
      const xdr = await stellarProvider.buildPaymentXdr(
        sourcePublicKey,
        order.payAmount,
        memoText
      );

      res.json({
        success: true,
        xdr,
        destination: order.platformDepositAddress,
        amountXlm: order.payAmount,
        memo: memoText,
        networkPassphrase: STELLAR_TESTNET.networkPassphrase,
      });
    } catch (error: any) {
      res.status(502).json({ success: false, error: error.message || 'Failed to prepare Stellar XDR' });
    }
  }

  /**
   * POST /api/v1/swap/stellar/submit-xdr
   */
  static async submitStellarXdr(req: Request, res: Response): Promise<void> {
    try {
      const { signedXdr } = req.body || {};
      if (!signedXdr) {
        res.status(400).json({ success: false, error: 'signedXdr is required' });
        return;
      }

      const result = await stellarProvider.submitSignedXdr(signedXdr);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(502).json({ success: false, error: error.message || 'Horizon submission rejected' });
    }
  }

  /**
   * GET /api/v1/swap/stellar/trustline-status
   */
  static async getStellarTrustlineStatus(req: Request, res: Response): Promise<void> {
    try {
      const address = String(req.query.address || '').trim();
      const assetCode = String(req.query.assetCode || 'NXL').trim();
      if (!address) {
        res.status(400).json({ success: false, error: 'address query parameter is required' });
        return;
      }
      const status = await DualRailTokenService.checkStellarTrustline(address, assetCode);
      res.json({ success: true, ...status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to check Stellar trustline' });
    }
  }

  /**
   * POST /api/v1/swap/stellar/prepare-trustline-xdr
   */
  static async prepareStellarTrustlineXdr(req: Request, res: Response): Promise<void> {
    try {
      const { sourceAddress, assetCode } = req.body || {};
      if (!sourceAddress) {
        res.status(400).json({ success: false, error: 'sourceAddress is required' });
        return;
      }
      const result = await DualRailTokenService.prepareStellarTrustlineXdr(
        String(sourceAddress).trim(),
        assetCode ? String(assetCode).trim() : undefined
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to prepare Stellar trustline transaction' });
    }
  }

  /**
   * POST /api/v1/swap/stellar/set-trustline-secret
   */
  static async setStellarTrustlineSecret(req: Request, res: Response): Promise<void> {
    try {
      const { secretKey, assetCode } = req.body || {};
      if (!secretKey) {
        res.status(400).json({ success: false, error: 'secretKey is required' });
        return;
      }
      const result = await DualRailTokenService.setStellarTrustlineWithSecret(
        String(secretKey).trim(),
        assetCode ? String(assetCode).trim() : undefined
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to set Stellar trustline with secret key' });
    }
  }

  /**
   * GET /api/v1/swap/xrpl/trustline-status
   */
  static async getXrplTrustlineStatus(req: Request, res: Response): Promise<void> {
    try {
      const address = String(req.query.address || '').trim();
      const currency = String(req.query.currency || 'NXL').trim();
      if (!address) {
        res.status(400).json({ success: false, error: 'address query parameter is required' });
        return;
      }
      const status = await DualRailTokenService.checkXrplTrustline(address, currency);
      res.json({ success: true, ...status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to check XRPL trustline' });
    }
  }

  /**
   * GET /api/v1/swap/xrpl/pending-claims
   */
  static async getXrplPendingClaims(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      res.json({ success: true, data: claims });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Could not load pending claims' });
    }
  }

  /**
   * POST /api/v1/swap/xrpl/claim-pending
   */
  static async claimXrplPending(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { swapId } = req.body || {};
      if (!swapId) {
        res.status(400).json({ success: false, error: 'swapId is required' });
        return;
      }

      const swapsCol = await MongoService.getCollection<any>('swap_orders');
      const swap = await swapsCol.findOne({ swapId: String(swapId) });
      if (!swap) {
        res.status(404).json({ success: false, error: 'Swap order not found' });
        return;
      }
      if (!swap.user_id || swap.user_id !== req.user!.id) {
        res.status(403).json({ success: false, error: 'This swap does not belong to your account' });
        return;
      }
      if (swap.payoutTxHash) {
        res.json({ success: true, alreadyProcessed: true, payoutTxHash: swap.payoutTxHash });
        return;
      }
      if (!swap.depositTxHash) {
        res.status(400).json({ success: false, error: 'No deposit transaction is recorded for this swap yet' });
        return;
      }

      const cleanHash = String(swap.depositTxHash).trim().toUpperCase();
      const cleanDest = String(swap.userDestinationAddress || '').trim();
      if (!cleanDest) {
        res.status(400).json({ success: false, error: 'This swap has no destination address on record' });
        return;
      }

      const trustline = await DualRailTokenService.checkXrplTrustline(cleanDest, 'NXL');
      if (!trustline.hasTrustline) {
        res.status(400).json({
          success: false,
          trustlineRequired: true,
          issuer: trustline.issuer,
          currency: 'NXL',
          error: `Trustline required: Account "${cleanDest}" has no active trustline to issuer "${trustline.issuer}" for NXL. Please enable the trustline in your wallet first.`,
        });
        return;
      }

      const logsCol = await MongoService.getCollection<any>('platform_chain_logs');
      const existingPayout = await logsCol.findOne({
        reference_id: cleanHash,
        chain: 'XRPL',
        action: 'CROSS_CHAIN_BRIDGE',
      });
      if (existingPayout) {
        res.json({
          success: true,
          alreadyProcessed: true,
          txHash: existingPayout.tx_hash,
          explorerUrl: existingPayout.explorer_url,
          amountPrimary: existingPayout.amount_primary,
        });
        return;
      }

      const client = new Client(env.XRPL_WSS || env.XRPL_TESTNET_WSS || XRPL_TESTNET.wss);
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
        res.status(400).json({ success: false, error: 'Deposit transaction not found or not yet validated on XRPL' });
        return;
      }

      const vaultAddr = env.PLATFORM_XRPL_VAULT || XRPL_TESTNET.merchantVault;
      if (txData.Destination !== vaultAddr) {
        res.status(400).json({ success: false, error: 'Transaction destination does not match NexusRail vault' });
        return;
      }

      if (swap.paymentIdentifierType === 'destination_tag' && swap.paymentIdentifier !== undefined) {
        const expectedTag = Number(swap.paymentIdentifier);
        if (!Number.isFinite(expectedTag) || Number(txData.DestinationTag) !== expectedTag) {
          res.status(400).json({ success: false, error: 'Deposit destination tag does not match this swap' });
          return;
        }
      }

      const meta: any = txData.meta || txData.metaData;
      if (meta?.TransactionResult !== 'tesSUCCESS') {
        res.status(400).json({ success: false, error: `Deposit transaction did not succeed (Result: ${meta?.TransactionResult})` });
        return;
      }

      const deliveredDrops = meta?.delivered_amount || txData.Amount || txData.DeliverMax;
      const xrpAmount = Number(dropsToXrp(String(deliveredDrops)));
      if (xrpAmount <= 0) {
        res.status(400).json({ success: false, error: 'Delivered XRP amount must be greater than zero' });
        return;
      }

      const quote = await NrTokenService.quoteSwap({
        fromAsset: 'XRP',
        toAsset: 'NXL',
        amount: xrpAmount,
      });
      const receiveNxl = quote.receiveAmount;

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

      await logsCol.updateOne(
        { tx_hash: payout.txHash },
        { $set: { reference_id: cleanHash, details: { depositTxHash: cleanHash, xrpDeposited: xrpAmount, destinationAddress: cleanDest } } }
      );

      res.json({
        success: true,
        payoutTxHash: payout.txHash,
        ledgerSeq: payout.ledgerSeq,
        explorerUrl: payout.explorerUrl,
        amountNxl: receiveNxl,
        xrpDeposited: xrpAmount,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to claim pending swap' });
    }
  }

  /**
   * GET /api/v1/swap/history/me
   */
  static async getMyHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
      const swaps = await CrossChainSwapService.getUserSwaps({
        userId: req.user!.id,
        address: req.user!.walletAddress,
        limit,
      });
      res.json({ success: true, count: swaps.length, data: swaps });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Could not load your swap history' });
    }
  }

  /**
   * GET /api/v1/swap/history
   */
  static async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const address = String(req.query.address || '').trim();
      const userId = extractOptionalUserId(req);
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

      const logsCol = await MongoService.getCollection<any>('platform_chain_logs');

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

      res.json({ success: true, count: sliced.length, data: sliced });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch swap history' });
    }
  }

  /**
   * GET /api/v1/swap/soroban/pool
   */
  static async getSorobanPool(_req: Request, res: Response): Promise<void> {
    try {
      const pool = await SorobanService.getLiveSwapPoolState();
      res.json({ success: true, data: pool });
    } catch (err: any) {
      res.status(502).json({ success: false, error: err?.message || 'Failed to read on-chain AMM pool' });
    }
  }

  /**
   * POST /api/v1/swap/soroban/quote
   */
  static async getSorobanQuote(req: Request, res: Response): Promise<void> {
    try {
      const fromAsset = String(req.body?.fromAsset || 'XLM').toUpperCase();
      const amount = Number(req.body?.amount || 0);
      if ((fromAsset !== 'XLM' && fromAsset !== 'NXL') || !Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ success: false, error: 'fromAsset (XLM or NXL) and positive amount are required' });
        return;
      }
      const quote = await SorobanService.quoteOnChainSwap(fromAsset, amount);
      res.json({ success: true, data: quote });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'On-chain quote failed' });
    }
  }

  /**
   * POST /api/v1/swap/soroban/prepare
   */
  static async prepareSorobanSwap(req: Request, res: Response): Promise<void> {
    try {
      const fromAsset = String(req.body?.fromAsset || '').toUpperCase();
      const toAsset = String(req.body?.toAsset || '').toUpperCase();
      const amount = Number(req.body?.amount || 0);
      const traderAddress = String(req.body?.traderAddress || req.body?.userSourceAddress || '').trim();
      const xrplDestination = String(req.body?.userDestinationAddress || '').trim();
      const slippagePct = Math.min(5, Math.max(0.1, Number(req.body?.slippagePct || 1.0)));

      if (!traderAddress || !Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ success: false, error: 'traderAddress (Stellar G... key) and positive amount are required' });
        return;
      }

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
        res.json({
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
        return;
      }

      if (fromAsset === 'XLM' && toAsset === 'XRP') {
        if (!xrplDestination.startsWith('r')) {
          res.status(400).json({ success: false, error: 'Valid XRPL destination address (r...) is required' });
          return;
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
        res.json({
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
        return;
      }

      if (fromAsset === 'NXL' && toAsset === 'XRP') {
        if (!xrplDestination.startsWith('r')) {
          res.status(400).json({ success: false, error: 'Valid XRPL destination address (r...) is required' });
          return;
        }
        const swapId = `BRN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const prepared = await SorobanService.buildBurnForBridgeXdr({
          holderAddress: traderAddress,
          amountNxl: amount,
          xrplDestination,
          swapId,
        });
        res.json({
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
        return;
      }

      res.status(400).json({
        success: false,
        error: `Soroban on-chain route supports XLM<->NXL (AMM), XLM->XRP (Bridge Escrow), or NXL->XRP (Burn-for-Bridge). Got ${fromAsset}->${toAsset}.`,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Failed to prepare Soroban swap XDR' });
    }
  }

  /**
   * POST /api/v1/swap/soroban/submit
   */
  static async submitSorobanSwap(req: Request, res: Response): Promise<void> {
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
        res.status(400).json({ success: false, error: 'signedXdr is required' });
        return;
      }

      const txRes = await SorobanService.submitSignedSorobanXdr(signedXdr);

      let payoutTxHash: string | undefined;
      let payoutExplorerUrl: string | undefined;
      let escrowReleaseTxHash: string | undefined;

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

      res.json({
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
      res.status(400).json({ success: false, error: err?.message || 'Soroban swap submission failed' });
    }
  }

  /**
   * GET /api/v1/swap/:swapId
   */
  static async getSwapById(req: Request, res: Response): Promise<void> {
    const swapId = String(req.params.swapId);
    const order = await CrossChainSwapService.getSwapOrder(swapId);

    if (!order) {
      res.status(404).json({ success: false, error: 'Swap order not found' });
      return;
    }

    res.json({ success: true, data: order });
  }
}
