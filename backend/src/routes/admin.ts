import crypto from 'crypto';
import { Router, Response } from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import {
  MongoService,
  MongoChainActionLogDoc,
  MongoOrderDoc,
  MongoPlatformTokenDoc,
} from '../services/mongo.js';
import { ProductService } from '../services/products.js';
import { NrTokenService } from '../services/nrTokenService.js';
import { RedisCacheService } from '../services/redis.js';
import { PortfolioService } from '../services/portfolioService.js';
import { TreasuryService } from '../services/treasuryService.js';
import { SorobanService } from '../services/soroban.js';
import { StellarTokenIssuerService } from '../scripts/deployStellarNrToken.js';
import { DualRailTokenService } from '../services/dualRailTokenService.js';
import { AdminAnalyticsService } from '../services/adminAnalyticsService.js';
import { CrossChainSwapService } from '../services/crossChainSwapService.js';
import { resolveUnderpaidOrder, type UnderpaidResolutionMode } from '../services/underpaidOrderService.js';
import { env } from '../config/env.js';
import { z } from 'zod';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const AnalyticsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
  granularity: z.enum(['day', 'week', 'month']).optional(),
  refresh: z.enum(['true', 'false']).optional(),
});

const AdjustReserveSchema = z.object({
  deltaUsdCents: z.number().int().refine((n) => n !== 0, 'deltaUsdCents must be non-zero'),
  note: z.string().max(160).optional(),
});

const AllocationItemSchema = z.object({
  symbol: z.enum(['GOLD_G', 'SILVER_G', 'XRP', 'XLM', 'USDC', 'NXL']),
  label: z.string().min(1).max(60),
  unitQty: z.number().positive(),
});

const UpsertProductSchema = z.object({
  sku: z.string().min(2).max(64),
  title: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  price_cents: z.number().int().positive().optional(),
  category: z.string().min(2).max(40).default('baskets'),
  stock_quantity: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  rail: z.enum(['stellar', 'xrpl', 'multi']).optional(),
  tag: z.string().max(60).optional(),
  is_basket: z.boolean().optional(),
  is_live_asset: z.boolean().optional(),
  allocations: z.array(AllocationItemSchema).optional(),
});

const PatchProductSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
  price_cents: z.number().int().positive().optional(),
  stock_quantity: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  category: z.string().min(2).max(40).optional(),
  tag: z.string().max(60).optional(),
  allocations: z.array(AllocationItemSchema).optional(),
});

const transitions: Record<string, string[]> = {
  PENDING: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['FULFILLING', 'FAILED'],
  UNDERPAID: ['PAID', 'REFUNDED'],
  FULFILLING: ['FULFILLED', 'FAILED'],
  FULFILLED: [],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

adminRouter.get('/stats', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const productsCol = await MongoService.getCollection('products');
    const usersCol = await MongoService.getCollection('users');

    // Aggregate in MongoDB instead of loading the full orders collection into Node.
    const [orderStats, productsCount, usersCount, treasury, nrPool, contractMeta] = await Promise.all([
      ordersCol
        .aggregate<{ totalOrders: number; totalVolumeCents: number }>([
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalVolumeCents: {
                $sum: {
                  $cond: [
                    { $in: ['$status', ['PAID', 'FULFILLING', 'FULFILLED']] },
                    { $ifNull: ['$total_cents', 0] },
                    0,
                  ],
                },
              },
            },
          },
        ])
        .toArray()
        .then((rows) => rows[0] || { totalOrders: 0, totalVolumeCents: 0 }),
      productsCol.countDocuments(),
      usersCol.countDocuments(),
      TreasuryService.getTreasurySummary().catch(() => null),
      NrTokenService.getPoolStats().catch(() => null),
      SorobanService.getContractMetadata().catch(() => null),
    ]);

    res.json({
      success: true,
      status: 'success',
      data: {
        totalVolumeCents: orderStats.totalVolumeCents,
        totalOrdersCount: orderStats.totalOrders,
        productsCount,
        usersCount,
        treasury,
        nrPool,
        contract: contractMeta?.contract,
        rpcHealth: contractMeta?.rpcHealth,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.get('/analytics', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = AnalyticsQuerySchema.safeParse({
    range: req.query.range ?? '30d',
    granularity: req.query.granularity,
    refresh: req.query.refresh,
  });
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid analytics query parameters',
      details: parsed.error.format(),
    });
  }

  try {
    const data = await AdminAnalyticsService.getAnalytics({
      range: parsed.data.range,
      granularity: parsed.data.granularity,
      forceRefresh: parsed.data.refresh === 'true',
    });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to aggregate admin analytics' });
  }
});

