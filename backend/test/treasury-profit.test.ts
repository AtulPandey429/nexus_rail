import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { MongoService } from '../src/services/mongo.js';
import { TreasuryService, DEFAULT_TREASURY_CONFIG } from '../src/services/treasury.service.js';
import { SorobanService } from '../src/services/soroban.js';
import { StellarTokenIssuerService } from '../src/scripts/deployStellarNrToken.js';
import { NrTokenService } from '../src/services/nrToken.service.js';

describe('Suite: Module 4 — Platform Owner Profit Engine & Stellar Protocol 22 Smart Contract', () => {
  const testOrderId = `test_ord_${crypto.randomUUID()}`;
  const testSwapId = `test_swp_${crypto.randomUUID()}`;
  const testCashoutId = `test_csh_${crypto.randomUUID()}`;

  before(async () => {
    // Ensure DB connection and collections initialized
    await MongoService.getClient();
    await TreasuryService.getConfig();
    await NrTokenService.ensureGenesisPool();
    await SorobanService.ensureGenesisContract();
    await StellarTokenIssuerService.getOnChainTokenDetails();
  });

  after(async () => {
    try {
      const treasuryCol = await MongoService.getCollection('platform_treasury');
      await treasuryCol.deleteMany({
        reference_id: { $in: [testOrderId, testSwapId, testCashoutId] },
      });
    } catch {}
    await MongoService.close();
  });

  it('T4.1: Split Precision: 50/50 profit & buyback split has zero rounding leaks on both even and odd amounts', async () => {
    // Even amount: $10.00 gross -> 100 bps = $0.10 fee -> 5c owner, 5c pool
    const evenRes = await TreasuryService.recordRevenueEvent({
      sourceType: 'ORDER',
      referenceId: testOrderId,
      grossCents: 1000,
      feeCents: 10,
      gasArbitrageCents: 10, // $0.10 flat gas surplus
      rail: 'STELLAR',
    });

    assert.equal(evenRes.isDuplicate, false);
    assert.equal(evenRes.entry.total_revenue_cents, 20); // 10 fee + 10 gas
    assert.equal(evenRes.entry.net_owner_profit_cents, 10); // 50% of 20
    assert.equal(evenRes.entry.nr_pool_injected_cents, 10); // 50% of 20
    assert.equal(
      evenRes.entry.net_owner_profit_cents + evenRes.entry.nr_pool_injected_cents,
      evenRes.entry.total_revenue_cents
    );

    // Odd amount: $13.37 fee
    const oddRes = await TreasuryService.recordRevenueEvent({
      sourceType: 'SWAP',
      referenceId: testSwapId,
      grossCents: 5000,
      spreadCents: 13,
      rail: 'INTERNAL',
    });

    assert.equal(oddRes.isDuplicate, false);
    assert.equal(oddRes.entry.total_revenue_cents, 13);
    assert.equal(oddRes.entry.net_owner_profit_cents, 7); // ceil(13 * 0.5) = 7
    assert.equal(oddRes.entry.nr_pool_injected_cents, 6); // 13 - 7 = 6
    assert.equal(
      oddRes.entry.net_owner_profit_cents + oddRes.entry.nr_pool_injected_cents,
      oddRes.entry.total_revenue_cents
    );
  });

  it('T4.2: Strict Idempotency Defense: Replaying identical revenue event returns existing entry without double-counting', async () => {
    const replay = await TreasuryService.recordRevenueEvent({
      sourceType: 'ORDER',
      referenceId: testOrderId,
      grossCents: 1000,
      feeCents: 10,
      gasArbitrageCents: 10,
      rail: 'STELLAR',
    });

    assert.equal(replay.isDuplicate, true);
    assert.equal(replay.entry.reference_id, testOrderId);
  });

  it('T4.3: Double-Entry Zero-Sum Invariant: getTreasurySummary proves balanced ledger ($0.00 difference)', async () => {
    const summary = await TreasuryService.getTreasurySummary();
    assert.ok(summary.totalGrossVolumeCents > 0);
    assert.ok(summary.totalRevenueCents > 0);
    assert.equal(summary.zeroSumDifferenceCents, 0, 'Zero-sum difference must be strictly $0.00');
    assert.equal(summary.isBalanced, true);
    assert.equal(summary.netOwnerProfitCents + summary.nrPoolInjectedCents, summary.totalRevenueCents);
  });

  it('T4.4: $NR Pool Backing Injection: Cashout spread injection expands token reserve backing', async () => {
    const poolBefore = await NrTokenService.getPoolStats();

    const cashoutRes = await TreasuryService.recordRevenueEvent({
      sourceType: 'SELL_SPREAD',
      referenceId: testCashoutId,
      grossCents: 10000,
      spreadCents: 50, // 50 bps spread = $0.50
      rail: 'INTERNAL',
    });

    assert.equal(cashoutRes.isDuplicate, false);
    assert.equal(cashoutRes.entry.nr_pool_injected_cents, 25);

    const poolAfter = await NrTokenService.getPoolStats();
    assert.ok(
      poolAfter.reserveUsdCents >= poolBefore.reserveUsdCents + 25,
      `Expected pool reserve >= ${poolBefore.reserveUsdCents + 25}, got ${poolAfter.reserveUsdCents}`
    );
  });

  it('T4.5: Dynamic Runtime Config: updateConfig validates safety bounds and persists parameters', async () => {
    // 1. Valid update
    const updated = await TreasuryService.updateConfig({ order_fee_bps: 120, swap_spread_bps: 60 });
    assert.equal(updated.order_fee_bps, 120);
    assert.equal(updated.swap_spread_bps, 60);

    // 2. Reject out-of-bounds fee > 500 bps
    await assert.rejects(
      async () => {
        await TreasuryService.updateConfig({ order_fee_bps: 600 });
      },
      /Order fee must be between 0 and 500 bps/
    );

    // Revert back to 100 bps
    await TreasuryService.updateConfig({ order_fee_bps: 100, swap_spread_bps: 50 });
  });

  it('T4.6: Stellar Protocol 22 RPC Telemetry: getStellarRpcHealth reports Protocol Version 22', async () => {
    const health = await SorobanService.getStellarRpcHealth();
    assert.ok(['HEALTHY', 'DEGRADED', 'OFFLINE'].includes(health.status));
    assert.ok(health.protocolVersion >= 22, `Expected Protocol >= 22, got ${health.protocolVersion}`);
    assert.ok(health.latencyMs >= 0);
  });

  it('T4.7: Contract In-Place Upgradeability: Upgrades preserve identical Contract ID and append to audit history', async () => {
    const initial = await SorobanService.getContractMetadata();
    const contractId = initial.contract.contract_id;

    const newWasm = 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef';
    const upgraded = await SorobanService.recordContractUpgrade(
      contractId,
      newWasm,
      'admin_test_uuid',
      'tx_test_upgrade_1',
      'Test in-place upgrade'
    );

    // Contract ID must NEVER change
    assert.equal(upgraded.contract_id, contractId);
    assert.equal(upgraded.current_wasm_hash, newWasm);
    assert.ok(upgraded.upgrades.length >= 2);
    const lastUpgrade = upgraded.upgrades[upgraded.upgrades.length - 1];
    assert.equal(lastUpgrade.wasm_hash, newWasm);
    assert.equal(lastUpgrade.protocol_version, 22);
  });

  it('T4.8: On-Chain $NR Token & External Withdrawal: withdrawNrToExternalAddress creates confirmed transaction log', async () => {
    const token = await StellarTokenIssuerService.getOnChainTokenDetails();
    assert.equal(token.symbol, 'NXL');
    assert.equal(token.chain, 'STELLAR');
    assert.equal(token.total_supply_cap, 2_000_000);

    const validDest = 'GBZ42O4WJ45353I4V32B4N5M6K7L8J9H0G1F2E3D4C5B6A7Z8Y9X0W1V';
    const withdrawal = await StellarTokenIssuerService.withdrawNrToExternalAddress(
      'user_test_uuid',
      25,
      validDest
    );

    assert.equal(withdrawal.amount_nr, 25);
    assert.equal(withdrawal.destination_stellar_address, validDest);
    assert.equal(withdrawal.status, 'CONFIRMED');
    assert.ok(withdrawal.tx_hash.startsWith('tx_wd_'));
  });
});
