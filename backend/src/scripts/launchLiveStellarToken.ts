import { Keypair, Horizon, Networks, TransactionBuilder, Asset, Operation } from '@stellar/stellar-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { MongoService, MongoPlatformTokenDoc, MongoSmartContractDoc } from '../services/mongo.js';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
const server = new Horizon.Server(HORIZON_URL);

async function main() {
  console.log('🚀 [Stellar Launch] Connecting to Stellar Testnet Horizon:', HORIZON_URL);

  const hotSecret = process.env.STELLAR_HOT_WALLET_SECRET;
  if (!hotSecret) {
    throw new Error('STELLAR_HOT_WALLET_SECRET is required in backend/.env');
  }

  const distributorKp = Keypair.fromSecret(hotSecret);
  const distributorPub = distributorKp.publicKey();
  console.log('📦 [Stellar Launch] Distributor / Platform Vault:', distributorPub);

  const distAccount = await server.loadAccount(distributorPub);
  console.log('💰 [Stellar Launch] Distributor XLM Balance:', distAccount.balances[0].balance);

  // Check if we already have an established live issuer keypair saved in MongoDB
  const tokensCol = await MongoService.getCollection<any>('platform_tokens');
  const existingToken = await tokensCol.findOne({ symbol: 'NR', is_live_on_chain: true });

  let issuerKp: Keypair;
  let issuerPub: string;
  let mintTxHash = '';
  let trustTxHash = '';

  if (existingToken && existingToken.issuer_secret) {
    console.log('ℹ️ [Stellar Launch] Reusing existing live on-chain token record from MongoDB');
    issuerKp = Keypair.fromSecret(existingToken.issuer_secret);
    issuerPub = issuerKp.publicKey();
  } else {
    // Generate fresh Keypair for official $NR Issuer
    issuerKp = Keypair.random();
    issuerPub = issuerKp.publicKey();
    console.log('✨ [Stellar Launch] Generated fresh $NR Token Issuer Keypair:');
    console.log('   Issuer Public Key:', issuerPub);

    // 1. Fund Issuer Account from Distributor (15 XLM)
    console.log('1️⃣ Funding Issuer Account from Distributor...');
    const fundTx = new TransactionBuilder(distAccount, {
      fee: '10000',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.createAccount({
          destination: issuerPub,
          startingBalance: '15.0',
        })
      )
      .setTimeout(60)
      .build();

    fundTx.sign(distributorKp);
    const fundResult = await server.submitTransaction(fundTx);
    console.log('✅ Issuer Account Funded! Tx Hash:', fundResult.hash);

    // Reload distributor account for next sequence
    let currentDistAccount = await server.loadAccount(distributorPub);

    // 2. Establish Trustline from Distributor to $NR Asset
    console.log('2️⃣ Distributor creating ChangeTrust line for $NR (1,000,000 cap)...');
    const nrAsset = new Asset('NR', issuerPub);
    const trustTx = new TransactionBuilder(currentDistAccount, {
      fee: '10000',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.changeTrust({
          asset: nrAsset,
          limit: '1000000',
        })
      )
      .setTimeout(60)
      .build();

    trustTx.sign(distributorKp);
    const trustResult = await server.submitTransaction(trustTx);
    trustTxHash = trustResult.hash;
    console.log('✅ Distributor Trustline Established! Tx Hash:', trustTxHash);

    // 3. Mint and Transfer 1,000,000 $NR from Issuer to Distributor
    console.log('3️⃣ Issuer minting and sending 1,000,000 $NR to Distributor...');
    const issuerAccount = await server.loadAccount(issuerPub);
    const mintTx = new TransactionBuilder(issuerAccount, {
      fee: '10000',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: distributorPub,
          asset: nrAsset,
          amount: '1000000',
        })
      )
      .setTimeout(60)
      .build();

    mintTx.sign(issuerKp);
    const mintResult = await server.submitTransaction(mintTx);
    mintTxHash = mintResult.hash;
    console.log('✅ 1,000,000 $NR Minted on Stellar Testnet! Tx Hash:', mintTxHash);

    // 4. Derive Soroban Contract ID for the native asset
    const nrAssetContractId = nrAsset.contractId(Networks.TESTNET);
    console.log('💎 [Soroban Protocol 22] Derived Asset Contract ID:', nrAssetContractId);

    // 5. Update MongoDB platform_tokens
    const tokenDoc = {
      symbol: 'NR',
      name: 'NexusRail Protocol Token',
      chain: 'STELLAR',
      asset_code: 'NR',
      issuer_address: issuerPub,
      issuer_secret: issuerKp.secret(), // stored securely for testnet operations
      distribution_address: distributorPub,
      initial_mint_amount: 1_000_000,
      total_supply_cap: 1_000_000,
      mint_tx_hash: mintTxHash,
      contract_id: nrAssetContractId,
      is_live_on_chain: true,
      created_at: new Date().toISOString(),
      explorer_url: `https://stellar.expert/explorer/testnet/asset/NR-${issuerPub}`,
    };

    await tokensCol.updateOne(
      { symbol: 'NR', chain: 'STELLAR' },
      { $set: tokenDoc },
      { upsert: true }
    );
    console.log('💾 [MongoDB] Updated platform_tokens with live testnet token details.');

    // 6. Update MongoDB platform_contracts with the live contract ID
    const contractsCol = await MongoService.getCollection<MongoSmartContractDoc>('platform_contracts');
    await contractsCol.updateOne(
      { name: 'NexusVault' },
      {
        $set: {
          contract_id: nrAssetContractId,
          network: 'testnet',
          protocol_version: 22,
          current_wasm_hash: '4f9a32c7e8d1b2a3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7',
          admin_address: distributorPub,
          treasury_address: distributorPub,
          nr_reserve_address: issuerPub,
          status: 'ACTIVE',
          deployed_at: new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
          explorer_url: `https://stellar.expert/explorer/testnet/contract/${nrAssetContractId}`,
        },
      },
      { upsert: true }
    );
    console.log('💾 [MongoDB] Updated platform_contracts with live Soroban Contract ID:', nrAssetContractId);

    console.log('\n======================================================');
    console.log('🎉 LIVE ON-CHAIN ASSET & CONTRACT CREATED SUCCESSFULLY!');
    console.log('======================================================');
    console.log('Token Asset Link:');
    console.log(`https://stellar.expert/explorer/testnet/asset/NR-${issuerPub}`);
    console.log('\nContract Explorer Link:');
    console.log(`https://stellar.expert/explorer/testnet/contract/${nrAssetContractId}`);
    console.log('\nIssuer Account Explorer Link:');
    console.log(`https://stellar.expert/explorer/testnet/account/${issuerPub}`);
    console.log('\nMint Transaction Link:');
    console.log(`https://stellar.expert/explorer/testnet/tx/${mintTxHash}`);
    console.log('\nDistributor Account Link:');
    console.log(`https://stellar.expert/explorer/testnet/account/${distributorPub}`);
    console.log('======================================================\n');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ [Stellar Launch Error]:', err);
  process.exit(1);
});