adminRouter.get('/orders', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 200)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const validStatuses = ['PENDING', 'PAID', 'UNDERPAID', 'FULFILLING', 'FULFILLED', 'CANCELLED', 'REFUNDED', 'FAILED'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid order status filter' });
    }

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const match = status ? { status } : {};
    const [total, orders] = await Promise.all([
      ordersCol.countDocuments(match as any),
      ordersCol
        .aggregate([
          { $match: match },
          { $sort: { created_at: -1 } },
          { $skip: offset },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              let: { buyerId: '$user_id' },
              pipeline: [
                { $match: { $expr: { $eq: ['$id', '$$buyerId'] } } },
                { $project: { _id: 0, email: 1, name: 1 } },
              ],
              as: 'buyer',
            },
          },
          {
            $project: {
              _id: 0,
              id: 1,
              orderNumber: '$order_number',
              status: 1,
              totalCents: '$total_cents',
              createdAt: '$created_at',
              buyerEmail: { $ifNull: [{ $arrayElemAt: ['$buyer.email', 0] }, '$user_id'] },
              buyerName: { $arrayElemAt: ['$buyer.name', 0] },
              rail: '$payment_rail',
              txHash: '$tx_hash',
              underpaidCents: '$underpaid_cents',
              slippagePercent: '$slippage_percent',
              refundTxHash: '$refund_tx_hash',
              items: 1,
            },
          },
        ])
        .toArray(),
    ]);

    res.json({
      success: true,
      status: 'success',
      data: { orders, total, limit, offset },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.patch('/orders/:id', async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const status = req.body?.status;

  try {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const current = await ordersCol.findOne({ $or: [{ id }, { order_number: id }] });
    if (!current) return res.status(404).json({ success: false, error: 'Order not found' });

    if (!transitions[current.status]?.includes(status)) {
      return res.status(400).json({ success: false, error: `Cannot change ${current.status} to ${status}` });
    }

    const updated = await ordersCol.findOneAndUpdate(
      { id: current.id },
      { $set: { status, updated_at: new Date().toISOString() } },
      { returnDocument: 'after' }
    );

    if (updated && ['PAID', 'FULFILLING', 'FULFILLED'].includes(status)) {
      await PortfolioService.creditOrderAllocations(updated).catch(() => {});
    }
    await AdminAnalyticsService.invalidateCache();

    res.json({ success: true, status: 'success', data: { order: updated } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: List persistent cross-chain swaps from MongoDB
adminRouter.get('/swaps', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const swaps = await CrossChainSwapService.getRecentSwaps(limit);
    res.json({ success: true, status: 'success', data: { swaps, total: swaps.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load swaps' });
  }
});

// Admin: Resolve a stuck UNDERPAID order (force settle or refund)
adminRouter.post('/orders/:id/resolve-underpaid', async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const mode = String(req.body?.mode || '').toUpperCase().trim() as UnderpaidResolutionMode;
  const allowed: UnderpaidResolutionMode[] = ['TOPUP_USD', 'TOPUP_NXL', 'REFUND_ONCHAIN', 'REFUND_WALLET'];

  if (!allowed.includes(mode)) {
    return res.status(400).json({ success: false, error: `Invalid resolution mode. Use: ${allowed.join(', ')}` });
  }

  try {
    const result = await resolveUnderpaidOrder({
      orderId: id,
      userId: req.user!.id,
      mode,
      isAdmin: true,
    });
    await AdminAnalyticsService.invalidateCache();
    res.json({ success: true, status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Could not resolve order' });
  }
});

adminRouter.get('/products', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const cacheKey = 'admin:products';
    if (!forceRefresh) {
      const cached = await RedisCacheService.getCache<any[]>('admin:products');
      if (cached) {
        return res.json({ success: true, cached: true, data: { products: cached } });
      }
    }
    const products = await ProductService.getAllProductsForAdmin(forceRefresh);
    await RedisCacheService.setCache(cacheKey, products, 60);
    res.json({ success: true, cached: false, data: { products } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/products', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = UpsertProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid product payload', details: parsed.error.format() });
  }

  try {
    const product = await ProductService.upsertAdminProduct(parsed.data);
    await Promise.all([
      RedisCacheService.invalidateCache('products:active'),
      RedisCacheService.invalidateCache('admin:products'),
    ]);
    res.status(201).json({ success: true, data: { product } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to save product' });
  }
});

adminRouter.patch('/products/:sku', async (req: AuthenticatedRequest, res: Response) => {
  const sku = (Array.isArray(req.params.sku) ? req.params.sku[0] : req.params.sku).trim();
  const parsed = PatchProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid product update payload', details: parsed.error.format() });
  }

  try {
    const product = await ProductService.patchProductBySku(sku, parsed.data);
    if (!product) {
      return res.status(404).json({ success: false, error: `Product ${sku} not found` });
    }
    await Promise.all([
      RedisCacheService.invalidateCache('products:active'),
      RedisCacheService.invalidateCache('admin:products'),
    ]);
    res.json({ success: true, data: { product } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update product' });
  }
});

adminRouter.get('/users', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const usersCol = await MongoService.getCollection('users');
    const users = await usersCol.find({}, { projection: { passwordHash: 0 } }).toArray();
    res.json({ success: true, data: { users } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.get(['/nr-pool', '/nr-token/status', '/nxl-token/status'], async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await NrTokenService.getPoolStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load $NR pool' });
  }
});

adminRouter.post(['/nr-pool/adjust-reserve', '/nr-token/reserve', '/nxl-token/reserve'], async (req: AuthenticatedRequest, res: Response) => {
  const parsed = AdjustReserveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid reserve adjustment payload', details: parsed.error.format() });
  }

  try {
    const stats = await NrTokenService.adminAdjustReserve({
      deltaUsdCents: parsed.data.deltaUsdCents,
      adminId: req.user!.id,
      note: parsed.data.note,
    });
    await AdminAnalyticsService.invalidateCache();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Reserve adjustment failed' });
  }
});

adminRouter.get('/portfolios', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const auc = await PortfolioService.getPlatformAUC();
    res.json({ success: true, data: auc });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to aggregate platform AUC' });
  }
});

// ============================================================================
// Module 4: Platform Treasury & Owner Profit Endpoints
// ============================================================================

adminRouter.get('/treasury/summary', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await TreasuryService.getTreasurySummary();
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load treasury summary' });
  }
});

adminRouter.get('/treasury/entries', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const sourceType = req.query.sourceType ? (String(req.query.sourceType) as any) : undefined;
    const data = await TreasuryService.getRecentEntries(limit, offset, sourceType);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load treasury entries' });
  }
});

adminRouter.get('/treasury/config', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await TreasuryService.getConfig();
    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load treasury config' });
  }
});

adminRouter.patch('/treasury/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await TreasuryService.updateConfig(req.body, req.user?.id);
    await AdminAnalyticsService.invalidateCache();
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to update treasury config' });
  }
});

