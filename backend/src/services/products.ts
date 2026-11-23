import type { AssetSymbol, DbProduct, ProductAllocation } from '../types/index.js';
import { MongoService, MongoProductDoc } from './mongo.js';
import { NrTokenService } from './nrToken.service.js';
import { getExtendedMarketSnapshot, type ExtendedMarketSnapshot } from './market.js';
import crypto from 'crypto';

function mapProduct(doc: MongoProductDoc): DbProduct {
  return {
    id: doc.id,
    sku: doc.sku,
    title: doc.title,
    description: doc.description,
    price_cents: doc.price_cents,
    category: doc.category,
    stock_quantity: doc.stock_quantity,
    active: doc.active,
    upvotes_count: doc.upvotes_count || 0,
    rail: doc.rail || (doc.sku.includes('XRP') || doc.sku === 'RELAY-MAT' || doc.sku === 'PROD-LEDGER-COLD' ? 'xrpl' : doc.sku.includes('XLM') || doc.sku === 'RAIL-ONE' || doc.sku === 'NODE-STAND' || doc.sku === 'RAIL-CABLES' || doc.sku === 'PROD-AGENT-PRO' ? 'stellar' : 'multi'),
    tag: doc.tag || 'Official',
    rating: doc.rating || 4.9,
    is_live_asset: Boolean(doc.is_live_asset || (doc.allocations && doc.allocations.length > 0)),
    is_basket: Boolean(doc.is_basket),
    allocations: doc.allocations,
    price_inr: doc.price_inr,
    change_24h_percent: doc.change_24h_percent,
    oracle_source: doc.oracle_source,
    price_updated_at: doc.price_updated_at,
    created_at: doc.created_at,
  };
}

export function computeHydratedProduct(
  base: DbProduct,
  snapshot: ExtendedMarketSnapshot,
  nrPool: { spotPriceCents: number; change24hPercent: number }
): DbProduct {
  if (!base.allocations || base.allocations.length === 0) {
    // Derive live rail oracle adjustment so even custom single-rail items reflect real market movements
    const railChange =
      base.rail === 'xrpl'
        ? snapshot.xrp24hChange
        : base.rail === 'stellar'
          ? snapshot.xlm24hChange
          : nrPool.change24hPercent;
    const livePriceCents = Math.max(1, Math.round(base.price_cents * (1 + railChange / 100)));
    return {
      ...base,
      price_cents: livePriceCents,
      is_live_asset: true,
      is_basket: Boolean(base.is_basket),
      price_inr: Math.round((livePriceCents / 100) * snapshot.usdInrRate),
      change_24h_percent: railChange,
      oracle_source: base.rail === 'multi' ? 'amm' : snapshot.source,
      price_updated_at: snapshot.fetchedAt,
    };
  }

  const unitPriceBySymbol: Record<string, { unitCents: number; change24h: number }> = {
    GOLD_G: { unitCents: Math.max(1, Math.round(snapshot.goldUsdPerGram * 100)), change24h: snapshot.gold24hChange },
    SILVER_G: { unitCents: Math.max(1, Math.round(snapshot.silverUsdPerGram * 100)), change24h: snapshot.silver24hChange },
    XRP: { unitCents: Math.max(1, Math.round(snapshot.xrpUsd * 100)), change24h: snapshot.xrp24hChange },
    XLM: { unitCents: Math.max(1, Math.round(snapshot.xlmUsd * 100)), change24h: snapshot.xlm24hChange },
    USDC: { unitCents: 100, change24h: 0 },
    NXL: { unitCents: Math.max(1, nrPool.spotPriceCents), change24h: nrPool.change24hPercent },
    NR: { unitCents: Math.max(1, nrPool.spotPriceCents), change24h: nrPool.change24hPercent },
  };

  const components = base.allocations.map((alloc) => {
    const ref = unitPriceBySymbol[alloc.symbol] || unitPriceBySymbol.NXL || { unitCents: 100, change24h: 0 };
    const valCents = Math.max(1, Math.round(alloc.unitQty * ref.unitCents));
    return { alloc, valCents, change24h: ref.change24h };
  });

  const totalCents = components.reduce((sum, c) => sum + c.valCents, 0);
  const hydratedAllocations: ProductAllocation[] = components.map(({ alloc, valCents }) => ({
    ...alloc,
    valueCents: valCents,
    weightPercent: totalCents > 0 ? Number(((valCents / totalCents) * 100).toFixed(1)) : 0,
  }));

  const weightedChange24h =
    totalCents > 0
      ? Number(components.reduce((sum, c) => sum + (c.valCents / totalCents) * c.change24h, 0).toFixed(2))
      : 0;

  const isOnlyNr = base.allocations.every((a) => a.symbol === 'NXL');

  return {
    ...base,
    price_cents: totalCents,
    price_inr: Math.round((totalCents / 100) * snapshot.usdInrRate),
    change_24h_percent: weightedChange24h,
    is_live_asset: true,
    is_basket: Boolean(base.is_basket),
    allocations: hydratedAllocations,
    oracle_source: isOnlyNr ? 'amm' : snapshot.source,
    price_updated_at: snapshot.fetchedAt,
  };
}

