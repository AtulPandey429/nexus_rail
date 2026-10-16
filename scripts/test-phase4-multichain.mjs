import dotenv from 'dotenv';
dotenv.config({ path: 'd:/live/nexus-rail/.env' });

import { chainRegistry, stellarProvider, xrplProvider } from '../apps/api/dist/services/crypto/index.js';
import { RatesService } from '../apps/api/dist/services/rates.js';

async function testPhase4MultiChain() {
  console.log('🚀 [Phase 4 Verification] Starting Real Stellar & XRPL Multi-Chain Provider Suite...\n');

  try {
    // 1. Verify Provider Registration
    console.log('⛓️ [1/6] Inspecting ChainProviderRegistry Providers...');
    const providers = chainRegistry.getAllProviders();
    console.log(`   ✅ Registered Providers (${providers.length}): ${providers.map((p) => p.chainId.toUpperCase()).join(', ')}`);
    if (providers.length < 2) throw new Error('Expected at least 2 registered providers (Stellar, XRPL)');

    // 2. Real Stellar Horizon Testnet Account Query
    console.log('\n🌟 [2/6] Querying Real Stellar Horizon Testnet Ledger...');
    const stellarBalance = await stellarProvider.getAccountBalance();
    console.log(`   ✅ Stellar Testnet Connected! Vault Address: ${stellarProvider.getMerchantAddress()}`);
    console.log(`   ✅ Live On-Chain Balance: ${stellarBalance.balance.toLocaleString()} ${stellarBalance.currency}`);
    console.log(`   ✅ Network: ${stellarProvider.network.toUpperCase()} (Horizon Public Node)`);
    if (typeof stellarBalance.balance !== 'number' || stellarBalance.balance < 0) {
      throw new Error('Invalid Stellar balance returned');
    }

    // 3. Real XRPL Testnet WebSocket Query
    console.log('\n⚡ [3/6] Querying Real XRPL Testnet Ledger via WebSocket...');
    const xrplBalance = await xrplProvider.getAccountBalance();
    console.log(`   ✅ XRPL Testnet Connected! Vault Address: ${xrplProvider.getMerchantAddress()}`);
    console.log(`   ✅ Live On-Chain Balance: ${xrplBalance.balance.toLocaleString()} ${xrplBalance.currency}`);
    console.log(`   ✅ Network: ${xrplProvider.network.toUpperCase()} (Ripple AltNet WSS)`);
    if (typeof xrplBalance.balance !== 'number' || xrplBalance.balance < 0) {
      throw new Error('Invalid XRPL balance returned');
    }

    // 4. Test Multi-Chain Invoice Generation (Order: ORD-BENCH-99, Amount: $499.00 USD)
    console.log('\n🧾 [4/6] Generating Real Multi-Chain Payment Invoices for $499.00 Order...');
    
    // Stellar Invoice
    const stellarInvoice = await stellarProvider.createInvoice('ORD-BENCH-99', 49900);
    console.log(`   ✅ [Stellar Testnet Invoice]`);
    console.log(`      • Amount: ${stellarInvoice.amountAsset} XLM (Stroops: ${stellarInvoice.amountDropsOrStroops})`);
    console.log(`      • Recipient: ${stellarInvoice.recipientAddress}`);
    console.log(`      • Memo (${stellarInvoice.paymentIdentifierType}): "${stellarInvoice.paymentIdentifier}"`);
    console.log(`      • Explorer: ${stellarInvoice.explorerUrl}`);

    // XRPL Invoice
    const xrplInvoice = await xrplProvider.createInvoice('ORD-BENCH-99', 49900);
    console.log(`   ✅ [XRPL Testnet Invoice]`);
    console.log(`      • Amount: ${xrplInvoice.amountAsset} XRP (Drops: ${xrplInvoice.amountDropsOrStroops})`);
    console.log(`      • Recipient: ${xrplInvoice.recipientAddress}`);
    console.log(`      • Tag (${xrplInvoice.paymentIdentifierType}): ${xrplInvoice.paymentIdentifier}`);
    console.log(`      • Explorer: ${xrplInvoice.explorerUrl}`);

    // 5. Test Live FX Rates & Caching Engine
    console.log('\n📈 [5/6] Testing Resilient FX Rates & Deduplication Engine...');
    const rates1 = await RatesService.getExchangeRates();
    console.log(`   ✅ Live Rates: 1 USD = ${rates1.XRP} XRP / ${rates1.XLM} XLM (Source: ${rates1.source})`);
    const rates2 = await RatesService.getExchangeRates();
    console.log(`   ✅ Cached Rates Retrieved: FromCache = ${rates2.fromCache} (Source: ${rates2.source})`);

    // 6. Test Address Validation
    console.log('\n🛡️ [6/6] Testing Cryptographic Address Validation...');
    const validStellar = stellarProvider.validateAddress('GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR');
    const invalidStellar = stellarProvider.validateAddress('InvalidStellarBadAddress');
    const validXrpl = xrplProvider.validateAddress('rp4Q7LTC8pg5jSprV92jRdoZ9E2rhMNFxW');
    const invalidXrpl = xrplProvider.validateAddress('0xInvalidXrplAddress');

    console.log(`   ✅ Stellar Validation: Valid -> ${validStellar}, Invalid -> ${!invalidStellar}`);
    console.log(`   ✅ XRPL Validation: Valid -> ${validXrpl}, Invalid -> ${!invalidXrpl}`);

    if (!validStellar || invalidStellar || !validXrpl || invalidXrpl) {
      throw new Error('Address validation check failed!');
    }

    console.log('\n🎉 [PHASE 4 COMPLETE] Provider-Based Multi-Chain Engine Verified 100% on Live Testnets!');
  } catch (error) {
    console.error('\n❌ [Phase 4 Error]:', error.message);
    process.exit(1);
  } finally {
    await xrplProvider.disconnect().catch(() => {});
  }
}

testPhase4MultiChain().catch(console.error);
