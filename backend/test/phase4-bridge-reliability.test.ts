import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { MongoService, MongoBridgeOperationDoc } from '../src/services/mongo.js';
import { BridgeOperationService } from '../src/services/bridgeOperation.service.js';
import { BridgeRelayerWorker } from '../src/workers/bridgeRelayerWorker.js';
import { CrossChainSwapService } from '../src/services/crossChainSwap.service.js';
import { DualRailTokenService } from '../src/services/dualRailToken.service.js';
import { GlobalSupplyCoordinator } from '../src/services/globalSupplyCoordinator.service.js';
import { SorobanService } from '../src/services/soroban.js';

describe('Suite: Phase 4 — Cross-Chain Bridge Reliability (Escrow-First, 1:1 Parity, Anti-Replay & Worker Recovery)', () => {
  const runId = crypto.randomBytes(4).toString('hex');
  const createdSwapIds: string[] = [];
  const createdOpIds: string[] = [];
  const testStellarUser = Keypair.random().publicKey();
  const testXrplUser = 'r9ksrsLGVhbVeMB2fQHtBoDfDkcZ5m2Gdt';

  const makeHex64 = (prefix: string) =>
    (prefix + crypto.randomBytes(32).toString('hex')).slice(0, 64).toUpperCase();

  before(async () => {
    await MongoService.getClient();
  });

  after(async () => {
    try {
      const bridgeCol = await MongoService.getCollection('bridge_operations');
      const resCol = await MongoService.getCollection('global_supply_reservations');
      const swapsCol = await MongoService.getCollection('swaps');
      const legacyCol = await MongoService.getCollection('swap_orders');
      if (createdSwapIds.length > 0) {
        await bridgeCol.deleteMany({ swap_id: { $in: createdSwapIds } });
        await swapsCol.deleteMany({ swapId: { $in: createdSwapIds } });
        await legacyCol.deleteMany({ swapId: { $in: createdSwapIds } });
      }
      if (createdOpIds.length > 0) {
        await resCol.deleteMany({ operation_id: { $in: createdOpIds } });
      }
    } catch {}
    await MongoService.close();
  });

  it('P4.1 (D3 Option A): Stellar -> XRPL Escrow-First bridge locks, pays XRP, releases escrow, and blocks source hash replay', async () => {
    const swapId = `BRG-P41-${runId}`;
    const replaySwapId = `BRG-P41-DUP-${runId}`;
    createdSwapIds.push(swapId, replaySwapId);

    const lockTxHash = makeHex64('A1');
    const xrplPayoutHash = makeHex64('B1');
    const releaseTxHash = makeHex64('C1');

    const origSubmit = SorobanService.submitSignedSorobanXdr;
    const origPayout = CrossChainSwapService.payoutAssetToUser;
    const origRelease = SorobanService.releaseBridgeEscrowOnChain;

    let releaseCalled = 0;
    SorobanService.submitSignedSorobanXdr = async () => ({
      txHash: lockTxHash,
      status: 'SUCCESS',
      ledger: 5920001,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${lockTxHash}`,
    });
    CrossChainSwapService.payoutAssetToUser = async () => ({
      ok: true,
      txHash: xrplPayoutHash,
      explorerUrl: `https://testnet.xrpl.org/transactions/${xrplPayoutHash}`,
    });
    SorobanService.releaseBridgeEscrowOnChain = async (p) => {
      releaseCalled++;
      assert.equal(p.xrplTxHash, xrplPayoutHash);
      return {
        txHash: releaseTxHash,
        status: 'SUCCESS',
        ledger: 5920002,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${releaseTxHash}`,
      };
    };

    try {
      const op = await BridgeOperationService.submitSorobanBridge({
        signedXdr: 'AAAA_MOCK_SIGNED_ESCROW_XDR',
        mode: 'SOROBAN_BRIDGE_ESCROW',
        swapId,
        fromAsset: 'XLM',
        toAsset: 'XRP',
        amount: 25,
        xrplDestination: testXrplUser,
        userSourceAddress: testStellarUser,
      });

      assert.equal(op.status, 'COMPLETED');
      assert.equal(op.mechanism, 'SOROBAN_ESCROW');
      assert.equal(op.source_tx_hash, lockTxHash);
      assert.equal(op.dest_tx_hash, xrplPayoutHash);
      assert.equal(op.escrow_release_tx_hash, releaseTxHash);
      assert.equal(releaseCalled, 1);

      // Replay attempt with the same Soroban lockTxHash on a different swapId MUST reject
      await assert.rejects(
        () =>
          BridgeOperationService.submitSorobanBridge({
            signedXdr: 'AAAA_MOCK_REPLAY_XDR',
            mode: 'SOROBAN_BRIDGE_ESCROW',
            swapId: replaySwapId,
            fromAsset: 'XLM',
            toAsset: 'XRP',
            amount: 25,
            xrplDestination: testXrplUser,
            userSourceAddress: testStellarUser,
          }),
        /Replay rejected/i
      );
    } finally {
      SorobanService.submitSignedSorobanXdr = origSubmit;
      CrossChainSwapService.payoutAssetToUser = origPayout;
      SorobanService.releaseBridgeEscrowOnChain = origRelease;
    }
  });

  it('P4.2 (CRIT-04): BridgeRelayerWorker recovers payout -> release without double-paying, and enables expiry self-refund when unpaid', async () => {
    const swapRecoverId = `BRG-P42-REC-${runId}`;
    const swapRefundId = `BRG-P42-REF-${runId}`;
    createdSwapIds.push(swapRecoverId, swapRefundId);

    const lockHash1 = makeHex64('A2');
    const lockHash2 = makeHex64('A3');
    const xrplHash = makeHex64('B2');
    const releaseHash = makeHex64('C2');

    const origSubmit = SorobanService.submitSignedSorobanXdr;
    const origPayout = CrossChainSwapService.payoutAssetToUser;
    const origRelease = SorobanService.releaseBridgeEscrowOnChain;
    const origBuildRefund = SorobanService.buildRefundExpiredEscrowXdr;

    let payoutCalls = 0;
    let releaseCalls = 0;

    try {
      // Phase A: Payout succeeds, but escrow release fails transiently -> DEST_VERIFIED -> RETRY_SCHEDULED
      SorobanService.submitSignedSorobanXdr = async () => ({
        txHash: lockHash1,
        status: 'SUCCESS',
        ledger: 5920010,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${lockHash1}`,
      });
      CrossChainSwapService.payoutAssetToUser = async () => {
        payoutCalls++;
        return {
          ok: true,
          txHash: xrplHash,
          explorerUrl: `https://testnet.xrpl.org/transactions/${xrplHash}`,
        };
      };
      SorobanService.releaseBridgeEscrowOnChain = async () => {
        releaseCalls++;
        throw new Error('Soroban RPC temporary 503 during release');
      };

      const opRetry = await BridgeOperationService.submitSorobanBridge({
        signedXdr: 'MOCK_XDR_REC',
        mode: 'SOROBAN_BRIDGE_ESCROW',
        swapId: swapRecoverId,
        fromAsset: 'XLM',
        toAsset: 'XRP',
        amount: 15,
        xrplDestination: testXrplUser,
        userSourceAddress: testStellarUser,
      });

      assert.equal(opRetry.status, 'RETRY_SCHEDULED');
      assert.equal(opRetry.dest_tx_hash, xrplHash);
      assert.equal(payoutCalls, 1);

      // Self-refund MUST be blocked once XRPL payout settled
      await assert.rejects(
        () =>
          BridgeOperationService.refundEscrow({
            swapId: swapRecoverId,
            callerAddress: testStellarUser,
          }),
        /already settled/i
      );

      // Make due now & restore working releaseBridgeEscrowOnChain -> Worker completes without calling payout again!
      const bridgeCol = await MongoService.getCollection<MongoBridgeOperationDoc>('bridge_operations');
      await bridgeCol.updateOne(
        { swap_id: swapRecoverId },
        { $set: { next_retry_at: new Date(Date.now() - 1000).toISOString() } }
      );

      SorobanService.releaseBridgeEscrowOnChain = async () => {
        releaseCalls++;
        return {
          txHash: releaseHash,
          status: 'SUCCESS',
          ledger: 5920012,
          explorerUrl: `https://stellar.expert/explorer/testnet/tx/${releaseHash}`,
        };
      };

      const sweepRes = await BridgeRelayerWorker.processPendingOperations();
      assert.ok(sweepRes.completed >= 1);
      assert.equal(payoutCalls, 1, 'Worker MUST NEVER re-send XRPL payout when dest_tx_hash is already saved');
      assert.equal(releaseCalls, 2);

      const finalRec = await bridgeCol.findOne({ swap_id: swapRecoverId });
      assert.equal(finalRec?.status, 'COMPLETED');
      assert.equal(finalRec?.escrow_release_tx_hash, releaseHash);

      // Phase B: Unpaid expired escrow -> worker marks REFUNDABLE -> builds unsigned refund_expired_escrow XDR
      SorobanService.submitSignedSorobanXdr = async () => ({
        txHash: lockHash2,
        status: 'SUCCESS',
        ledger: 5920020,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${lockHash2}`,
      });
      CrossChainSwapService.payoutAssetToUser = async () => ({
        ok: false,
        txHash: null,
        explorerUrl: null,
        errorMessage: 'Simulated XRPL node outage',
      });
      SorobanService.buildRefundExpiredEscrowXdr = async (p) => ({
        unsignedXdr: `UNSIGNED_REFUND_${p.swapId}`,
        minResourceFee: '100000',
        contractId: 'CCJBRAJ5JUQPMIMGHDZKGRNXRZVJU5KBU7PMNJK235ORSXUSSHCPQYAM',
        method: 'refund_expired_escrow',
      });

      const expiredTs = Math.floor(Date.now() / 1000) - 30;
      const opRef = await BridgeOperationService.submitSorobanBridge({
        signedXdr: 'MOCK_XDR_EXP',
        mode: 'SOROBAN_BRIDGE_ESCROW',
        swapId: swapRefundId,
        fromAsset: 'XLM',
        toAsset: 'XRP',
        amount: 20,
        xrplDestination: testXrplUser,
        userSourceAddress: testStellarUser,
        escrowExpiryUnixSec: expiredTs,
      });

      assert.equal(opRef.status, 'REFUNDABLE');
      const refundPrep = await BridgeOperationService.refundEscrow({
        swapId: swapRefundId,
        callerAddress: testStellarUser,
      });
      assert.equal(refundPrep.mode, 'UNSIGNED_XDR');
      assert.equal(refundPrep.unsignedXdr, `UNSIGNED_REFUND_${swapRefundId}`);
    } finally {
      SorobanService.submitSignedSorobanXdr = origSubmit;
      CrossChainSwapService.payoutAssetToUser = origPayout;
      SorobanService.releaseBridgeEscrowOnChain = origRelease;
      SorobanService.buildRefundExpiredEscrowXdr = origBuildRefund;
    }
  });

  it('P4.3 (1:1 $NXL Bridge Parity): Stellar->XRPL burn-and-mint parks AWAITING_TRUSTLINE then mints 1:1, and XRPL->Stellar mints 1:1 under global cap', async () => {
    const outSwapId = `BRN-NXL-OUT-${runId}`;
    const inSwapId = `BRG-NXL-IN-${runId}`;
    createdSwapIds.push(outSwapId, inSwapId);
    createdOpIds.push(`bridge_out_xrpl_${outSwapId}`, `bridge_in_stellar_${inSwapId}`);

    const burnHash = makeHex64('D1');
    const xrplMintHash = makeHex64('E1');
    const xrplDepositHash = makeHex64('F1');
    const stellarMintHash = makeHex64('1A');

    const origSubmit = SorobanService.submitSignedSorobanXdr;
    const origCheckXrpl = DualRailTokenService.checkXrplTrustline;
    const origMintXrpl = DualRailTokenService.mintNxlOnXrpl;
    const origVerify = CrossChainSwapService.verifyOnChainDeposit;
    const origCheckStellar = DualRailTokenService.checkStellarTrustline;
    const origMintStellar = SorobanService.mintNxlOnChain;
    const origBaseline = GlobalSupplyCoordinator.fetchLiveSupplyBaseline;

    let xrplTrustReady = false;
    GlobalSupplyCoordinator.fetchLiveSupplyBaseline = async () => ({
      stellarOnChainSupplyNxl: 1_000_000,
      xrplOnChainSupplyNxl: 500,
      effectiveGlobalCapNxl: 2_000_000,
    });
    SorobanService.submitSignedSorobanXdr = async () => ({
      txHash: burnHash,
      status: 'SUCCESS',
      ledger: 5920030,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${burnHash}`,
    });
    DualRailTokenService.checkXrplTrustline = async (acct) => ({
      hasTrustline: xrplTrustReady,
      account: acct,
      currency: 'NXL',
      issuer: 'rfogmLyR5R2VcYsENSjqSW7iTpg9v8AbGU',
      balance: 0,
      limit: xrplTrustReady ? '1000000' : '0',
    });
    DualRailTokenService.mintNxlOnXrpl = async (p) => {
      assert.equal(p.amountNxl, 25);
      return {
        txHash: xrplMintHash,
        ledgerSeq: 22610000,
        explorerUrl: `https://testnet.xrpl.org/transactions/${xrplMintHash}`,
        issuerAddress: 'rfogmLyR5R2VcYsENSjqSW7iTpg9v8AbGU',
      };
    };

    CrossChainSwapService.verifyOnChainDeposit = async (asset) => {
      assert.equal(asset, 'NXL_XRPL');
      return {
        status: 'SUCCESS',
        txHash: xrplDepositHash,
        explorerUrl: `https://testnet.xrpl.org/transactions/${xrplDepositHash}`,
        verifiedDetails: {
          destination: CrossChainSwapService.getXrplPlatformAddress(),
          sourceAccount: testXrplUser,
          amount: 25,
          assetCode: 'NXL',
          validated: true,
        },
      };
    };
    DualRailTokenService.checkStellarTrustline = async (acct) => ({
      hasTrustline: true,
      isValidAddress: true,
      account: acct,
      assetCode: 'NXL',
      issuer: 'GB24JBHL5EIZPUJPGPT67W6BDSEWY2SJU4I2UOV3RAZ4DG4HLLBJRAOZ',
      balance: 0,
      limit: '1000000',
    });
    SorobanService.mintNxlOnChain = async (p) => {
      assert.equal(p.amountNxl, 25);
      assert.equal(p.reason, 'bridge');
      return {
        txHash: stellarMintHash,
        status: 'SUCCESS',
        ledger: 5920035,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${stellarMintHash}`,
      };
    };

    try {
      // 1. Stellar -> XRPL missing trustline -> AWAITING_TRUSTLINE
      const parked = await BridgeOperationService.submitSorobanBridge({
        signedXdr: 'MOCK_BURN_BRIDGE_XDR',
        mode: 'SOROBAN_BRIDGE_NXL',
        swapId: outSwapId,
        fromAsset: 'NXL',
        toAsset: 'NXL',
        amount: 25,
        xrplDestination: testXrplUser,
        userSourceAddress: testStellarUser,
      });
      assert.equal(parked.status, 'AWAITING_TRUSTLINE');
      assert.equal(parked.to_amount, 25);
      assert.equal(parked.exchange_rate, 1);

      // User adds XRPL trustline and claims -> mints 25 NXL 1:1
      xrplTrustReady = true;
      const resumed = await BridgeOperationService.processBridgeOperation(outSwapId);
      assert.equal(resumed.status, 'COMPLETED');
      assert.equal(resumed.dest_tx_hash, xrplMintHash);

      // 2. XRPL -> Stellar 25 NXL -> mints 25 NXL on Stellar
      const inbound = await BridgeOperationService.executeXrplToStellarBridge({
        swapId: inSwapId,
        fromAsset: 'NXL',
        toAsset: 'NXL',
        amount: 25,
        destinationAddress: testStellarUser,
        sourceTxHash: xrplDepositHash,
      });
      assert.equal(inbound.status, 'COMPLETED');
      assert.equal(inbound.to_amount, 25);
      assert.equal(inbound.exchange_rate, 1);
      assert.equal(inbound.dest_tx_hash, stellarMintHash);
    } finally {
      SorobanService.submitSignedSorobanXdr = origSubmit;
      DualRailTokenService.checkXrplTrustline = origCheckXrpl;
      DualRailTokenService.mintNxlOnXrpl = origMintXrpl;
      CrossChainSwapService.verifyOnChainDeposit = origVerify;
      DualRailTokenService.checkStellarTrustline = origCheckStellar;
      SorobanService.mintNxlOnChain = origMintStellar;
      GlobalSupplyCoordinator.fetchLiveSupplyBaseline = origBaseline;
    }
  });

  it('P4.4: Anti-Replay blocks duplicate source tx across swaps/bridges & migrateLegacySwapOrders consolidates swap_orders', async () => {
    const swapA = `SWAP-REP-A-${runId}`;
    const swapB = `SWAP-REP-B-${runId}`;
    const legacyId = `LEGACY-${runId}`;
    createdSwapIds.push(swapA, swapB, legacyId);

    const dupHash = makeHex64('99');
    const swapsCol = await MongoService.getCollection<any>('swaps');
    const legacyCol = await MongoService.getCollection<any>('swap_orders');

    await swapsCol.insertOne({
      swapId: swapA,
      fromAsset: 'XRP',
      toAsset: 'XLM',
      payAmount: 10,
      receiveAmount: 50,
      status: 'COMPLETED',
      depositTxHash: dupHash,
      createdAt: new Date().toISOString(),
    });

    await assert.rejects(
      () => CrossChainSwapService.assertDepositHashNotReplayed(dupHash, swapB),
      /Replay rejected/i
    );

    // Legacy `swap_orders` consolidation check
    await legacyCol.insertOne({
      swapId: legacyId,
      fromAsset: 'XRP',
      toAsset: 'NXL',
      payAmount: 5,
      receiveAmount: 10,
      status: 'AWAITING_TRUSTLINE',
      createdAt: new Date().toISOString(),
    });

    const migrated = await CrossChainSwapService.migrateLegacySwapOrders();
    assert.ok(migrated >= 1);
    const copied = await swapsCol.findOne({ swapId: legacyId });
    assert.equal(copied?.status, 'AWAITING_TRUSTLINE');
  });

  it('P4.5: Hot wallet & Soroban secrets resolve seamlessly from encrypted MongoDB Vault even when env vars are unset', async () => {
    const { env } = await import('../src/config/env.js');
    const { VaultEncryptionService } = await import('../src/services/vaultEncryption.service.js');

    const prevXrplSeed = env.XRPL_HOT_WALLET_SEED;
    const prevStellarSec = env.STELLAR_HOT_WALLET_SECRET;
    const prevProcXrpl = process.env.XRPL_HOT_WALLET_SEED;
    const prevProcStellar = process.env.STELLAR_HOT_WALLET_SECRET;

    // Clear runtime env vars to simulate hosted environment relying on encrypted MongoDB vault
    env.XRPL_HOT_WALLET_SEED = undefined;
    env.STELLAR_HOT_WALLET_SECRET = undefined;
    delete process.env.XRPL_HOT_WALLET_SEED;
    delete process.env.STELLAR_HOT_WALLET_SECRET;

    try {
      const resolvedXrpl = await (DualRailTokenService as any).resolveXrplHotWalletSeed();
      assert.ok(resolvedXrpl && resolvedXrpl.startsWith('s'), 'XRPL hot wallet seed must resolve from DB vault');

      const resolvedStellarKp = await (SorobanService as any).resolveAdminKeypair();
      assert.ok(resolvedStellarKp.publicKey().startsWith('G'), 'Stellar hot wallet keypair must resolve from DB vault');

      await VaultEncryptionService.hydrateRuntimeEnvSecrets();
      assert.equal(env.XRPL_HOT_WALLET_SEED, resolvedXrpl, 'hydrateRuntimeEnvSecrets must populate env.XRPL_HOT_WALLET_SEED');
      assert.ok(env.STELLAR_HOT_WALLET_SECRET?.startsWith('S'), 'hydrateRuntimeEnvSecrets must populate env.STELLAR_HOT_WALLET_SECRET');
    } finally {
      env.XRPL_HOT_WALLET_SEED = prevXrplSeed;
      env.STELLAR_HOT_WALLET_SECRET = prevStellarSec;
      if (prevProcXrpl !== undefined) process.env.XRPL_HOT_WALLET_SEED = prevProcXrpl;
      if (prevProcStellar !== undefined) process.env.STELLAR_HOT_WALLET_SECRET = prevProcStellar;
    }
  });
});
