import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { MongoService } from '../src/services/mongo.js';
import { AdminAnalyticsService } from '../src/services/adminAnalyticsService.js';
import { SorobanService } from '../src/services/soroban.js';
import { TreasuryService } from '../src/services/treasuryService.js';
import { PortfolioService } from '../src/services/portfolioService.js';
import { RedisCacheService } from '../src/services/redis.js';
import { signToken } from '../src/services/jwt.js';
import { adminRouter } from '../src/routes/admin.js';
import { analyticsRouter } from '../src/routes/analytics.js';
import type { AdminAnalyticsGranularity, AdminAnalyticsRangeKey } from '../src/types/index.js';

describe('Suite: Admin Analytics, Performance & Security', () => {
  let server: http.Server;
  let port: number;
  let adminToken: string;
  let userToken: string;

  before(async () => {
    await MongoService.getClient();
    adminToken = signToken({ id: 'admin_test_analytics', email: 'admin@nexusrail.com', role: 'admin' });
    userToken = signToken({ id: 'user_test_analytics', email: 'user@nexusrail.com', role: 'user' });

    const app = express();
    app.use(express.json());
    app.use('/api/v1/admin', adminRouter);
    app.use('/api/v1/analytics', analyticsRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    RedisCacheService.stopPruning();
    await MongoService.close();
  });

  it('AdminAnalyticsService.getAnalytics computes consistent real metrics across all ranges and granularities', async () => {
    const cases: Array<{ range: AdminAnalyticsRangeKey; granularity?: AdminAnalyticsGranularity }> = [
      { range: '7d', granularity: 'day' },
      { range: '30d', granularity: 'day' },
      { range: '90d', granularity: 'week' },
      { range: '1y', granularity: 'month' },
      { range: 'all', granularity: 'month' },
    ];

    for (const c of cases) {
      const data = await AdminAnalyticsService.getAnalytics({
        range: c.range,
        granularity: c.granularity,
        forceRefresh: true,
      });

      assert.equal(data.range.key, c.range);
      assert.equal(data.range.granularity, c.granularity);
      assert.ok(Array.isArray(data.series));
      assert.ok(data.overview.totalUsers >= data.overview.newUsers);
      assert.ok(data.overview.totalOrders >= data.overview.settledOrders);
      assert.equal(
        data.overview.ownerProfitCents + data.overview.nrPoolInjectedCents - data.overview.revenueCents,
        data.overview.zeroSumDifferenceCents
      );
      assert.equal(data.overview.zeroSumDifferenceCents, 0, `Zero-sum invariant failed for range=${c.range}`);
      assert.equal(data.overview.isBalanced, true);
      assert.ok(data.overview.ownerProfitCents <= data.overview.revenueCents);
      assert.ok(Array.isArray(data.dataQuality.unavailableMetrics) && data.dataQuality.unavailableMetrics.length > 0);
    }

    // Verify lifetime aggregates are at least as large as any bounded range
    const allTime = await AdminAnalyticsService.getAnalytics({ range: 'all', forceRefresh: false });
    const week = await AdminAnalyticsService.getAnalytics({ range: '7d', forceRefresh: false });
    assert.ok(allTime.lifetime.totalOrders >= week.overview.totalOrders);
    assert.ok(allTime.lifetime.revenueCents >= week.overview.revenueCents);
  });

  it('SorobanService.getContractMetadata returns both snake_case and camelCase contract DTO fields', async () => {
    const meta = await SorobanService.getContractMetadata();
    assert.ok(meta.contract);
    assert.equal(meta.contract.contractId, meta.contract.contract_id);
    assert.equal(meta.contract.protocolVersion, meta.contract.protocol_version);
    assert.equal(meta.contract.currentWasmHash, meta.contract.current_wasm_hash);
    assert.equal(meta.contract.feeBps, meta.contract.fee_bps);
    assert.equal(meta.contract.ownerSplitPct, meta.contract.owner_split_pct);
    assert.equal(meta.contract.treasuryAddress, meta.contract.treasury_address);
    assert.equal(meta.contract.nrReserveAddress, meta.contract.nr_reserve_address);
    assert.equal(meta.contract.explorerUrl, meta.contract.explorer_url);
  });

  it('TreasuryService.getTreasurySummary and PortfolioService.getPlatformAUC aggregate without full scans', async () => {
    const start = Date.now();
    const [summary, auc] = await Promise.all([
      TreasuryService.getTreasurySummary(),
      PortfolioService.getPlatformAUC(),
    ]);
    const elapsedMs = Date.now() - start;

    assert.equal(summary.zeroSumDifferenceCents, 0);
    assert.equal(summary.isBalanced, true);
    assert.ok(typeof summary.totalRevenueCents === 'number');
    assert.ok(typeof auc.total_custody_usd_cents === 'number');
    assert.ok(Array.isArray(auc.assets));
    assert.ok(elapsedMs < 15000, `Expected combined aggregation under 15s, got ${elapsedMs}ms`);
  });

  it('Security: analytics routes reject unauthenticated and non-admin requests and validate parameters', async () => {
    const base = `http://localhost:${port}`;

    const unauthAnalytics = await fetch(`${base}/api/v1/admin/analytics`);
    assert.equal(unauthAnalytics.status, 401);

    const unauthSummary = await fetch(`${base}/api/v1/analytics/summary`);
    assert.equal(unauthSummary.status, 401);

    const userAnalytics = await fetch(`${base}/api/v1/admin/analytics`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(userAnalytics.status, 403);

    const userSummary = await fetch(`${base}/api/v1/analytics/summary`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(userSummary.status, 403);

    const invalidQuery = await fetch(`${base}/api/v1/admin/analytics?range=invalid`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(invalidQuery.status, 400);

    const okAnalytics = await fetch(`${base}/api/v1/admin/analytics?range=30d&refresh=true`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(okAnalytics.status, 200);
    const analyticsJson = await okAnalytics.json();
    assert.equal(analyticsJson.success, true);
    assert.equal(analyticsJson.data.range.key, '30d');

    const okSummary = await fetch(`${base}/api/v1/analytics/summary?refresh=true`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(okSummary.status, 200);
    const summaryJson = await okSummary.json();
    assert.equal(summaryJson.success, true);
    assert.ok(typeof summaryJson.data.totalVolumeCents === 'number');
    assert.ok(typeof summaryJson.data.totalRevenueCents === 'number');
    assert.ok(typeof summaryJson.data.netOwnerProfitCents === 'number');
  });
});
