import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  MongoService,
  MongoOrderDoc,
  MongoCashbackIssuanceDoc,
  MongoGlobalSupplyReservationDoc,
} from '../src/services/mongo.js';
import {
  GlobalSupplyCoordinator,
  GlobalSupplyCapExceededError,
} from '../src/services/globalSupplyCoordinator.service.js';
import { CashbackMintService } from '../src/services/cashbackMint.service.js';
import { CashbackMintWorker } from '../src/workers/cashbackMintWorker.js';
import { DualRailTokenService } from '../src/services/dualRailToken.service.js';
import { SorobanService } from '../src/services/soroban.js';

describe('Suite: Phase 2B — Direct 1:1 Dual-Chain Cashback Minting (Stellar SAC + XRPL Issuer) & Global Supply Cap', () => {
  const runId = crypto.randomBytes(4).toString('hex');
  const testUserId = `usr_p2b_${runId}`;
  const createdOrderIds: string[] = [];
  const createdOpIds: string[] = [];

  const VALID_STELLAR = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';
  const VALID_XRPL = 'r9ksrsLGVhbVeMB2fQHtBoDfDkcZ5m2Gdt';
  const STELLAR_ISSUER = 'GB24JBHL5EIZPUJPGPT67W6BDSEWY2SJU4I2UOV3RAZ4DG4HLLBJRAOZ';
  const XRPL_ISSUER = 'rfogmLyR5R2VcYsENSjqSW7iTpg9v8AbGU';

  async function seedPaidOrder(suffix: string, totalCents = 10_000): Promise<MongoOrderDoc> {
    const orderId = `ord_p2b_${suffix}_${runId}`;
    const orderNumber = `#P2B${suffix.toUpperCase()}${runId.slice(0, 4).toUpperCase()}`;
    createdOrderIds.push(orderId);
    createdOpIds.push(`cashback:${orderId}`);

    const now = new Date().toISOString();
    const doc: MongoOrderDoc = {
      id: orderId,
      user_id: testUserId,
      order_number: orderNumber,
      total_cents: totalCents,
      items: [{ sku: 'RAIL-ONE', title: 'Rail One', qty: 1, unit_price_cents: totalCents }],
      payment_rail: 'XLM',
      status: 'PAID',
      created_at: now,
      updated_at: now,
    };
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    await ordersCol.insertOne(doc);
    return doc;
  }

  before(async () => {
    await MongoService.getClient();
  });

  after(async () => {
    try {
      const ordersCol = await MongoService.getCollection('orders');
      const cbCol = await MongoService.getCollection('cashback_issuances');
      const resCol = await MongoService.getCollection('global_supply_reservations');
      if (createdOrderIds.length > 0) {
        await ordersCol.deleteMany({ id: { $in: createdOrderIds } });
        await cbCol.deleteMany({ order_id: { $in: createdOrderIds } });
      }
      if (createdOpIds.length > 0) {
        await resCol.deleteMany({ operation_id: { $in: createdOpIds } });
      }
    } catch {}
    await MongoService.close();
  });

  it('P2B.1 & P2B.2: Mints exact 1:1 cashback on Stellar SAC vs XRPL Issuer with chain-specific verification', async () => {
    const stellarOrder = await seedPaidOrder('stl', 10_000); // $100.00 -> 2% = $2.00
    const xrplOrder = await seedPaidOrder('xrp', 10_000); // $100.00 -> 2% = $2.00

    const origBaseline = GlobalSupplyCoordinator.fetchLiveSupplyBaseline;
    const origCheckStellar = DualRailTokenService.checkStellarTrustline;
    const origCheckXrpl = DualRailTokenService.checkXrplTrustline;
    const origMintStellar = SorobanService.mintNxlOnChain;
    const origMintXrpl = DualRailTokenService.mintNxlOnXrpl;

    let stellarMintCalls = 0;
    let xrplMintCalls = 0;

    GlobalSupplyCoordinator.fetchLiveSupplyBaseline = async () => ({
      stellarOnChainSupplyNxl: 1_000_001,
      xrplOnChainSupplyNxl: 500,
      effectiveGlobalCapNxl: 2_000_000,
    });
    DualRailTokenService.checkStellarTrustline = async () => ({
      hasTrustline: true,
      isValidAddress: true,
      account: VALID_STELLAR,
      assetCode: 'NXL',
      issuer: STELLAR_ISSUER,
      balance: 0,
      limit: '1000000',
    });
    DualRailTokenService.checkXrplTrustline = async () => ({
      hasTrustline: true,
      account: VALID_XRPL,
      currency: 'NXL',
      issuer: XRPL_ISSUER,
      balance: 0,
      limit: '1000000',
    });
    SorobanService.mintNxlOnChain = async (p) => {
      stellarMintCalls++;
      assert.equal(p.reason, 'cashback');
      assert.equal(p.recipientAddress, VALID_STELLAR);
      return {
        txHash: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff66667777888899990000',
        status: 'SUCCESS',
        ledger: 5882500,
        explorerUrl: 'https://stellar.expert/explorer/testnet/tx/aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff66667777888899990000',
      };
    };
    DualRailTokenService.mintNxlOnXrpl = async (p) => {
      xrplMintCalls++;
      assert.equal(p.recipientAddress, VALID_XRPL);
      return {
        txHash: '9C0332F314B2066F6ECA9BF283D45C84B6520C35A582EAABF3FFEA0BE5622DF3',
        ledgerSeq: 22605000,
        explorerUrl: 'https://testnet.xrpl.org/transactions/9C0332F314B2066F6ECA9BF283D45C84B6520C35A582EAABF3FFEA0BE5622DF3',
        issuerAddress: XRPL_ISSUER,
      };
    };

    try {
      const stellarRes = await CashbackMintService.issueOrderCashback(stellarOrder, {
        targetChain: 'STELLAR',
        recipientAddress: VALID_STELLAR,
      });
      const xrplRes = await CashbackMintService.issueOrderCashback(xrplOrder, {
        targetChain: 'XRPL',
        recipientAddress: VALID_XRPL,
      });

      assert.equal(stellarRes.status, 'COMPLETED');
      assert.equal(stellarRes.target_chain, 'STELLAR');
      assert.equal(stellarRes.issuer_address, STELLAR_ISSUER);
      assert.equal(stellarMintCalls, 1);

      assert.equal(xrplRes.status, 'COMPLETED');
      assert.equal(xrplRes.target_chain, 'XRPL');
      assert.equal(xrplRes.issuer_address, XRPL_ISSUER);
      assert.equal(xrplMintCalls, 1);

      // Mandatory 1:1 parity check: identical order value -> identical NXL minted on both chains
      assert.equal(
        stellarRes.cashback_nxl,
        xrplRes.cashback_nxl,
        '1 NXL on Stellar must strictly equal 1 NXL on XRPL for identical order cashback'
      );

      // Duplicate / cross-chain replay defense: trying to claim stellarOrder again on XRPL must NOT mint again
      const dupAttempt = await CashbackMintService.claimOrderCashback({
        userId: testUserId,
        orderId: stellarOrder.id,
        targetChain: 'XRPL',
        recipientAddress: VALID_XRPL,
      });
      assert.equal(dupAttempt.status, 'COMPLETED');
      assert.equal(dupAttempt.target_chain, 'STELLAR');
      assert.equal(xrplMintCalls, 1, 'Completed Stellar cashback must never be double-minted on XRPL');
    } finally {
      GlobalSupplyCoordinator.fetchLiveSupplyBaseline = origBaseline;
      DualRailTokenService.checkStellarTrustline = origCheckStellar;
      DualRailTokenService.checkXrplTrustline = origCheckXrpl;
      SorobanService.mintNxlOnChain = origMintStellar;
      DualRailTokenService.mintNxlOnXrpl = origMintXrpl;
    }
  });

  it('P2B.3: Unified Global Supply Coordinator blocks XRPL mint when combined Stellar + XRPL supply would exceed 2,000,000 cap', async () => {
    const capOrder = await seedPaidOrder('cap', 100_000); // $1,000 -> 2% = $20 (~20 NXL)

    const origBaseline = GlobalSupplyCoordinator.fetchLiveSupplyBaseline;
    const origCheckXrpl = DualRailTokenService.checkXrplTrustline;

    // Combined supply is 1,999,999 NXL (1,999,499 Stellar + 500 XRPL) -> only 1 NXL global headroom left!
    GlobalSupplyCoordinator.fetchLiveSupplyBaseline = async () => ({
      stellarOnChainSupplyNxl: 1_999_499,
      xrplOnChainSupplyNxl: 500,
      effectiveGlobalCapNxl: 2_000_000,
    });
    DualRailTokenService.checkXrplTrustline = async () => ({
      hasTrustline: true,
      account: VALID_XRPL,
      currency: 'NXL',
      issuer: XRPL_ISSUER,
      balance: 0,
      limit: '1000000',
    });

    try {
      await assert.rejects(
        () =>
          CashbackMintService.issueOrderCashback(capOrder, {
            targetChain: 'XRPL',
            recipientAddress: VALID_XRPL,
          }),
        (err: any) => {
          assert.ok(err instanceof GlobalSupplyCapExceededError);
          assert.match(err.message, /Global \$NXL supply cap exceeded/i);
          return true;
        }
      );
    } finally {
      GlobalSupplyCoordinator.fetchLiveSupplyBaseline = origBaseline;
      DualRailTokenService.checkXrplTrustline = origCheckXrpl;
    }
  });

  it('P2B.4: Missing trustline parks cleanly in AWAITING_TRUSTLINE with zero mint, then claim succeeds once trustline is enabled', async () => {
    const tlOrder = await seedPaidOrder('tl', 5_000); // $50 -> 2% = $1

    const origBaseline = GlobalSupplyCoordinator.fetchLiveSupplyBaseline;
    const origCheckStellar = DualRailTokenService.checkStellarTrustline;
    const origMintStellar = SorobanService.mintNxlOnChain;

    let trustlineEnabled = false;
    let mintCount = 0;

    GlobalSupplyCoordinator.fetchLiveSupplyBaseline = async () => ({
      stellarOnChainSupplyNxl: 1_000_001,
      xrplOnChainSupplyNxl: 500,
      effectiveGlobalCapNxl: 2_000_000,
    });
    DualRailTokenService.checkStellarTrustline = async () => ({
      hasTrustline: trustlineEnabled,
      isValidAddress: true,
      account: VALID_STELLAR,
      assetCode: 'NXL',
      issuer: STELLAR_ISSUER,
      balance: 0,
      limit: trustlineEnabled ? '1000000' : '0',
    });
    SorobanService.mintNxlOnChain = async () => {
      mintCount++;
      return {
        txHash: 'bbbb2222cccc3333dddd4444eeee5555ffff66667777888899990000aaaa1111',
        status: 'SUCCESS',
        ledger: 5882600,
        explorerUrl: 'https://stellar.expert/explorer/testnet/tx/bbbb2222cccc3333dddd4444eeee5555ffff66667777888899990000aaaa1111',
      };
    };

    try {
      const parked = await CashbackMintService.issueOrderCashback(tlOrder, {
        targetChain: 'STELLAR',
        recipientAddress: VALID_STELLAR,
      });
      assert.equal(parked.status, 'AWAITING_TRUSTLINE');
      assert.equal(mintCount, 0);

      // User adds trustline and claims cashback
      trustlineEnabled = true;
      const claimed = await CashbackMintService.claimOrderCashback({
        userId: testUserId,
        orderId: tlOrder.id,
        targetChain: 'STELLAR',
        recipientAddress: VALID_STELLAR,
      });
      assert.equal(claimed.status, 'COMPLETED');
      assert.equal(mintCount, 1);
    } finally {
      GlobalSupplyCoordinator.fetchLiveSupplyBaseline = origBaseline;
      DualRailTokenService.checkStellarTrustline = origCheckStellar;
      SorobanService.mintNxlOnChain = origMintStellar;
    }
  });

  it('P2B.5: Transient RPC failure releases cap reservation, schedules retry, and CashbackMintWorker recovers cleanly', async () => {
    const retryOrder = await seedPaidOrder('rty', 5_000);

    const origBaseline = GlobalSupplyCoordinator.fetchLiveSupplyBaseline;
    const origCheckStellar = DualRailTokenService.checkStellarTrustline;
    const origMintStellar = SorobanService.mintNxlOnChain;

    let shouldFail = true;

    GlobalSupplyCoordinator.fetchLiveSupplyBaseline = async () => ({
      stellarOnChainSupplyNxl: 1_000_001,
      xrplOnChainSupplyNxl: 500,
      effectiveGlobalCapNxl: 2_000_000,
    });
    DualRailTokenService.checkStellarTrustline = async () => ({
      hasTrustline: true,
      isValidAddress: true,
      account: VALID_STELLAR,
      assetCode: 'NXL',
      issuer: STELLAR_ISSUER,
      balance: 0,
      limit: '1000000',
    });
    SorobanService.mintNxlOnChain = async () => {
      if (shouldFail) throw new Error('Simulated Soroban RPC transient 503');
      return {
        txHash: 'cccc3333dddd4444eeee5555ffff66667777888899990000aaaa1111bbbb2222',
        status: 'SUCCESS',
        ledger: 5882700,
        explorerUrl: 'https://stellar.expert/explorer/testnet/tx/cccc3333dddd4444eeee5555ffff66667777888899990000aaaa1111bbbb2222',
      };
    };

    try {
      const firstAttempt = await CashbackMintService.issueOrderCashback(retryOrder, {
        targetChain: 'STELLAR',
        recipientAddress: VALID_STELLAR,
      });
      assert.equal(firstAttempt.status, 'RETRY_SCHEDULED');
      assert.equal(firstAttempt.retry_count, 1);

      // Verify cap reservation was released on transient failure
      const resCol = await MongoService.getCollection<MongoGlobalSupplyReservationDoc>(
        'global_supply_reservations'
      );
      const resDoc = await resCol.findOne({ operation_id: `cashback:${retryOrder.id}` });
      assert.equal(resDoc?.status, 'RELEASED');

      // Fast-forward next_retry_at so worker picks it up immediately
      const cbCol = await MongoService.getCollection<MongoCashbackIssuanceDoc>('cashback_issuances');
      await cbCol.updateOne(
        { order_id: retryOrder.id },
        { $set: { next_retry_at: new Date(Date.now() - 1000).toISOString() } }
      );

      shouldFail = false;
      const sweep = await CashbackMintWorker.processDueRetries();
      assert.ok(sweep.completed >= 1, 'CashbackMintWorker must complete due retry');

      const recovered = await cbCol.findOne({ order_id: retryOrder.id });
      assert.equal(recovered?.status, 'COMPLETED');
      assert.equal(
        recovered?.tx_hash,
        'cccc3333dddd4444eeee5555ffff66667777888899990000aaaa1111bbbb2222'
      );
    } finally {
      GlobalSupplyCoordinator.fetchLiveSupplyBaseline = origBaseline;
      DualRailTokenService.checkStellarTrustline = origCheckStellar;
      SorobanService.mintNxlOnChain = origMintStellar;
    }
  });
});
