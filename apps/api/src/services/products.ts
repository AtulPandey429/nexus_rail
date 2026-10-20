import type { DbProduct } from '@nexusrail/shared';
import { MongoService, MongoProductDoc } from './mongo.js';
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
    created_at: doc.created_at,
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod_nr_token_05',
    sku: 'NR-TOKEN',
    title: 'NR Protocol Token',
    description: 'NexusRail multi-rail governance & fee-discount token on Stellar and XRPL.',
    price_cents: 2500,
    category: 'crypto',
    stock_quantity: 100000,
    active: true,
    upvotes_count: 512,
    rail: 'multi',
    tag: 'Protocol Token',
    rating: 5.0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod_ngold_token_06',
    sku: 'NGOLD-TOKEN',
    title: '1 Gram Gold Token (nGOLD)',
    description: 'Physical allocated gold-backed asset token on Stellar Soroban with audited vault reserves.',
    price_cents: 8500,
    category: 'crypto',
    stock_quantity: 5000,
    active: true,
    upvotes_count: 320,
    rail: 'stellar',
    tag: 'RWA Gold Token',
    rating: 4.9,
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
      }
      this.seeded = true;
    } catch (err: any) {
      console.warn('⚠️ [MongoDB Catalog Seed Warning]:', err.message);
    }
  }

  static async getActiveProducts(): Promise<DbProduct[]> {
    await this.ensureSeed();
    const col = await MongoService.getCollection<MongoProductDoc>('products');
    const docs = await col
      .find({ active: true })
      .sort({ upvotes_count: -1 })
      .toArray();
    return docs.map(mapProduct);
  }

  static async getProductBySku(sku: string): Promise<DbProduct | null> {
    await this.ensureSeed();
    const col = await MongoService.getCollection<MongoProductDoc>('products');
    const doc = await col.findOne({ sku });
    return doc ? mapProduct(doc) : null;
  }

  static async getProductById(id: string): Promise<DbProduct | null> {
    await this.ensureSeed();
    const col = await MongoService.getCollection<MongoProductDoc>('products');
    const doc = await col.findOne({ id });
    return doc ? mapProduct(doc) : null;
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
