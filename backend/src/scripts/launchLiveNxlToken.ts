import { Client, Wallet, xrpToDrops } from 'xrpl';
import dotenv from 'dotenv';
import path from 'path';
import { MongoService } from '../services/mongo.js';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

async function launchLiveNxl() {
  console.log('🚀 [XRPL Launch] Launching standard 3-character NXL token & XLS-30d AMM on XRPL Altnet...');

  const issuerSeed = process.env.XRPL_NR_ISSUER_SEED;
  const distSeed = process.env.XRPL_HOT_WALLET_SEED;
  if (!issuerSeed || !distSeed) {
    throw new Error('XRPL_NR_ISSUER_SEED and XRPL_HOT_WALLET_SEED are required in backend/.env');
  }

  const client = new Client(process.env.XRPL_WSS || 'wss://s.altnet.rippletest.net:51233');
  await client.connect();
  console.log('✅ Connected to XRPL Altnet');

  const issuerWallet = Wallet.fromSeed(issuerSeed);
  const distWallet = Wallet.fromSeed(distSeed);

  console.log('Issuer Address:', issuerWallet.address);
  console.log('Distributor Address:', distWallet.address);

  // 1. TrustSet for standard 3-character currency 'NXL'
  console.log('1️⃣ Submitting TrustSet for standard 3-character "NXL"...');
  const trustTx = await client.submitAndWait(
    {
      TransactionType: 'TrustSet',
      Account: distWallet.address,
      LimitAmount: {
        currency: 'NXL',
        issuer: issuerWallet.address,
        value: '1000000',
      },
    },
    { wallet: distWallet }
  );
  console.log('✅ TrustSet Result:', (trustTx.result.meta as any)?.TransactionResult, 'Tx Hash:', trustTx.result.hash);

  // 2. Payment (Minting 500 NXL to Distributor)
  console.log('2️⃣ Minting 500 NXL from Issuer to Distributor Vault...');
  const mintTx = await client.submitAndWait(
    {
      TransactionType: 'Payment',
      Account: issuerWallet.address,
      Destination: distWallet.address,
      Amount: {
        currency: 'NXL',
        issuer: issuerWallet.address,
        value: '500',
      },
    },
    { wallet: issuerWallet }
  );
  console.log('✅ Mint Result:', (mintTx.result.meta as any)?.TransactionResult, 'Tx Hash:', mintTx.result.hash);

  // 3. AMMCreate for XRP / NXL (0.50% fee)
  console.log('3️⃣ Submitting AMMCreate for XRP / NXL native liquidity pool...');
  const ammTx = await client.submitAndWait(
    {
      TransactionType: 'AMMCreate',
      Account: distWallet.address,
      Amount: xrpToDrops(10),
      Amount2: {
        currency: 'NXL',
        issuer: issuerWallet.address,
        value: '10',
      },
      TradingFee: 500,
    },
    { wallet: distWallet }
  );
  console.log('✅ AMMCreate Result:', (ammTx.result.meta as any)?.TransactionResult, 'Tx Hash:', ammTx.result.hash);

  // 4. Fetch AMM Info
  const ammInfo = await client.request({
    command: 'amm_info',
    asset: { currency: 'XRP' },
    asset2: { currency: 'NXL', issuer: issuerWallet.address },
  });

  const ammAccount = ammInfo.result.amm.account;
  console.log('\n🎉 AMM POOL LIVE ON XRPL ALTNET:');
  console.log('AMM Account:', ammAccount);
  console.log('XRP Drops:', ammInfo.result.amm.amount);
  console.log('NXL Reserve:', (ammInfo.result.amm.amount2 as any)?.value);
  console.log('Trading Fee:', ammInfo.result.amm.trading_fee);

  // 5. Update MongoDB platform_tokens and platform_amm_pools
  const tokensCol = await MongoService.getCollection<any>('platform_tokens');
  await tokensCol.updateOne(
    { symbol: 'NXL', chain: 'XRPL' },
    {
      $set: {
        symbol: 'NXL',
        name: 'NexusRail Protocol Token',
        chain: 'XRPL',
        asset_code: 'NXL',
        currency_code: 'NXL',
        issuer_address: issuerWallet.address,
        issuer_secret: issuerSeed,
        distribution_address: distWallet.address,
        initial_mint_amount: 1_000_000,
        total_supply_cap: 1_000_000,
        mint_tx_hash: mintTx.result.hash,
        amm_account: ammAccount,
        amm_tx_hash: ammTx.result.hash,
        is_live_on_chain: true,
        created_at: new Date().toISOString(),
        explorer_url: `https://testnet.xrpl.org/accounts/${issuerWallet.address}`,
      },
    },
    { upsert: true }
  );

  // Also update Stellar record in MongoDB
  await tokensCol.updateOne(
    { symbol: 'NXL', chain: 'STELLAR' },
    {
      $set: {
        symbol: 'NXL',
        name: 'NexusRail Protocol Token',
        chain: 'STELLAR',
        asset_code: 'NXL',
        issuer_address: process.env.STELLAR_NR_ISSUER_PUBLIC,
        issuer_secret: process.env.STELLAR_NR_ISSUER_SECRET,
        distribution_address: process.env.STELLAR_MERCHANT_PUBLIC_KEY,
        contract_id: 'CDGPJNW7T53P3L5X7LLVMIAPMVIYT7GNC3EVV3ZOGFVCMWQSW2HF7LPC',
        initial_mint_amount: 1_000_000,
        total_supply_cap: 1_000_000,
        mint_tx_hash: 'd1df7215d2a13eec52a163b343d95f01fdeb50011db2c4977d933a0e3af5cc22',
        is_live_on_chain: true,
        created_at: new Date().toISOString(),
        explorer_url: `https://stellar.expert/explorer/testnet/asset/NXL-${process.env.STELLAR_NR_ISSUER_PUBLIC}`,
      },
    },
    { upsert: true }
  );

  console.log('💾 [MongoDB] platform_tokens updated for both STELLAR and XRPL with symbol: NXL');

  await client.disconnect();
}

launchLiveNxl().catch((e) => {
  console.error('Launch Error:', e);
  process.exit(1);
});
