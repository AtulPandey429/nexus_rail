import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import crypto from 'crypto';
import express from 'express';
import {
  SupplyReconciliationService,
  CANONICAL_MAX_SUPPLY_NXL,
} from '../src/services/supplyReconciliation.service.js';
import { DualRailTokenService, TOTAL_SUPPLY_CAP } from '../src/services/dualRailToken.service.js';
import { NrTokenService, TOTAL_SUPPLY_NR_MICRO, NR_MICRO_SCALE } from '../src/services/nrToken.service.js';
import { StellarTokenIssuerService, NR_TOTAL_ON_CHAIN_CAP } from '../src/scripts/deployStellarNrToken.js';
import { CryptoController } from '../src/controllers/crypto.controller.js';
import { adminRouter } from '../src/routes/admin.routes.js';
import { walletService } from '../src/services/wallet.js';
import { signToken } from '../src/services/jwt.js';
import { MongoService } from '../src/services/mongo.js';

describe('Suite: Phase 2 — $NXL Supply Accounting, Core Security, Concurrency & Reconciliation', () => {
  const stamp = Date.now();
  const testUserId = `usr_p2_sec_${stamp}`;
  const testAdminId = `adm_p2_sec_${stamp}`;
  const createdSwapIds: string[] = [];
  let server: http.Server;
  let baseUrl: string;
  let userToken: string;
  let adminToken: string;

  before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key-32-chars-long!';
    userToken = signToken({ id: testUserId, email: 'user@nexusrail.test', role: 'user' });
    adminToken = signToken({ id: testAdminId, email: 'admin@nexusrail.test', role: 'admin' });

    await MongoService.getClient();

    const app = express();
    app.use(express.json());
    app.post('/api/v1/crypto/nr/withdraw', CryptoController.withdrawToken);
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
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    try {
      const balancesCol = await MongoService.getCollection('wallet_balances');
      const ledgerCol = await MongoService.getCollection('wallet_ledger');
      const withdrawalsCol = await MongoService.getCollection('token_withdrawals');
      const swapsCol = await MongoService.getCollection('swaps');
      const treasuryCol = await MongoService.getCollection('platform_treasury');

      await balancesCol.deleteMany({ user_id: testUserId });
      await ledgerCol.deleteMany({ user_id: testUserId });
      await withdrawalsCol.deleteMany({ user_id: testUserId });
      if (createdSwapIds.length > 0) {
        await swapsCol.deleteMany({ swapId: { $in: createdSwapIds } });
        await treasuryCol.deleteMany({ reference_id: { $in: createdSwapIds } });
      }
    } catch {}
    await MongoService.close();
  });

  it('P2.1 (D1 Option A): Standardizes canonical maximum supply at 2,000,000 NXL across all services and DB docs', async () => {
    assert.equal(CANONICAL_MAX_SUPPLY_NXL, 2_000_000);
    assert.equal(TOTAL_SUPPLY_CAP, 2_000_000);
    assert.equal(NR_TOTAL_ON_CHAIN_CAP, 2_000_000);
    assert.equal(TOTAL_SUPPLY_NR_MICRO, 2_000_000 * NR_MICRO_SCALE);

    const tokenDoc = await StellarTokenIssuerService.getOnChainTokenDetails();
    assert.equal(tokenDoc.total_supply_cap, 2_000_000);

    const poolStats = await NrTokenService.getPoolStats();
    assert.equal(poolStats.totalSupplyNr, 2_000_000);
  });

  it('P2.2 (D1/D2/D4): SupplyReconciliationService computes full 360-degree reconciliation & detects role/collision audit flags', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/tokenomics/reconciliation?refresh=true`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const json: any = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);

    const report = json.data;
    assert.equal(report.supplyModel.canonicalMaxSupplyNxl, 2_000_000);
    assert.equal(report.supplyModel.vaultConfiguredCapNxl, 2_000_000);
    assert.ok(report.stellar.onChainTotalSupplyNxl >= 1_000_000);
    assert.equal(report.stellar.isExactStroopMatch, true);
    assert.ok(
      report.stellar.userExternalCirculatingNxl < report.stellar.onChainTotalSupplyNxl,
      'External user circulating supply must exclude protocol Treasury and AMM pool reserves'
    );
    assert.equal(report.internalLedger.isFullyBacked, true);
    assert.equal(report.contractAndRoleAudit.storageCompatibility.v2StorageKeysIntact, true);
    assert.equal(report.contractAndRoleAudit.storageCompatibility.readyForInPlaceUpgrade, true);
    assert.notEqual(
      report.stellar.buybackReserveAddress,
      report.stellar.issuerAddress,
      'Isolated nr_reserve must not collide with $NXL Classic Issuer'
    );
    assert.ok(
      !report.anomalies.some((a: any) => a.code === 'NR_RESERVE_ISSUER_COLLISION'),
      'NR_RESERVE_ISSUER_COLLISION anomaly must be cleared after isolated reserve rotation'
    );
  });

  it('P2.3 (CRIT-01 & CRIT-02 Fix): Withdrawal enforces atomic debit-before-broadcast, blocks concurrent double-spend, and refunds on broadcast failure', async () => {
    const validStellar = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';
    // Seed user with exactly 100 NXL
    await walletService.creditBalance(testUserId, 100 * NR_MICRO_SCALE, 'NXL', `seed_p2_${stamp}`);

    const origCheckTl = DualRailTokenService.checkStellarTrustline;
    const origVerifyRes = SupplyReconciliationService.verifyReserveForWithdrawal;
    const origWithdrawStellar = DualRailTokenService.withdrawNrToStellarAddress;

    let broadcastCount = 0;
    DualRailTokenService.checkStellarTrustline = async () => ({
      hasTrustline: true,
      isValidAddress: true,
      account: validStellar,
      assetCode: 'NXL',
      issuer: 'GB24JBHL5EIZPUJPGPT67W6BDSEWY2SJU4I2UOV3RAZ4DG4HLLBJRAOZ',
      balance: 0,
      limit: '1000000',
    });
    SupplyReconciliationService.verifyReserveForWithdrawal = async () => ({
      availableReserveNxl: 998_000,
      reserveAddress: 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC',
    });
    DualRailTokenService.withdrawNrToStellarAddress = async () => {
      broadcastCount++;
      // Simulate network latency during broadcast
      await new Promise((r) => setTimeout(r, 80));
      return {
        txHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
        ledgerSeq: 5882100,
        explorerUrl: 'https://stellar.expert/explorer/testnet/tx/a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
      };
    };

    try {
      // Fire 2 concurrent withdrawal requests of 80 NXL each against a 100 NXL balance
      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/v1/crypto/nr/withdraw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
          body: JSON.stringify({ amount: 80, chain: 'STELLAR', destinationAddress: validStellar }),
        }).then((r) => r.json()),
        fetch(`${baseUrl}/api/v1/crypto/nr/withdraw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
          body: JSON.stringify({ amount: 80, chain: 'STELLAR', destinationAddress: validStellar }),
        }).then((r) => r.json()),
      ]);

      const successes = [res1, res2].filter((r: any) => r.success === true);
      const failures = [res1, res2].filter((r: any) => r.success === false);

      assert.equal(successes.length, 1, 'Strictly one concurrent 80 NXL withdrawal may succeed from 100 NXL balance');
      assert.equal(failures.length, 1, 'Second concurrent withdrawal must fail overdraft check');
      assert.equal(broadcastCount, 1, 'On-chain broadcast must only be called once');
      assert.ok(!successes[0].data.txHash.startsWith('tx_wd_'), 'Must never return fabricated tx_wd_* hash');

      const balAfterRace = await walletService.getBalance(testUserId);
      assert.equal(balAfterRace.NXL, 20 * NR_MICRO_SCALE, 'Remaining balance must be exactly 20 NXL');

      // Now simulate an on-chain broadcast failure for the remaining 20 NXL -> must atomically refund!
      DualRailTokenService.withdrawNrToStellarAddress = async () => {
        throw new Error('Simulated Horizon submission timeout');
      };

      const failRes: any = await fetch(`${baseUrl}/api/v1/crypto/nr/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ amount: 20, chain: 'STELLAR', destinationAddress: validStellar }),
      }).then((r) => r.json());

      assert.equal(failRes.success, false);
      assert.match(failRes.error, /timeout/i);

      const balAfterRollback = await walletService.getBalance(testUserId);
      assert.equal(
        balAfterRollback.NXL,
        20 * NR_MICRO_SCALE,
        'User internal NXL balance must be 100% refunded when on-chain broadcast fails'
      );
    } finally {
      DualRailTokenService.checkStellarTrustline = origCheckTl;
      SupplyReconciliationService.verifyReserveForWithdrawal = origVerifyRes;
      DualRailTokenService.withdrawNrToStellarAddress = origWithdrawStellar;
    }
  });

  it('P2.4 (CRIT-03 Fix): External destination swap (XRP -> NXL) delivers on-chain without double-crediting internal wallet', async () => {
    const validXrplDest = 'r9ksrsLGVhbVeMB2fQHtBoDfDkcZ5m2Gdt';
    const balBefore = await walletService.getBalance(testUserId);

    const origCheckXrplTl = DualRailTokenService.checkXrplTrustline;
    const origWithdrawXrpl = DualRailTokenService.withdrawNrToXrplAddress;

    DualRailTokenService.checkXrplTrustline = async () => ({
      hasTrustline: true,
      account: validXrplDest,
      currency: 'NXL',
      issuer: 'rfogmLyR5R2VcYsENSjqSW7iTpg9v8AbGU',
      balance: 10,
      limit: '1000000',
    });
    DualRailTokenService.withdrawNrToXrplAddress = async () => ({
      txHash: '9C0332F314B2066F6ECA9BF283D45C84B6520C35A582EAABF3FFEA0BE5622DF3',
      ledgerSeq: 22604000,
      explorerUrl: 'https://testnet.xrpl.org/transactions/9C0332F314B2066F6ECA9BF283D45C84B6520C35A582EAABF3FFEA0BE5622DF3',
    });

    try {
      const { order } = await NrTokenService.executeNrSwap({
        userId: testUserId,
        fromAsset: 'XRP',
        toAsset: 'NXL',
        amount: 5,
        depositTxHash: '111122223333444455556666777788889999AAAABBBBCCCCDDDDEEEEFFFF0000',
        userDestinationAddress: validXrplDest,
        skipDepositVerification: true,
      });
      createdSwapIds.push(order.swapId);

      assert.equal(order.status, 'COMPLETED');
      assert.equal(
        order.payoutTxHash,
        '9C0332F314B2066F6ECA9BF283D45C84B6520C35A582EAABF3FFEA0BE5622DF3'
      );

      const balAfter = await walletService.getBalance(testUserId);
      assert.equal(
        balAfter.NXL,
        balBefore.NXL,
        'Net internal NXL balance must remain unchanged when NXL is delivered on-chain to XRPL wallet (zero 2x double-crediting)'
      );
    } finally {
      DualRailTokenService.checkXrplTrustline = origCheckXrplTl;
      DualRailTokenService.withdrawNrToXrplAddress = origWithdrawXrpl;
    }
  });
});
