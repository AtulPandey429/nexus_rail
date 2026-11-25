import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import {
  isRealOnChainTxHash,
  sanitizeOnChainTxHash,
  buildExplorerTxUrl,
  deriveFallbackLegs,
  classifySwapKind,
} from '../src/utils/swapTransactions.js';
import { NrTokenService } from '../src/services/nrToken.service.js';
import { CrossChainSwapService } from '../src/services/crossChainSwap.service.js';
import { MongoService } from '../src/services/mongo.js';

describe('Suite: Swap Transaction Integrity & Zero Fake Hashes', () => {
  const stamp = Date.now();
  const testUserId = `usr_swap_integrity_${stamp}`;
  const createdSwapIds: string[] = [];

  after(async () => {
    try {
      const swapsCol = await MongoService.getCollection('swaps');
      const balancesCol = await MongoService.getCollection('wallet_balances');
      const ledgerCol = await MongoService.getCollection('wallet_ledger');
      const treasuryCol = await MongoService.getCollection('platform_treasury');

      if (createdSwapIds.length > 0) {
        await swapsCol.deleteMany({ swapId: { $in: createdSwapIds } });
        await treasuryCol.deleteMany({ reference_id: { $in: createdSwapIds } });
      }
      await balancesCol.deleteMany({ user_id: testUserId });
      await ledgerCol.deleteMany({ user_id: testUserId });
    } catch {}
    await MongoService.close();
  });

  it('rejects synthetic/fake tx hashes and accepts only 64-hex on-chain hashes', () => {
    assert.equal(isRealOnChainTxHash('nr_ledger_out_c4b7ab9b58a227547a8cb54d'), false);
    assert.equal(isRealOnChainTxHash('nr_ledger_in_1234567890abcdef12345678'), false);
    assert.equal(isRealOnChainTxHash('stellar_payout_abcdef1234567890abcdef1234567890'), false);
    assert.equal(isRealOnChainTxHash('xrpl_payout_abcdef1234567890abcdef1234567890'), false);
    assert.equal(isRealOnChainTxHash('JE-NR-1552'), false);
    assert.equal(isRealOnChainTxHash(null), false);

    const realXrplHash = '9C0332F314B2066F6ECA9BF283D45C84B6520C35A582EAABF3FFEA0BE5622DF3';
    assert.equal(isRealOnChainTxHash(realXrplHash), true);
    assert.equal(sanitizeOnChainTxHash(`  ${realXrplHash}  `), realXrplHash);
    assert.equal(
      buildExplorerTxUrl('XRPL', realXrplHash),
      `https://testnet.xrpl.org/transactions/${realXrplHash}`
    );
    assert.equal(buildExplorerTxUrl('INTERNAL_LEDGER', realXrplHash), null);
    assert.equal(buildExplorerTxUrl('XRPL', 'nr_ledger_out_c4b7ab9b58a227547a8cb54d'), null);
  });

  it('deriveFallbackLegs strips legacy fake hashes from old swap records', () => {
    const legs = deriveFallbackLegs({
      fromAsset: 'XRP',
      toAsset: 'USD',
      payAmount: 10,
      receiveAmount: 8.94,
      depositTxHash: '9C0332F314B2066F6ECA9BF283D45C84B6520C35A582EAABF3FFEA0BE5622DF3',
      payoutTxHash: 'nr_ledger_out_c4b7ab9b58a227547a8cb54d',
      status: 'COMPLETED',
      journalEntry: 'JE-NR-1552',
    });

    assert.equal(legs.length, 2);
    assert.equal(legs[0].direction, 'INCOMING');
    assert.equal(legs[0].rail, 'XRPL');
    assert.equal(legs[0].txHash, '9C0332F314B2066F6ECA9BF283D45C84B6520C35A582EAABF3FFEA0BE5622DF3');
    assert.ok(legs[0].explorerUrl?.includes('testnet.xrpl.org'));

    assert.equal(legs[1].direction, 'OUTGOING');
    assert.equal(legs[1].rail, 'INTERNAL_LEDGER');
    assert.equal(legs[1].txHash, null);
    assert.equal(legs[1].explorerUrl, null);
    assert.equal(legs[1].ledgerRef, 'JE-NR-1552');
  });

  it('classifySwapKind distinguishes same-chain swaps from cross-chain bridges even when FAILED', () => {
    const sameChainXrplFailed = classifySwapKind({
      fromAsset: 'XRP',
      toAsset: 'NXL',
      userDestinationAddress: 'r9ksrsLGVhbVeMB2fQHtBoDfDkcZ5m2Gdt',
      settlementType: 'FAILED',
    });
    assert.equal(sameChainXrplFailed.swapKind, 'SAME_CHAIN');
    assert.equal(sameChainXrplFailed.isCrossChain, false);
    assert.equal(sameChainXrplFailed.fromRail, 'XRPL');
    assert.equal(sameChainXrplFailed.toRail, 'XRPL');

    const sameChainStellar = classifySwapKind({
      fromAsset: 'XLM',
      toAsset: 'NXL',
      userDestinationAddress: 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR',
      settlementType: 'ON_CHAIN',
    });
    assert.equal(sameChainStellar.swapKind, 'SAME_CHAIN');
    assert.equal(sameChainStellar.isCrossChain, false);

    const crossChainXrpToXlm = classifySwapKind({
      fromAsset: 'XRP',
      toAsset: 'XLM',
      userDestinationAddress: 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR',
      settlementType: 'ON_CHAIN',
    });
    assert.equal(crossChainXrpToXlm.swapKind, 'CROSS_CHAIN');
    assert.equal(crossChainXrpToXlm.isCrossChain, true);

    const crossChainXrpToStellarNxl = classifySwapKind({
      fromAsset: 'XRP',
      toAsset: 'NXL',
      userDestinationAddress: 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR',
      settlementType: 'FAILED',
    });
    assert.equal(crossChainXrpToStellarNxl.swapKind, 'CROSS_CHAIN');
    assert.equal(crossChainXrpToStellarNxl.isCrossChain, true);

    const internalSwap = classifySwapKind({
      fromAsset: 'XRP',
      toAsset: 'USD',
      settlementType: 'INTERNAL_LEDGER',
    });
    assert.equal(internalSwap.swapKind, 'INTERNAL_LEDGER');
    assert.equal(internalSwap.isCrossChain, false);
  });

  it('XRP -> USD produces NO fake payoutTxHash, sets INTERNAL_LEDGER, records sequential legs, and persists in MongoDB', async () => {
    const realDepositHash = '9C0332F314B2066F6ECA9BF283D45C84B6520C35A582EAABF3FFEA0BE5622DF3';
    const { order } = await NrTokenService.executeNrSwap({
      userId: testUserId,
      fromAsset: 'XRP',
      toAsset: 'USD',
      amount: 10,
      depositTxHash: realDepositHash,
      skipDepositVerification: true,
    });
    createdSwapIds.push(order.swapId);

    assert.equal(order.status, 'COMPLETED');
    assert.equal(order.settlementType, 'INTERNAL_LEDGER');
    assert.equal(order.depositTxHash, realDepositHash);
    assert.ok(order.depositExplorerUrl?.includes(realDepositHash));
    assert.equal(order.payoutTxHash, undefined);
    assert.equal(order.payoutExplorerUrl, undefined);
    assert.ok((order.updatedUsdBalanceCents || 0) > 0);

    assert.ok(Array.isArray(order.transactions));
    assert.equal(order.transactions.length, 2);
    assert.equal(order.transactions[0].sequence, 1);
    assert.equal(order.transactions[0].direction, 'INCOMING');
    assert.equal(order.transactions[0].status, 'SUCCESS');
    assert.equal(order.transactions[0].txHash, realDepositHash);

    assert.equal(order.transactions[1].sequence, 2);
    assert.equal(order.transactions[1].direction, 'OUTGOING');
    assert.equal(order.transactions[1].rail, 'INTERNAL_LEDGER');
    assert.equal(order.transactions[1].status, 'SUCCESS');
    assert.equal(order.transactions[1].txHash, null);
    assert.equal(order.transactions[1].explorerUrl, null);
    assert.ok(order.transactions[1].ledgerRef);

    const persisted = await NrTokenService.getNrSwapOrder(order.swapId);
    assert.ok(persisted);
    assert.equal(persisted.settlementType, 'INTERNAL_LEDGER');
    assert.equal(persisted.payoutTxHash, undefined);
  });

  it('rejects an on-chain FAILED deposit without crediting USD and records FAILED Leg 1 with clickable explorer URL', async () => {
    const origVerify = CrossChainSwapService.verifyOnChainDeposit;
    const failedDepositHash = 'AABBCCDD11223344AABBCCDD11223344AABBCCDD11223344AABBCCDD11223344';

    CrossChainSwapService.verifyOnChainDeposit = async () => ({
      status: 'FAILED',
      txHash: failedDepositHash,
      explorerUrl: `https://testnet.xrpl.org/transactions/${failedDepositHash}`,
      errorMessage: 'XRPL deposit failed on-chain (tecUNFUNDED_PAYMENT)',
    });

    try {
      const balBefore = await (await import('../src/services/wallet.js')).walletService.getBalance(testUserId);
      const { order } = await NrTokenService.executeNrSwap({
        userId: testUserId,
        fromAsset: 'XRP',
        toAsset: 'USD',
        amount: 5,
        depositTxHash: failedDepositHash,
      });
      createdSwapIds.push(order.swapId);

      assert.equal(order.status, 'FAILED');
      assert.equal(order.settlementType, 'FAILED');
      assert.equal(order.transactions?.length, 1);
      assert.equal(order.transactions?.[0].direction, 'INCOMING');
      assert.equal(order.transactions?.[0].status, 'FAILED');
      assert.equal(order.transactions?.[0].txHash, failedDepositHash);
      assert.equal(
        order.transactions?.[0].explorerUrl,
        `https://testnet.xrpl.org/transactions/${failedDepositHash}`
      );

      const balAfter = await (await import('../src/services/wallet.js')).walletService.getBalance(testUserId);
      assert.equal(balAfter.USD, balBefore.USD);
    } finally {
      CrossChainSwapService.verifyOnChainDeposit = origVerify;
    }
  });

  it('CrossChainSwapService marks order FAILED with no fake payoutTxHash when payout fails', async () => {
    const validStellar = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';
    const order = await CrossChainSwapService.createSwapOrder({
      userId: testUserId,
      fromAsset: 'XRP',
      toAsset: 'XLM',
      amount: 5,
      userDestinationAddress: validStellar,
    });
    createdSwapIds.push(order.swapId);

    const svcAny = CrossChainSwapService as any;
    const origPayoutStellar = svcAny.payoutStellarToUser;
    svcAny.payoutStellarToUser = async () => ({
      ok: false,
      txHash: null,
      explorerUrl: null,
      errorMessage: 'Simulated Stellar testnet timeout',
    });

    try {
      const res = await CrossChainSwapService.executeSwap({
        swapId: order.swapId,
        depositTxHash: '111122223333444455556666777788889999AAAABBBBCCCCDDDDEEEEFFFF0000',
        skipDepositVerification: true,
      });

      assert.equal(res.status, 'FAILED');
      assert.equal(res.settlementType, 'FAILED');
      assert.equal(res.payoutTxHash, undefined);
      assert.equal(res.payoutExplorerUrl, undefined);
      assert.equal(res.transactions?.length, 2);
      assert.equal(res.transactions?.[0].sequence, 1);
      assert.equal(res.transactions?.[0].status, 'SUCCESS');
      assert.equal(res.transactions?.[1].sequence, 2);
      assert.equal(res.transactions?.[1].direction, 'OUTGOING');
      assert.equal(res.transactions?.[1].status, 'FAILED');
      assert.equal(res.transactions?.[1].txHash, null);
      assert.match(res.errorMessage || '', /timeout/i);
    } finally {
      svcAny.payoutStellarToUser = origPayoutStellar;
    }
  });
});