adminRouter.post('/treasury/trigger-split', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [ordersCol, logsCol, config] = await Promise.all([
      MongoService.getCollection<MongoOrderDoc>('orders'),
      MongoService.getCollection<MongoChainActionLogDoc>('platform_chain_logs'),
      TreasuryService.getConfig(),
    ]);

    const settledOrders = await ordersCol
      .find({ status: { $in: ['PAID', 'FULFILLING', 'FULFILLED'] } })
      .toArray();

    let reconciledOrdersCount = 0;
    for (const order of settledOrders) {
      let touched = false;
      if (order.portfolio_credited !== true) {
        const credited = await PortfolioService.creditOrderAllocations(order).catch(() => false);
        if (credited) touched = true;
      }

      const isPaidWithNr = order.payment_rail === 'NXL_TOKEN';
      const orderFeeCents = isPaidWithNr
        ? 0
        : Math.round(((order.total_cents || 0) * config.order_fee_bps) / 10000);
      const isCryptoRail = ['STELLAR', 'XRPL', 'XLM', 'XRP', 'STELLAR_USDC', 'USDC'].includes(
        order.payment_rail
      );
      const gasArbitrageCents = isCryptoRail ? config.gas_flat_cents : 0;

      if (orderFeeCents > 0 || gasArbitrageCents > 0) {
        const rev = await TreasuryService.recordRevenueEvent({
          sourceType: 'ORDER',
          referenceId: order.order_number,
          grossCents: order.total_cents || 0,
          feeCents: orderFeeCents,
          gasArbitrageCents,
          rail: (order.payment_rail as any) || 'INTERNAL',
        });
        if (!rev.isDuplicate) touched = true;
      }

      if (touched) reconciledOrdersCount += 1;
    }

    const [summary, contractMeta] = await Promise.all([
      TreasuryService.getTreasurySummary(),
      SorobanService.getContractMetadata().catch(() => null),
    ]);

    const txHash = `split_${crypto.randomUUID().replace(/-/g, '')}`;
    const referenceId = `SPLIT-${Date.now().toString(36).toUpperCase()}`;
    await logsCol.insertOne({
      id: `log_${crypto.randomUUID()}`,
      chain: 'STELLAR',
      action: 'CONTRACT_SPLIT',
      reference_id: referenceId,
      operator_id: req.user!.id,
      tx_hash: txHash,
      amount_primary: summary.netOwnerProfitUsd,
      amount_secondary: summary.nrPoolInjectedUsd,
      details: {
        reason: typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 160) : 'Manual treasury split',
        reconciledOrdersCount,
        totalRevenueCents: summary.totalRevenueCents,
        zeroSumDifferenceCents: summary.zeroSumDifferenceCents,
      },
      explorer_url: contractMeta?.contract?.explorerUrl || contractMeta?.contract?.explorer_url || '',
      status: 'SUCCESS',
      created_at: new Date().toISOString(),
    });

    await AdminAnalyticsService.invalidateCache();

    res.json({
      success: true,
      data: {
        summary,
        reconciledOrdersCount,
        referenceId,
        txHash,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to trigger profit split' });
  }
});

