import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { MongoService, MongoBuybackExecutionDoc } from '../src/services/mongo.js';
import { BuybackService } from '../src/services/buyback.service.js';
import { BuybackWorker } from '../src/workers/buybackWorker.js';
import { SorobanService } from '../src/services/soroban.js';

describe('Suite: Phase 3 — Real On-Chain Buyback & Burn Engine (NexusSwap -> NexusVault burn_nxl)', () => {
  const runId = crypto.randomBytes(4).toString('hex');
  const createdKeys: string[] = [];
  const testKeypair = Keypair.random();

  before(async () => {
    await MongoService.getClient();
  });

  after(async () => {
    try {
      const col = await MongoService.getCollection('buyback_executions');
      if (createdKeys.length > 0) {
        await col.deleteMany({ idempotency_key: { $in: createdKeys } });
      }
    } catch {}
    await MongoService.close();
  });

  it('P3.1: Rejects reserve wallet if public key collides with $NXL Classic Issuer', async () => {
    const prevSecret = process.env.STELLAR_BUYBACK_RESERVE_SECRET;
    const { env } = await import('../src/config/env.js');
    const origEnvSecret = env.STELLAR_BUYBACK_RESERVE_SECRET;

    // Issuer secret from env defaults
    env.STELLAR_BUYBACK_RESERVE_SECRET = env.STELLAR_NXL_ISSUER_SECRET;
    try {
      await assert.rejects(
        () => BuybackService.resolveBuybackReserveSigner(),
        /Unsafe Buyback Reserve configuration/i
      );
    } finally {
      env.STELLAR_BUYBACK_RESERVE_SECRET = origEnvSecret;
      process.env.STELLAR_BUYBACK_RESERVE_SECRET = prevSecret;
    }
  });

  it('P3.2: Enforces minimum XLM threshold and aborts high price-impact swaps before touching contracts', async () => {
    const origResolve = BuybackService.resolveBuybackReserveSigner;
    const origBalances = BuybackService.fetchAccountBalances;
    const origPool = SorobanService.getLiveSwapPoolState;
    const origQuote = SorobanService.quoteOnChainSwap;

    let swapCalled = 0;
    const origExecSwap = SorobanService.executeBuybackSwapOnNexusSwap;
    SorobanService.executeBuybackSwapOnNexusSwap = async () => {
      swapCalled++;
      throw new Error('Should never reach swap execution');
    };

    BuybackService.resolveBuybackReserveSigner = async () => ({
      keypair: testKeypair,
      publicKey: testKeypair.publicKey(),
      secret: testKeypair.secret(),
    });

    try {
      // 1. Threshold test: 30 XLM balance -> 25 spendable after 5 XLM gas buffer < 50 threshold
      BuybackService.fetchAccountBalances = async () => ({ xlmBalance: 30, nxlBalance: 0 });
      await assert.rejects(
        () =>
          BuybackService.executeBuybackAndBurn({
            idempotencyKey: `bb_thresh_${runId}`,
            minThresholdXlm: 50,
          }),
        /threshold not met/i
      );

      // 2. Price impact test: 200 XLM quote returning only 160 NXL against 1:1 spot (20% impact > 5% max)
      BuybackService.fetchAccountBalances = async () => ({ xlmBalance: 200, nxlBalance: 0 });
      SorobanService.getLiveSwapPoolState = async () => ({
        contractId: 'CCJBRAJ5JUQPMIMGHDZKGRNXRZVJU5KBU7PMNJK235ORSXUSSHCPQYAM',
        explorerUrl: '',
        admin: testKeypair.publicKey(),
        relayer: testKeypair.publicKey(),
        treasury: testKeypair.publicKey(),
        tokenA: 'XLM',
        tokenB: 'NXL',
        reserveXlm: 2000,
        reserveNxl: 2000,
        spotPriceXlmPerNxl: 1,
        spotPriceNxlPerXlm: 1,
        totalLpShares: 2000,
        swapFeeBps: 50,
        ownerFeeSplitPct: 50,
        isPaused: false,
        totalSwaps: 0,
        totalVolumeXlm: 0,
        totalVolumeNxl: 0,
        totalOwnerFeesXlm: 0,
        totalOwnerFeesNxl: 0,
        totalEscrowsLocked: 0,
        totalEscrowsReleased: 0,
      });
      SorobanService.quoteOnChainSwap = async () => ({
        fromAsset: 'XLM',
        toAsset: 'NXL',
        tokenIn: 'XLM',
        tokenOut: 'NXL',
        amountIn: 100,
        amountOut: 80, // 20% impact
        totalFee: 0.5,
        ownerFee: 0.25,
        poolFee: 0.25,
        effectiveRate: 0.8,
        reserveInAfter: 2100,
        reserveOutAfter: 1920,
        contractId: 'CCJBRAJ5JUQPMIMGHDZKGRNXRZVJU5KBU7PMNJK235ORSXUSSHCPQYAM',
      });

      await assert.rejects(
        () =>
          BuybackService.executeBuybackAndBurn({
            idempotencyKey: `bb_impact_${runId}`,
            xlmAmount: 100,
            minThresholdXlm: 50,
            maxPriceImpactPct: 5,
          }),
        /price impact/i
      );
      assert.equal(swapCalled, 0, 'No on-chain swap may run when threshold or price impact fails');
    } finally {
      BuybackService.resolveBuybackReserveSigner = origResolve;
      BuybackService.fetchAccountBalances = origBalances;
      SorobanService.getLiveSwapPoolState = origPool;
      SorobanService.quoteOnChainSwap = origQuote;
      SorobanService.executeBuybackSwapOnNexusSwap = origExecSwap;
    }
  });

  it('P3.3: Full Buyback & Burn cycle succeeds, records both tx hashes, enforces idempotency, and updates confirmed burn metrics only after SAC burn', async () => {
    const key = `bb_full_${runId}`;
    createdKeys.push(key);

    const origResolve = BuybackService.resolveBuybackReserveSigner;
    const origBalances = BuybackService.fetchAccountBalances;
    const origPool = SorobanService.getLiveSwapPoolState;
    const origQuote = SorobanService.quoteOnChainSwap;
    const origExecSwap = SorobanService.executeBuybackSwapOnNexusSwap;
    const origBurn = SorobanService.burnNxlOnChain;

    let swapCalls = 0;
    let burnCalls = 0;

    BuybackService.resolveBuybackReserveSigner = async () => ({
      keypair: testKeypair,
      publicKey: testKeypair.publicKey(),
      secret: testKeypair.secret(),
    });
    BuybackService.fetchAccountBalances = async () => ({ xlmBalance: 120, nxlBalance: 0 });
    SorobanService.getLiveSwapPoolState = async () => ({
      contractId: 'CCJBRAJ5JUQPMIMGHDZKGRNXRZVJU5KBU7PMNJK235ORSXUSSHCPQYAM',
      explorerUrl: '',
      admin: testKeypair.publicKey(),
      relayer: testKeypair.publicKey(),
      treasury: testKeypair.publicKey(),
      tokenA: 'XLM',
      tokenB: 'NXL',
      reserveXlm: 5000,
      reserveNxl: 5000,
      spotPriceXlmPerNxl: 1,
      spotPriceNxlPerXlm: 1,
      totalLpShares: 5000,
      swapFeeBps: 50,
      ownerFeeSplitPct: 50,
      isPaused: false,
      totalSwaps: 0,
      totalVolumeXlm: 0,
      totalVolumeNxl: 0,
      totalOwnerFeesXlm: 0,
      totalOwnerFeesNxl: 0,
      totalEscrowsLocked: 0,
      totalEscrowsReleased: 0,
    });
    SorobanService.quoteOnChainSwap = async (_asset, amtIn) => ({
      fromAsset: 'XLM',
      toAsset: 'NXL',
      tokenIn: 'XLM',
      tokenOut: 'NXL',
      amountIn: amtIn,
      amountOut: 98.5,
      totalFee: 0.5,
      ownerFee: 0.25,
      poolFee: 0.25,
      effectiveRate: 0.985,
      reserveInAfter: 5100,
      reserveOutAfter: 4901.5,
      contractId: 'CCJBRAJ5JUQPMIMGHDZKGRNXRZVJU5KBU7PMNJK235ORSXUSSHCPQYAM',
    });
    SorobanService.executeBuybackSwapOnNexusSwap = async (p) => {
      swapCalls++;
      assert.equal(p.amountXlm, 100);
      assert.ok(p.minNxlOut > 96 && p.minNxlOut < 98.5);
      return {
        txHash: '1111aaaa2222bbbb3333cccc4444dddd5555eeee6666ffff7777888899990000',
        status: 'SUCCESS',
        ledger: 5883001,
        explorerUrl: 'https://stellar.expert/explorer/testnet/tx/1111aaaa2222bbbb3333cccc4444dddd5555eeee6666ffff7777888899990000',
        amountNxlReceived: 98.5,
        buyerPublicKey: testKeypair.publicKey(),
      };
    };
    SorobanService.burnNxlOnChain = async (p) => {
      burnCalls++;
      assert.equal(p.reason, 'buyback');
      assert.equal(p.amountNxl, 98.5);
      assert.equal(p.holderSecret, testKeypair.secret());
      return {
        txHash: '2222bbbb3333cccc4444dddd5555eeee6666ffff77778888999900001111aaaa',
        status: 'SUCCESS',
        ledger: 5883003,
        explorerUrl: 'https://stellar.expert/explorer/testnet/tx/2222bbbb3333cccc4444dddd5555eeee6666ffff77778888999900001111aaaa',
      };
    };

    try {
      const result = await BuybackService.executeBuybackAndBurn({
        idempotencyKey: key,
        xlmAmount: 100,
        minThresholdXlm: 50,
        triggeredBy: 'admin_test',
      });

      assert.equal(result.status, 'COMPLETED');
      assert.equal(result.xlm_to_spend, 100);
      assert.equal(result.actual_nxl_purchased, 98.5);
      assert.equal(result.burned_nxl, 98.5);
      assert.equal(result.swap_tx_hash, '1111aaaa2222bbbb3333cccc4444dddd5555eeee6666ffff7777888899990000');
      assert.equal(result.burn_tx_hash, '2222bbbb3333cccc4444dddd5555eeee6666ffff77778888999900001111aaaa');
      assert.equal(swapCalls, 1);
      assert.equal(burnCalls, 1);

      // Replaying the same idempotencyKey must be a strict no-op
      const replay = await BuybackService.executeBuybackAndBurn({
        idempotencyKey: key,
        xlmAmount: 100,
      });
      assert.equal(replay.id, result.id);
      assert.equal(swapCalls, 1, 'Duplicate idempotencyKey must not re-swap');
      assert.equal(burnCalls, 1, 'Duplicate idempotencyKey must not re-burn');

      const status = await BuybackService.getStatus();
      assert.ok(status.confirmedMetrics.totalNxlBurnedOnChain >= 98.5);
    } finally {
      BuybackService.resolveBuybackReserveSigner = origResolve;
      BuybackService.fetchAccountBalances = origBalances;
      SorobanService.getLiveSwapPoolState = origPool;
      SorobanService.quoteOnChainSwap = origQuote;
      SorobanService.executeBuybackSwapOnNexusSwap = origExecSwap;
      SorobanService.burnNxlOnChain = origBurn;
    }
  });

  it('P3.4: Swap succeeds but burn fails -> burned_nxl stays 0 -> BuybackWorker resumes strictly at BURNING with zero duplicate swaps', async () => {
    const key = `bb_recover_${runId}`;
    createdKeys.push(key);

    const origResolve = BuybackService.resolveBuybackReserveSigner;
    const origBalances = BuybackService.fetchAccountBalances;
    const origPool = SorobanService.getLiveSwapPoolState;
    const origQuote = SorobanService.quoteOnChainSwap;
    const origExecSwap = SorobanService.executeBuybackSwapOnNexusSwap;
    const origBurn = SorobanService.burnNxlOnChain;

    let swapCalls = 0;
    let burnCalls = 0;
    let failBurn = true;

    BuybackService.resolveBuybackReserveSigner = async () => ({
      keypair: testKeypair,
      publicKey: testKeypair.publicKey(),
      secret: testKeypair.secret(),
    });
    BuybackService.fetchAccountBalances = async () => ({ xlmBalance: 120, nxlBalance: 0 });
    SorobanService.getLiveSwapPoolState = async () => ({
      contractId: 'CCJBRAJ5JUQPMIMGHDZKGRNXRZVJU5KBU7PMNJK235ORSXUSSHCPQYAM',
      explorerUrl: '',
      admin: testKeypair.publicKey(),
      relayer: testKeypair.publicKey(),
      treasury: testKeypair.publicKey(),
      tokenA: 'XLM',
      tokenB: 'NXL',
      reserveXlm: 5000,
      reserveNxl: 5000,
      spotPriceXlmPerNxl: 1,
      spotPriceNxlPerXlm: 1,
      totalLpShares: 5000,
      swapFeeBps: 50,
      ownerFeeSplitPct: 50,
      isPaused: false,
      totalSwaps: 0,
      totalVolumeXlm: 0,
      totalVolumeNxl: 0,
      totalOwnerFeesXlm: 0,
      totalOwnerFeesNxl: 0,
      totalEscrowsLocked: 0,
      totalEscrowsReleased: 0,
    });
    SorobanService.quoteOnChainSwap = async (_asset, amtIn) => ({
      fromAsset: 'XLM',
      toAsset: 'NXL',
      tokenIn: 'XLM',
      tokenOut: 'NXL',
      amountIn: amtIn,
      amountOut: 59.1,
      totalFee: 0.3,
      ownerFee: 0.15,
      poolFee: 0.15,
      effectiveRate: 0.985,
      reserveInAfter: 5060,
      reserveOutAfter: 4940.9,
      contractId: 'CCJBRAJ5JUQPMIMGHDZKGRNXRZVJU5KBU7PMNJK235ORSXUSSHCPQYAM',
    });
    SorobanService.executeBuybackSwapOnNexusSwap = async () => {
      swapCalls++;
      return {
        txHash: '3333cccc4444dddd5555eeee6666ffff77778888999900001111aaaa2222bbbb',
        status: 'SUCCESS',
        ledger: 5883100,
        explorerUrl: 'https://stellar.expert/explorer/testnet/tx/3333cccc4444dddd5555eeee6666ffff77778888999900001111aaaa2222bbbb',
        amountNxlReceived: 59.1,
        buyerPublicKey: testKeypair.publicKey(),
      };
    };
    SorobanService.burnNxlOnChain = async () => {
      burnCalls++;
      if (failBurn) {
        throw new Error('Simulated Soroban RPC burn timeout');
      }
      return {
        txHash: '4444dddd5555eeee6666ffff77778888999900001111aaaa2222bbbb3333cccc',
        status: 'SUCCESS',
        ledger: 5883105,
        explorerUrl: 'https://stellar.expert/explorer/testnet/tx/4444dddd5555eeee6666ffff77778888999900001111aaaa2222bbbb3333cccc',
      };
    };

    try {
      const partial = await BuybackService.executeBuybackAndBurn({
        idempotencyKey: key,
        xlmAmount: 60,
        minThresholdXlm: 50,
      });

      assert.equal(partial.status, 'RETRY_SCHEDULED');
      assert.equal(partial.actual_nxl_purchased, 59.1);
      assert.equal(partial.burned_nxl, 0, 'Must NEVER mark purchased tokens as burned when SAC burn failed');
      assert.ok(partial.swap_tx_hash);
      assert.equal(partial.burn_tx_hash, undefined);
      assert.equal(swapCalls, 1);
      assert.equal(burnCalls, 1);

      // Simulate server restart + retry timer elapsed -> BuybackWorker recovers burn WITHOUT swapping again!
      const col = await MongoService.getCollection<MongoBuybackExecutionDoc>('buyback_executions');
      await col.updateOne(
        { idempotency_key: key },
        { $set: { next_retry_at: new Date(Date.now() - 1000).toISOString() } }
      );

      failBurn = false;
      const sweep = await BuybackWorker.processPendingAndAutoBuyback();
      assert.ok(sweep.resumed >= 1);
      assert.ok(sweep.completed >= 1);

      const recovered = await col.findOne({ idempotency_key: key });
      assert.equal(recovered?.status, 'COMPLETED');
      assert.equal(recovered?.burned_nxl, 59.1);
      assert.equal(recovered?.burn_tx_hash, '4444dddd5555eeee6666ffff77778888999900001111aaaa2222bbbb3333cccc');
      assert.equal(swapCalls, 1, 'Recovery must resume strictly at BURNING without executing a second swap');
      assert.equal(burnCalls, 2);
    } finally {
      BuybackService.resolveBuybackReserveSigner = origResolve;
      BuybackService.fetchAccountBalances = origBalances;
      SorobanService.getLiveSwapPoolState = origPool;
      SorobanService.quoteOnChainSwap = origQuote;
      SorobanService.executeBuybackSwapOnNexusSwap = origExecSwap;
      SorobanService.burnNxlOnChain = origBurn;
    }
  });
});
