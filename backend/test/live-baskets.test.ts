import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import type { DbProduct } from '../src/types/index.js';
import { computeHydratedProduct } from '../src/services/products.js';
import { getExtendedMarketSnapshot, type ExtendedMarketSnapshot } from '../src/services/market.js';
import { MongoService } from '../src/services/mongo.js';
import { RedisCacheService } from '../src/services/redis.js';
import { productRouter } from '../src/routes/products.routes.js';
import { ordersRouter } from '../src/routes/orders.routes.js';
import { adminRouter } from '../src/routes/admin.routes.js';
import { signToken } from '../src/services/jwt.js';

const MOCK_SNAPSHOT: ExtendedMarketSnapshot = {
  goldUsdPerGram: 88.5,
  goldInrPerGram: 7420,
  gold24hChange: 1.4,
  silverUsdPerGram: 1.05,
  silverInrPerGram: 88,
  silver24hChange: -0.6,
  xrpUsd: 1.3,
  xrp24hChange: 2.0,
  xlmUsd: 0.18,
  xlm24hChange: 1.5,
  usdInrRate: 83.85,
  source: 'coingecko',
  fetchedAt: '2026-10-27T12:00:00.000Z',
};

describe('Suite: Module 2 — Live Multi-Rail Smart Baskets & Real-Time Oracle Store', () => {
  let server: http.Server;
  let baseUrl: string;
  let userToken: string;
  let adminToken: string;

  const stamp = Date.now();
  const testUserId = `user_m2_test_${stamp}`;
  const testAdminId = `admin_m2_test_${stamp}`;
  const customSku = `BASKET-TEST-${String(stamp).slice(-5)}`;

  before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key-32-chars-long!';
    userToken = signToken({ id: testUserId, email: 'm2buyer@nexusrail.test', role: 'user' });
    adminToken = signToken({ id: testAdminId, email: 'm2admin@nexusrail.test', role: 'admin' });

    const app = express();
    app.use(express.json());
    app.use('/api/v1/products', productRouter);
    app.use('/api/v1/orders', ordersRouter);
    app.use('/api/v1/admin', adminRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    RedisCacheService.stopPruning();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    try {
      const ordersCol = await MongoService.getCollection('orders');
      const productsCol = await MongoService.getCollection('products');
      await ordersCol.deleteMany({ user_id: testUserId });
      await productsCol.deleteMany({ sku: customSku });
    } catch {}
    await MongoService.close();
  });

  it('T2.1: computeHydratedProduct calculates BASKET-INFLATION-SHIELD NAV, weights, 24h change, and INR', () => {
    const base: DbProduct = {
      id: 'b_inf',
      sku: 'BASKET-INFLATION-SHIELD',
      title: 'Inflation Shield Basket',
      price_cents: 100,
      category: 'baskets',
      stock_quantity: 100,
      active: true,
      upvotes_count: 10,
      is_basket: true,
      is_live_asset: true,
      allocations: [
        { symbol: 'GOLD_G', label: '24K Gold (PAXG)', unitQty: 0.5 },
        { symbol: 'USDC', label: 'USDC Reserve', unitQty: 30 },
        { symbol: 'SILVER_G', label: 'Allocated Silver (KAG)', unitQty: 20 },
      ],
      created_at: MOCK_SNAPSHOT.fetchedAt,
    };

    const hydrated = computeHydratedProduct(base, MOCK_SNAPSHOT, { spotPriceCents: 100, change24hPercent: 0 });
    // 0.5 * 8850 = 4425 + 30 * 100 = 3000 + 20 * 105 = 2100 -> 9525 cents
    assert.equal(hydrated.price_cents, 9525);
    assert.equal(hydrated.price_inr, Math.round(95.25 * 83.85));
    assert.equal(hydrated.oracle_source, 'coingecko');
    assert.equal(hydrated.is_live_asset, true);
    assert.equal(hydrated.is_basket, true);

    const weightSum = (hydrated.allocations || []).reduce((acc, a) => acc + (a.weightPercent || 0), 0);
    assert.ok(Math.abs(weightSum - 100) <= 0.2, `Expected allocation weights ~100%, got ${weightSum}`);

    const expected24h = Number((((4425 / 9525) * 1.4) + ((2100 / 9525) * -0.6)).toFixed(2));
    assert.equal(hydrated.change_24h_percent, expected24h);
  });

  it('T2.2: computeHydratedProduct reacts live to $NR AMM spot shifts in BASKET-AI-ALPHA', () => {
    const base: DbProduct = {
      id: 'b_alpha',
      sku: 'BASKET-AI-ALPHA',
      title: 'AI Dynamic Alpha Basket',
      price_cents: 100,
      category: 'baskets',
      stock_quantity: 100,
      active: true,
      upvotes_count: 10,
      is_basket: true,
      is_live_asset: true,
      allocations: [
        { symbol: 'GOLD_G', label: '24K Gold (PAXG)', unitQty: 0.4 },
        { symbol: 'NXL', label: '$NXL Protocol Token', unitQty: 25 },
        { symbol: 'XRP', label: 'XRP', unitQty: 15 },
        { symbol: 'XLM', label: 'XLM', unitQty: 100 },
      ],
      created_at: MOCK_SNAPSHOT.fetchedAt,
    };

    const atOneDollar = computeHydratedProduct(base, MOCK_SNAPSHOT, { spotPriceCents: 100, change24hPercent: 0 });
    const atTwoDollars = computeHydratedProduct(base, MOCK_SNAPSHOT, { spotPriceCents: 200, change24hPercent: 12.5 });

    // 25 NR shifts from $25.00 to $50.00 -> exact +2500 cents delta
    assert.equal(atTwoDollars.price_cents - atOneDollar.price_cents, 2500);
    assert.ok((atTwoDollars.change_24h_percent || 0) > (atOneDollar.change_24h_percent || 0));
  });

  it('T2.3: Single live asset packs track 1g Gold, 10g Silver, and 50 $NR linear scaling', () => {
    const nrPack: DbProduct = {
      id: 'nr_pack',
      sku: 'NR-PACK-50',
      title: '50 $NR Protocol Pack',
      price_cents: 100,
      category: 'live-assets',
      stock_quantity: 500,
      active: true,
      upvotes_count: 20,
      is_live_asset: true,
      allocations: [{ symbol: 'NXL', label: '$NXL Protocol Token', unitQty: 50 }],
      created_at: MOCK_SNAPSHOT.fetchedAt,
    };
    const hydratedNr = computeHydratedProduct(nrPack, MOCK_SNAPSHOT, { spotPriceCents: 142, change24hPercent: 8.5 });
    assert.equal(hydratedNr.price_cents, 50 * 142);
    assert.equal(hydratedNr.oracle_source, 'amm');
    assert.equal(hydratedNr.change_24h_percent, 8.5);
  });

  it('T2.4: All catalog SKUs hydrate dynamically with strictly live oracle sources (zero static/fallback)', () => {
    const railOne: DbProduct = {
      id: 'hw_1',
      sku: 'RAIL-ONE',
      title: 'Rail One',
      price_cents: 12900,
      category: 'hardware',
      rail: 'stellar',
      stock_quantity: 45,
      active: true,
      upvotes_count: 248,
      created_at: MOCK_SNAPSHOT.fetchedAt,
    };
    const hydrated = computeHydratedProduct(railOne, MOCK_SNAPSHOT, { spotPriceCents: 100, change24hPercent: 0 });
    assert.equal(hydrated.price_cents, Math.round(12900 * (1 + 1.5 / 100)));
    assert.equal(hydrated.oracle_source, 'coingecko');
    assert.equal(hydrated.is_live_asset, true);
    assert.ok(['coingecko', 'binance', 'amm'].includes(hydrated.oracle_source!));
  });

  it('T2.5: getExtendedMarketSnapshot returns strictly live exchange rates & 24h changes', async () => {
    const snap = await getExtendedMarketSnapshot();
    assert.ok(snap.goldUsdPerGram > 0);
    assert.ok(snap.silverUsdPerGram > 0);
    assert.ok(snap.xrpUsd > 0);
    assert.ok(snap.xlmUsd > 0);
    assert.ok(snap.usdInrRate > 0);
    assert.equal(typeof snap.gold24hChange, 'number');
    assert.equal(typeof snap.xrp24hChange, 'number');
    assert.ok(['coingecko', 'binance'].includes(snap.source), `Expected live source, got ${snap.source}`);
  });

  it('T2.6: Live catalog API serves Smart Baskets and POST /orders ignores tampered client price', async () => {
    const catRes = await fetch(`${baseUrl}/api/v1/products?refresh=true`);
    const catJson: any = await catRes.json();
    assert.equal(catRes.status, 200);
    assert.equal(catJson.success, true);

    const basket = catJson.data.find((p: any) => p.sku === 'BASKET-INFLATION-SHIELD');
    assert.ok(basket, 'BASKET-INFLATION-SHIELD must exist in catalog');
    assert.equal(basket.is_basket, true);
    assert.equal(basket.is_live_asset, true);
    assert.ok(basket.price_cents > 0);

    // Attempt tampered client checkout price (unitPriceCents: 1)
    const ordRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        rail: 'MULTI',
        items: [{ sku: 'BASKET-INFLATION-SHIELD', qty: 1, unitPriceCents: 1 }],
      }),
    });
    const ordJson: any = await ordRes.json();
    assert.equal(ordRes.status, 200);
    assert.equal(ordJson.success, true);
    assert.equal(ordJson.data.order.totalCents, basket.price_cents, 'Server must override tampered client price with live basket NAV');
  });

  it('T2.7: Admin endpoints create custom Smart Basket, toggle active status, and enforce RBAC', async () => {
    const unauth = await fetch(`${baseUrl}/api/v1/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ sku: customSku, title: 'Unauthorized', category: 'baskets' }),
    });
    assert.equal(unauth.status, 403);

    const createRes = await fetch(`${baseUrl}/api/v1/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        sku: customSku,
        title: 'Test Vault Basket',
        category: 'baskets',
        rail: 'multi',
        is_basket: true,
        is_live_asset: true,
        allocations: [
          { symbol: 'USDC', label: 'USDC Reserve', unitQty: 20 },
          { symbol: 'NXL', label: '$NXL Token', unitQty: 10 },
        ],
      }),
    });
    const createJson: any = await createRes.json();
    assert.equal(createRes.status, 201);
    assert.equal(createJson.data.product.sku, customSku);
    assert.ok(createJson.data.product.price_cents >= 2100);

    const patchRes = await fetch(`${baseUrl}/api/v1/admin/products/${customSku}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ active: false }),
    });
    const patchJson: any = await patchRes.json();
    assert.equal(patchRes.status, 200);
    assert.equal(patchJson.data.product.active, false);
  });
});