// ============================================================================
// Module 4: Stellar Protocol 22 Smart Contract & On-Chain Endpoints
// ============================================================================

adminRouter.get('/contracts/nexus-vault', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const meta = await SorobanService.getContractMetadata();
    res.json({ success: true, data: meta });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to inspect smart contract' });
  }
});

adminRouter.post('/contracts/nexus-vault/upgrade', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newWasmHash, notes } = req.body || {};
    if (!newWasmHash || typeof newWasmHash !== 'string' || newWasmHash.length < 32) {
      return res.status(400).json({ success: false, error: 'Valid newWasmHash (min 32 chars) is required' });
    }

    const current = await SorobanService.getContractMetadata();
    const updated = await SorobanService.recordContractUpgrade(
      current.contract.contract_id,
      newWasmHash,
      req.user!.id,
      `tx_upgrade_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
      notes
    );

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Contract upgrade failed' });
  }
});

adminRouter.get('/tokens/nr', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const token = await StellarTokenIssuerService.getOnChainTokenDetails();
    res.json({ success: true, data: token });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch on-chain token details' });
  }
});

// ============================================================================
// Dual-Rail Token & Native XRPL AMM (XLS-30d) Endpoints
// ============================================================================

adminRouter.get(['/dual-rail/status', '/dual-rail/summary'], async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await DualRailTokenService.getDualRailSummary();
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load dual-rail summary' });
  }
});

adminRouter.post('/dual-rail/xrpl-amm/create', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { initialXrp = 10, initialNr = 10 } = req.body || {};
    const result = await DualRailTokenService.deployOrSyncXrplAmm(req.user!.id, Number(initialXrp), Number(initialNr));
    await RedisCacheService.invalidateCache('admin:dual-rail:summary');
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'XRPL AMMCreate failed' });
  }
});

adminRouter.post('/dual-rail/xrpl-amm/deposit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { xrpAmount = 5, nrAmount = 5 } = req.body || {};
    const result = await DualRailTokenService.depositXrplAmmLiquidity(req.user!.id, Number(xrpAmount), Number(nrAmount));
    await RedisCacheService.invalidateCache('admin:dual-rail:summary');
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'XRPL AMMDeposit failed' });
  }
});

adminRouter.get('/dual-rail/logs', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const logsCol = await MongoService.getCollection('platform_chain_logs');
    const logs = await logsCol.find({}).sort({ created_at: -1 }).limit(50).toArray();
    res.json({ success: true, data: { items: logs } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch chain logs' });
  }
});

/**
 * RESTRICTED: Admin-only extraction of on-chain token credentials, addresses, and secret keys/seeds
 * Guaranteed role gate: requireAuth + requireAdmin
 */
adminRouter.get('/dual-rail/credentials', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const tokensCol = await MongoService.getCollection<MongoPlatformTokenDoc>('platform_tokens');
    const stellarDoc = await tokensCol.findOne({ chain: 'STELLAR', symbol: 'NXL' }) || await tokensCol.findOne({ chain: 'STELLAR', symbol: 'NR' as any });
    const xrplDoc = await tokensCol.findOne({ chain: 'XRPL', symbol: 'NXL' }) || await tokensCol.findOne({ chain: 'XRPL', symbol: 'NR' as any });

    res.json({
      success: true,
      data: {
        stellar: {
          assetCode: env.STELLAR_NR_ASSET_CODE || stellarDoc?.asset_code || 'NXL',
          issuerAddress: stellarDoc?.issuer_address || env.STELLAR_NR_ISSUER_PUBLIC,
          issuerSecretKey: stellarDoc?.issuer_secret || env.STELLAR_NR_ISSUER_SECRET,
          contractId: stellarDoc?.contract_id || env.STELLAR_NR_CONTRACT_ID,
          distributorVault: stellarDoc?.distribution_address || env.STELLAR_NR_DISTRIBUTOR_VAULT,
          distributorSecretKey: env.STELLAR_HOT_WALLET_SECRET,
          totalSupplyCap: stellarDoc?.total_supply_cap || 1_000_000,
          mintTxHash: stellarDoc?.mint_tx_hash,
          explorerUrl: stellarDoc?.explorer_url || `https://stellar.expert/explorer/testnet/asset/NXL-${stellarDoc?.issuer_address || env.STELLAR_NR_ISSUER_PUBLIC}`,
        },
        xrpl: {
          currencyCode: env.XRPL_NR_CURRENCY_CODE || xrplDoc?.asset_code || 'NXL',
          currencyHex: '',
          issuerAddress: xrplDoc?.issuer_address || env.XRPL_NR_ISSUER_ADDRESS,
          issuerSecretSeed: xrplDoc?.issuer_secret || env.XRPL_NR_ISSUER_SEED,
          ammAccount: xrplDoc?.amm_account || env.XRPL_NR_AMM_ACCOUNT,
          distributorVault: xrplDoc?.distribution_address || env.PLATFORM_XRPL_VAULT,
          distributorSecretSeed: env.XRPL_HOT_WALLET_SEED,
          totalSupplyCap: xrplDoc?.total_supply_cap || 1_000_000,
          ammTxHash: xrplDoc?.amm_tx_hash,
          mintTxHash: xrplDoc?.mint_tx_hash,
          explorerUrl: xrplDoc?.explorer_url || `https://testnet.xrpl.org/accounts/${env.XRPL_NR_ISSUER_ADDRESS}`,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch credentials' });
  }
});