const DEFAULT_PRODUCTS: Omit<MongoProductDoc, '_id'>[] = [
  {
    id: 'prod_rail_one_01',
    sku: 'RAIL-ONE',
    title: 'Rail One',
    description: 'Self-custody, beautifully offline. Dual-chip cold storage hardware signer with native Stellar and XRPL key generation.',
    price_cents: 12900,
    category: 'hardware',
    stock_quantity: 45,
    active: true,
    upvotes_count: 248,
    rail: 'stellar',
    tag: 'Flagship Hardware',
    rating: 4.9,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'USDC', label: 'Hardware Base', unitQty: 100 },
      { symbol: 'XLM', label: 'Stellar Stake', unitQty: 200 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod_relay_mat_02',
    sku: 'RELAY-MAT',
    title: 'Relay desk mat',
    description: 'A grounded space for your next move. High-density micro-weave workspace base with stitched non-fray edge.',
    price_cents: 3900,
    category: 'workspace',
    stock_quantity: 120,
    active: true,
    upvotes_count: 182,
    rail: 'xrpl',
    tag: 'Micro-Weave Base',
    rating: 4.8,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'USDC', label: 'Workspace Base', unitQty: 20 },
      { symbol: 'XRP', label: 'XRPL Fuel', unitQty: 20 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod_nexus_tee_03',
    sku: 'NEXUS-TEE',
    title: 'Nexus tee',
    description: 'A uniform for the onchain everyday. Heavyweight 240gsm organic combed cotton with custom tonal embroidery.',
    price_cents: 3200,
    category: 'essentials',
    stock_quantity: 85,
    active: true,
    upvotes_count: 145,
    rail: 'multi',
    tag: 'Everyday Apparel',
    rating: 4.7,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'USDC', label: 'Apparel Base', unitQty: 22 },
      { symbol: 'NXL', label: '$NXL Protocol Stake', unitQty: 10 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod_node_stand_04',
    sku: 'NODE-STAND',
    title: 'Node stand',
    description: 'Built for a more considered desk. Precision CNC machined aluminum hardware dock with silicone cable channel.',
    price_cents: 5800,
    category: 'hardware',
    stock_quantity: 60,
    active: true,
    upvotes_count: 112,
    rail: 'stellar',
    tag: 'CNC Aluminum',
    rating: 4.8,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'USDC', label: 'CNC Hardware Base', unitQty: 44 },
      { symbol: 'XLM', label: 'Stellar Stake', unitQty: 100 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod_signal_cap_05',
    sku: 'SIGNAL-CAP',
    title: 'Signal cap',
    description: 'Low profile. Clear signal. Structured 6-panel silhouette with subtle high-density micro-rail embroidery.',
    price_cents: 2800,
    category: 'essentials',
    stock_quantity: 90,
    active: true,
    upvotes_count: 94,
    rail: 'multi',
    tag: 'Low Profile Gear',
    rating: 4.6,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'USDC', label: 'Headwear Base', unitQty: 18 },
      { symbol: 'NXL', label: '$NXL Protocol Stake', unitQty: 10 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod_rail_cables_06',
    sku: 'RAIL-CABLES',
    title: 'Rail cable kit',
    description: 'One kit. Every connection. High-spec braided silicone USB-C custom engineered for zero-interference hardware signing.',
    price_cents: 2400,
    category: 'hardware',
    stock_quantity: 150,
    active: true,
    upvotes_count: 88,
    rail: 'stellar',
    tag: 'Braided Silicone',
    rating: 4.9,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'USDC', label: 'Cable Kit Base', unitQty: 17 },
      { symbol: 'XLM', label: 'Stellar Stake', unitQty: 50 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod_xrp_validator_kit_01',
    sku: 'PROD-XRP-KIT',
    title: 'XRPL Starter Validator Node Hardware',
    description: 'Turnkey XRPL validator node hardware kit with pre-loaded ledger sync module.',
    price_cents: 49900,
    category: 'hardware',
    stock_quantity: 25,
    active: true,
    upvotes_count: 142,
    rail: 'xrpl',
    tag: 'Validator Hardware',
    rating: 4.9,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'USDC', label: 'Validator Node Hardware', unitQty: 400 },
      { symbol: 'XRP', label: 'XRPL Validator Reserve', unitQty: 100 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod_xlm_soroban_pass_02',
    sku: 'PROD-XLM-PASS',
    title: 'Stellar Soroban Smart Contract License',
    description: 'Lifetime developer key for automated Soroban smart contract deployment suite.',
    price_cents: 19900,
    category: 'software',
    stock_quantity: 100,
    active: true,
    upvotes_count: 98,
    rail: 'stellar',
    tag: 'Soroban Contract Key',
    rating: 4.8,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'USDC', label: 'Soroban License Base', unitQty: 170 },
      { symbol: 'XLM', label: 'Soroban Gas Reserve', unitQty: 200 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod_agent_desk_pro_03',
    sku: 'PROD-AGENT-PRO',
    title: 'NexusRail AI Agent Desk Pro Key',
    description: 'High-throughput Groq & Gemini agent desk license key with Redis proposal locks.',
    price_cents: 2990,
    category: 'subscription',
    stock_quantity: 500,
    active: true,
    upvotes_count: 310,
    rail: 'stellar',
    tag: 'AI Telemetry License',
    rating: 4.9,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'USDC', label: 'AI Compute Quota', unitQty: 15 },
      { symbol: 'NXL', label: '$NXL Agent Credits', unitQty: 15 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod_crypto_vault_key_04',
    sku: 'PROD-LEDGER-COLD',
    title: 'NexusRail Hardware Security Module',
    description: 'Dual-chip cold storage hardware signer with native Stellar and XRPL key generation.',
    price_cents: 14900,
    category: 'hardware',
    stock_quantity: 50,
    active: true,
    upvotes_count: 84,
    rail: 'xrpl',
    tag: 'Consensus HSM',
    rating: 4.9,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'USDC', label: 'HSM Hardware Base', unitQty: 120 },
      { symbol: 'XRP', label: 'XRPL Signer Reserve', unitQty: 30 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod_nr_token_05',
    sku: 'NXL-TOKEN',
    title: 'NXL Protocol Token',
    description: 'NexusRail multi-rail governance & fee-discount token priced dynamically on the constant-product AMM.',
    price_cents: 100,
    category: 'live-assets',
    stock_quantity: 100000,
    active: true,
    upvotes_count: 512,
    rail: 'multi',
    tag: 'Protocol Token',
    rating: 5.0,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'NXL', label: '$NXL Protocol Token', unitQty: 1 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod_ngold_token_06',
    sku: 'NGOLD-TOKEN',
    title: '1 Gram Gold Token (nGOLD)',
    description: 'Physical allocated gold-backed asset token on Stellar Soroban tracked to live PAXG reserves.',
    price_cents: 8850,
    category: 'live-assets',
    stock_quantity: 5000,
    active: true,
    upvotes_count: 320,
    rail: 'stellar',
    tag: 'RWA Gold Token',
    rating: 4.9,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'GOLD_G', label: '24K Gold (PAXG)', unitQty: 1 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'basket_inflation_shield_07',
    sku: 'BASKET-INFLATION-SHIELD',
    title: 'Inflation Shield Basket',
    description: 'Cross-asset store-of-value combo: 0.50g 24K Gold (PAXG), 30 USDC digital dollar reserve, and 20g Allocated Silver (KAG).',
    price_cents: 9525,
    category: 'baskets',
    stock_quantity: 1000,
    active: true,
    upvotes_count: 640,
    rail: 'stellar',
    tag: 'SMART BASKET • RWA HEDGE',
    rating: 5.0,
    is_live_asset: true,
    is_basket: true,
    allocations: [
      { symbol: 'GOLD_G', label: '24K Gold (PAXG)', unitQty: 0.5 },
      { symbol: 'USDC', label: 'USDC Reserve', unitQty: 30 },
      { symbol: 'SILVER_G', label: 'Allocated Silver (KAG)', unitQty: 20 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'basket_dual_rail_08',
    sku: 'BASKET-DUAL-RAIL',
    title: 'Dual-Rail Flash Pack',
    description: 'Simultaneous XRPL + Stellar liquidity combo combining 25 XRP and 150 XLM at live multi-rail oracle spot pricing.',
    price_cents: 5910,
    category: 'baskets',
    stock_quantity: 1000,
    active: true,
    upvotes_count: 585,
    rail: 'multi',
    tag: 'SMART BASKET • XRPL + XLM',
    rating: 4.9,
    is_live_asset: true,
    is_basket: true,
    allocations: [
      { symbol: 'XRP', label: 'XRP (XRPL Native)', unitQty: 25 },
      { symbol: 'XLM', label: 'XLM (Stellar Native)', unitQty: 150 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'basket_ai_alpha_09',
    sku: 'BASKET-AI-ALPHA',
    title: 'AI Dynamic Alpha Basket',
    description: 'All-in-one diversified combo pairing 0.40g Gold, 25 $NXL AMM Tokens, 15 XRP, and 100 XLM priced live every 60s.',
    price_cents: 9760,
    category: 'baskets',
    stock_quantity: 1000,
    active: true,
    upvotes_count: 720,
    rail: 'multi',
    tag: 'SMART BASKET • ALPHA',
    rating: 5.0,
    is_live_asset: true,
    is_basket: true,
    allocations: [
      { symbol: 'GOLD_G', label: '24K Gold (PAXG)', unitQty: 0.4 },
      { symbol: 'NXL', label: '$NXL Protocol Token', unitQty: 25 },
      { symbol: 'XRP', label: 'XRP (XRPL Native)', unitQty: 15 },
      { symbol: 'XLM', label: 'XLM (Stellar Native)', unitQty: 100 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'live_ngold_1g_10',
    sku: 'NGOLD-1G',
    title: '1g 24K Digital Gold (nGOLD)',
    description: '1.00g allocated digital gold vault unit tracked directly to live PAXG USD & INR market feeds.',
    price_cents: 8850,
    category: 'live-assets',
    stock_quantity: 2500,
    active: true,
    upvotes_count: 460,
    rail: 'stellar',
    tag: 'LIVE ORACLE • 1G GOLD',
    rating: 4.9,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'GOLD_G', label: '24K Gold (PAXG)', unitQty: 1 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'live_nsilver_10g_11',
    sku: 'NSILVER-10G',
    title: '10g Digital Silver (nSILVER)',
    description: '10.00g tokenized physical silver bullion tracked directly to live KAG spot oracle feeds.',
    price_cents: 1050,
    category: 'live-assets',
    stock_quantity: 5000,
    active: true,
    upvotes_count: 340,
    rail: 'stellar',
    tag: 'LIVE ORACLE • 10G SILVER',
    rating: 4.8,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'SILVER_G', label: 'Allocated Silver (KAG)', unitQty: 10 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'live_nr_pack_50_12',
    sku: 'NXL-PACK-50',
    title: '50 $NXL Protocol Pack',
    description: 'Instant 50 $NXL token allocation priced live against the x · y = k bonding curve AMM with 10% checkout utility.',
    price_cents: 5000,
    category: 'live-assets',
    stock_quantity: 2000,
    active: true,
    upvotes_count: 550,
    rail: 'multi',
    tag: 'AMM LIVE • 50 $NXL',
    rating: 5.0,
    is_live_asset: true,
    is_basket: false,
    allocations: [
      { symbol: 'NXL', label: '$NXL Protocol Token', unitQty: 50 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export class ProductService {
  private static seeded = false;

  private static async ensureSeed(): Promise<void> {
    if (this.seeded) return;
    try {
      const col = await MongoService.getCollection<MongoProductDoc>('products');
      for (const item of DEFAULT_PRODUCTS) {
        await col.updateOne(
          { sku: item.sku },
          { $setOnInsert: item },
          { upsert: true }
        );
        // Backfill live rail allocations onto existing MongoDB rows lacking allocations
        if (item.allocations) {
          await col.updateOne(
            { sku: item.sku, allocations: { $exists: false } },
            {
              $set: {
                is_live_asset: true,
                allocations: item.allocations,
                category: item.category,
                updated_at: new Date().toISOString(),
              },
            }
          );
        }
      }
      this.seeded = true;
    } catch (err: any) {
      console.warn('⚠️ [MongoDB Catalog Seed Warning]:', err.message);
    }
  }

  private static async getLiveMarketInputs(forceRefresh = false): Promise<{
    snapshot: ExtendedMarketSnapshot;
    nrPool: { spotPriceCents: number; change24hPercent: number };
  }> {
    const [snapshot, nrPool] = await Promise.all([
      getExtendedMarketSnapshot(forceRefresh),
      NrTokenService.getPoolStats()
        .then((stats) => ({
          spotPriceCents: stats.spotPriceCents > 0 ? stats.spotPriceCents : 100,
          change24hPercent: Number.isFinite(stats.change24hPercent) ? stats.change24hPercent : 0,
        }))
        .catch(() => ({ spotPriceCents: 100, change24hPercent: 0 })),
    ]);
    return { snapshot, nrPool };
  }

  private static async hydrateList(docs: MongoProductDoc[], forceRefresh = false): Promise<DbProduct[]> {
    const mapped = docs.map(mapProduct);
    const { snapshot, nrPool } = await this.getLiveMarketInputs(forceRefresh);
    return mapped.map((product) => computeHydratedProduct(product, snapshot, nrPool));
  }

  static async getActiveProducts(forceRefresh = false): Promise<DbProduct[]> {
    await this.ensureSeed();
    const col = await MongoService.getCollection<MongoProductDoc>('products');
    const docs = await col
      .find({ active: true })
      .sort({ is_basket: -1, is_live_asset: -1, upvotes_count: -1 })
      .toArray();
    return this.hydrateList(docs, forceRefresh);
  }

  static async getAllProductsForAdmin(forceRefresh = false): Promise<DbProduct[]> {
    await this.ensureSeed();
    const col = await MongoService.getCollection<MongoProductDoc>('products');
    const docs = await col
      .find({})
      .sort({ is_basket: -1, is_live_asset: -1, created_at: -1 })
      .toArray();
    return this.hydrateList(docs, forceRefresh);
  }

  static async getProductBySku(sku: string): Promise<DbProduct | null> {
    await this.ensureSeed();
    const col = await MongoService.getCollection<MongoProductDoc>('products');
    const doc = await col.findOne({ sku });
    if (!doc) return null;
    const [hydrated] = await this.hydrateList([doc], false);
    return hydrated;
  }

  static async getProductById(id: string): Promise<DbProduct | null> {
    await this.ensureSeed();
    const col = await MongoService.getCollection<MongoProductDoc>('products');
    const doc = await col.findOne({ id });
    if (!doc) return null;
    const [hydrated] = await this.hydrateList([doc], false);
    return hydrated;
  }

  static async upsertAdminProduct(input: {
    sku: string;
    title: string;
    description?: string;
    price_cents?: number;
    category: string;
    stock_quantity?: number;
    active?: boolean;
    rail?: 'stellar' | 'xrpl' | 'multi';
    tag?: string;
    is_basket?: boolean;
    is_live_asset?: boolean;
    allocations?: ProductAllocation[];
  }): Promise<DbProduct> {
    await this.ensureSeed();
    const col = await MongoService.getCollection<MongoProductDoc>('products');
    const sku = input.sku.trim().toUpperCase();
    const now = new Date().toISOString();
    const existing = await col.findOne({ sku });

    const baseDoc: Omit<MongoProductDoc, '_id'> = {
      id: existing?.id || `prod_${crypto.randomUUID().slice(0, 8)}`,
      sku,
      title: input.title.trim(),
      description: input.description?.trim() ?? existing?.description ?? '',
      price_cents: typeof input.price_cents === 'number' ? input.price_cents : existing?.price_cents ?? 1000,
      category: input.category,
      stock_quantity: typeof input.stock_quantity === 'number' ? input.stock_quantity : existing?.stock_quantity ?? 500,
      active: typeof input.active === 'boolean' ? input.active : existing?.active ?? true,
      upvotes_count: existing?.upvotes_count ?? 100,
      rail: input.rail ?? existing?.rail ?? 'multi',
      tag: input.tag ?? existing?.tag ?? (input.is_basket ? 'SMART BASKET • CUSTOM' : 'CUSTOM ASSET'),
      rating: existing?.rating ?? 5.0,
      is_basket: typeof input.is_basket === 'boolean' ? input.is_basket : existing?.is_basket ?? false,
      is_live_asset:
        typeof input.is_live_asset === 'boolean'
          ? input.is_live_asset
          : Boolean(input.allocations && input.allocations.length > 0),
      allocations: input.allocations ?? existing?.allocations,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    await col.updateOne({ sku }, { $set: baseDoc }, { upsert: true });
    const [hydrated] = await this.hydrateList([baseDoc], true);
    return hydrated;
  }

  static async patchProductBySku(
    sku: string,
    patch: Partial<{
      title: string;
      description: string;
      price_cents: number;
      stock_quantity: number;
      active: boolean;
      category: string;
      tag: string;
      allocations: ProductAllocation[];
    }>
  ): Promise<DbProduct | null> {
    await this.ensureSeed();
    const col = await MongoService.getCollection<MongoProductDoc>('products');
    const updatedFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) updatedFields[k] = v;
    }
    if (patch.allocations) {
      updatedFields.is_live_asset = patch.allocations.length > 0;
    }
    const updated = await col.findOneAndUpdate(
      { sku },
      { $set: updatedFields },
      { returnDocument: 'after' }
    );
    if (!updated) return null;
    const [hydrated] = await this.hydrateList([updated], true);
    return hydrated;
  }

  static async incrementUpvotes(idOrSku: string): Promise<number> {
    await this.ensureSeed();
    const col = await MongoService.getCollection<MongoProductDoc>('products');
    
    // Find and update atomically using $inc
    const res = await col.findOneAndUpdate(
      { $or: [{ sku: idOrSku }, { id: idOrSku }] },
      { $inc: { upvotes_count: 1 }, $set: { updated_at: new Date().toISOString() } },
      { returnDocument: 'after' }
    );

    if (!res) {
      throw new Error('Product not found');
    }

    return res.upvotes_count;
  }
}
