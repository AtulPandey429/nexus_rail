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
    created_at: doc.created_at,
  };
}

const DEFAULT_PRODUCTS: Omit<MongoProductDoc, '_id'>[] = [
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
      const count = await col.countDocuments();
      if (count === 0) {
        await col.insertMany(DEFAULT_PRODUCTS as any);
        console.log('🌱 [MongoDB Atlas] Seeded default product catalog (4 items)');
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
