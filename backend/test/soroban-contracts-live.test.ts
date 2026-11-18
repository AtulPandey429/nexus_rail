import assert from 'node:assert/strict';
import crypto from 'crypto';
import { SorobanService, NEXUS_VAULT_CONTRACT_ID, NEXUS_SWAP_CONTRACT_ID } from '../src/services/soroban.js';
import { env } from '../src/config/env.js';

async function run() {
  console.log('=== Live Stellar Testnet Soroban v2.0 Integration Test ===');
  console.log('NexusVault:', NEXUS_VAULT_CONTRACT_ID);
  console.log('NexusSwap :', NEXUS_SWAP_CONTRACT_ID);

  // 1. Live Vault Config
  const cfg = await SorobanService.getLiveVaultConfig();
  assert.equal(cfg.contractId, NEXUS_VAULT_CONTRACT_ID);
  assert.equal(cfg.orderFeeBps, 100);
  assert.equal(cfg.ownerSplitPct, 50);
  assert.equal(cfg.isPaused, false);
  assert.equal(cfg.nxlSupplyCap, 2_000_000);
  console.log('✓ 1. getLiveVaultConfig passed:', { feeBps: cfg.orderFeeBps, split: cfg.ownerSplitPct, cap: cfg.nxlSupplyCap });

  // 2. Live Vault Metrics
  const metricsBefore = await SorobanService.getLiveVaultMetrics();
  assert.ok(metricsBefore.circulatingNxl >= 1_000_000);
  console.log('✓ 2. getLiveVaultMetrics passed:', {
    minted: metricsBefore.totalNxlMinted,
    burned: metricsBefore.totalNxlBurned,
    circulating: metricsBefore.circulatingNxl,
    remainingCap: metricsBefore.remainingMintableNxl,
  });

  // 3. Live AMM Swap Pool State & Live Quote
  const pool = await SorobanService.getLiveSwapPoolState();
  assert.equal(pool.contractId, NEXUS_SWAP_CONTRACT_ID);
  assert.ok(pool.reserveXlm >= 500);
  assert.ok(pool.reserveNxl >= 500);
  const quote = await SorobanService.quoteOnChainSwap('XLM', 10);
  assert.ok(quote.amountOut > 9 && quote.amountOut < 10);
  assert.equal(quote.ownerFee, 0.025);
  assert.equal(quote.poolFee, 0.025);
  console.log('✓ 3. getLiveSwapPoolState & quoteOnChainSwap(10 XLM -> NXL) passed:', {
    reserveXlm: pool.reserveXlm,
    reserveNxl: pool.reserveNxl,
    quoteOutNxl: quote.amountOut,
    ownerFee: quote.ownerFee,
  });

  // 4. Unsigned User XDR Builders (Checkout + AMM Swap + Bridge Escrow)
  const testUser = env.PLATFORM_STELLAR_VAULT;
  const settleXdr = await SorobanService.buildSettleOrderXdr({
    payerAddress: testUser,
    tokenAsset: 'XLM',
    grossAmount: 2,
    orderId: `SMOKE-ORD-${Date.now()}`,
  });
  assert.ok(settleXdr.unsignedXdr.length > 100);

  const swapXdr = await SorobanService.buildAmmSwapXdr({
    traderAddress: testUser,
    fromAsset: 'XLM',
    amountIn: 5,
    minAmountOut: 4.5,
  });
  assert.ok(swapXdr.unsignedXdr.length > 100);

  const escrowXdr = await SorobanService.buildLockBridgeEscrowXdr({
    senderAddress: testUser,
    tokenAsset: 'XLM',
    amount: 2,
    swapId: `SMOKE-SWAP-${Date.now()}`,
    xrplDestination: 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp',
  });
  assert.ok(escrowXdr.unsignedXdr.length > 100);
  console.log('✓ 4. All 3 unsigned Freighter XDR builders simulated cleanly (settle_order, swap_exact_in, lock_bridge_escrow)');

  // 5. Real Live On-Chain Mint (1 NXL) + Burn (1 NXL) Round-Trip!
  const nonce = crypto.randomBytes(4).toString('hex');
  const mintRes = await SorobanService.mintNxlOnChain({
    recipientAddress: testUser,
    amountNxl: 1,
    reason: 'cashback',
    refId: `SMOKE_MINT_${nonce}`,
  });
  assert.equal(mintRes.status, 'SUCCESS');
  console.log('✓ 5a. Live on-chain mint_nxl (+1 NXL) SUCCESS:', mintRes.explorerUrl);

  const burnRes = await SorobanService.burnNxlOnChain({
    amountNxl: 1,
    reason: 'buyback',
    refId: `SMOKE_BURN_${nonce}`,
  });
  assert.equal(burnRes.status, 'SUCCESS');
  console.log('✓ 5b. Live on-chain burn_nxl (-1 NXL) SUCCESS:', burnRes.explorerUrl);

  const metricsAfter = await SorobanService.getLiveVaultMetrics();
  assert.equal(metricsAfter.totalNxlMinted, metricsBefore.totalNxlMinted + 1);
  assert.equal(metricsAfter.totalNxlBurned, metricsBefore.totalNxlBurned + 1);
  assert.equal(metricsAfter.circulatingNxl, metricsBefore.circulatingNxl);
  console.log('✓ 5c. On-chain supply accounting verified (+1 minted, +1 burned, exact invariant preserved)!');

  console.log('ALL 5 LIVE STELLAR TESTNET SOROBAN TESTS PASSED!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Live Soroban test failed:', err);
  process.exit(1);
});
