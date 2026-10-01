import type { DbProduct } from '@nexusrail/shared';

// In-memory mock fallback data synced with Supabase DDL for development
const mockProducts: DbProduct[] = [
  {
    id: 'f87a8b9e-91a1-4321-8271-123456789001',
    sku: 'PROD-XRP-KIT',
    title: 'XRPL Starter Validator Node Hardware',
    description: 'Turnkey XRPL validator node hardware kit with pre-loaded ledger sync module.',
    price_cents: 49900,
    category: 'hardware',
    stock_quantity: 25,
    active: true,
    upvotes_count: 142,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f87a8b9e-91a1-4321-8271-123456789002',
    sku: 'PROD-XLM-PASS',
    title: 'Stellar Soroban Smart Contract License',
    description: 'Lifetime developer key for automated Soroban smart contract deployment suite.',
    price_cents: 19900,
    category: 'software',
    stock_quantity: 100,
    active: true,
    upvotes_count: 98,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f87a8b9e-91a1-4321-8271-123456789003',
    sku: 'PROD-AGENT-PRO',
    title: 'NexusRail AI Agent Desk Pro Key',
    description: 'High-throughput Groq & Gemini 2.0 Flash agent desk license key with Redis proposal locks.',
    price_cents: 2990,
    category: 'subscription',
    stock_quantity: 500,
    active: true,
    upvotes_count: 310,
    created_at: new Date().toISOString(),
  },
];

export class ProductService {
  static async getActiveProducts(): Promise<DbProduct[]> {
    // Returns active products sorted by upvotes_count DESC matching composite index idx_products_active_sort
    return mockProducts.filter((p) => p.active).sort((a, b) => b.upvotes_count - a.upvotes_count);
  }

  static async getProductBySku(sku: string): Promise<DbProduct | null> {
    return mockProducts.find((p) => p.sku === sku) || null;
  }
}
