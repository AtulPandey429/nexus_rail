import crypto from 'crypto';
import { Client, Wallet, xrpToDrops, dropsToXrp, convertStringToHex } from 'xrpl';
import { Horizon, Keypair, TransactionBuilder, Operation, Asset, Memo, Networks, StrKey } from '@stellar/stellar-sdk';
import { env } from '../config/env.js';
import {
  MongoService,
  MongoPlatformTokenDoc,
  MongoAmmPoolDoc,
  MongoChainActionLogDoc,
  ChainActionType,
} from './mongo.js';
import { RedisCacheService } from './redis.js';
import type { DualRailTokenSummaryDTO, ChainActionLogDTO } from '../types/index.js';

export const STELLAR_NR_ASSET_CODE = env.STELLAR_NR_ASSET_CODE || 'NXL';
export const STELLAR_NR_ISSUER = env.STELLAR_NR_ISSUER_PUBLIC || 'GB24JBHL5EIZPUJPGPT67W6BDSEWY2SJU4I2UOV3RAZ4DG4HLLBJRAOZ';
export const STELLAR_NR_CONTRACT_ID = env.STELLAR_NR_CONTRACT_ID || 'CDGPJNW7T53P3L5X7LLVMIAPMVIYT7GNC3EVV3ZOGFVCMWQSW2HF7LPC';
export const STELLAR_DISTRIBUTOR_VAULT = env.STELLAR_NR_DISTRIBUTOR_VAULT || 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC';

// XRPL standard 3-character currency 'NXL' (ASCII native)
export const XRPL_NR_CURRENCY_CODE = env.XRPL_NR_CURRENCY_CODE || 'NXL';
export const XRPL_NR_CURRENCY_HEX = convertStringToHex('NXL').padEnd(40, '0');
export const TOTAL_SUPPLY_CAP = 1_000_000;

export class DualRailTokenService {
  private static getXrplClient(): Client {
    const wssUrl = env.XRPL_WSS || env.XRPL_TESTNET_WSS || 'wss://s.altnet.rippletest.net:51233';
    return new Client(wssUrl);
  }

  /**
   * Log an on-chain action with full audit details into MongoDB
   */
  static async logChainAction(params: {
    chain: 'STELLAR' | 'XRPL';
    action: ChainActionType;
    operatorId?: string;
    referenceId?: string;
    txHash: string;
    ledgerSeq?: number;
    amountPrimary?: number | string;
    amountSecondary?: number | string;
    feeCharged?: number | string;
    details?: Record<string, any>;
    status?: 'SUCCESS' | 'FAILED';
    errorMessage?: string;
  }): Promise<MongoChainActionLogDoc> {
    const logsCol = await MongoService.getCollection<MongoChainActionLogDoc>('platform_chain_logs');
    const explorerUrl =
      params.chain === 'STELLAR'
        ? `https://stellar.expert/explorer/testnet/tx/${params.txHash}`
        : `https://testnet.xrpl.org/transactions/${params.txHash}`;

    const doc: MongoChainActionLogDoc = {
      id: `log_${crypto.randomUUID()}`,
      chain: params.chain,
      action: params.action,
      reference_id: params.referenceId,
      operator_id: params.operatorId || 'SYSTEM',
      tx_hash: params.txHash,
      ledger_seq: params.ledgerSeq,
      amount_primary: params.amountPrimary,
      amount_secondary: params.amountSecondary,
      fee_charged: params.feeCharged,
      details: params.details || {},
      explorer_url: explorerUrl,
      status: params.status || 'SUCCESS',
      error_message: params.errorMessage,
      created_at: new Date().toISOString(),
    };

    await logsCol.insertOne(doc);
    return doc;
  }

  /**
   * Returns persistent XRPL $NR Issuer account from MongoDB (or creates and funds via Altnet Faucet)
   */
  static async getOrCreateXrplIssuer(client: Client): Promise<{ issuerWallet: Wallet; isNew: boolean }> {
    const tokensCol = await MongoService.getCollection<MongoPlatformTokenDoc>('platform_tokens');
    const existing = await tokensCol.findOne({ symbol: 'NXL', chain: 'XRPL' }) || await tokensCol.findOne({ symbol: 'NR' as any, chain: 'XRPL' });

    const seed = env.XRPL_NR_ISSUER_SEED || existing?.issuer_secret;
    if (seed) {
      const issuerWallet = Wallet.fromSeed(seed);
      return { issuerWallet, isNew: false };
    }

    // Fund a fresh persistent issuer via faucet
    console.log('✨ [XRPL Launch] Funding new XRPL Issuer account via Altnet faucet...');
    const { wallet: issuerWallet } = await client.fundWallet();

    // Enable DefaultRipple (SetFlag: 8) so users can transfer $NXL peer-to-peer
    const rippleTx = await client.submitAndWait(
      {
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        SetFlag: 8,
      },
      { wallet: issuerWallet }
    );

    const rippleTxHash = rippleTx.result.hash;
    await this.logChainAction({
      chain: 'XRPL',
      action: 'MINT',
      operatorId: 'SYSTEM',
      txHash: rippleTxHash,
      ledgerSeq: rippleTx.result.ledger_index,
      details: { step: 'AccountSet DefaultRipple enabled', issuer: issuerWallet.address },
    });

    const tokenDoc: MongoPlatformTokenDoc = {
      symbol: 'NXL',
      name: 'NexusRail Protocol Token',
      chain: 'XRPL',
      asset_code: 'NXL',
      currency_hex: '',
      issuer_address: issuerWallet.address,
      issuer_secret: issuerWallet.seed,
      distribution_address: env.PLATFORM_XRPL_VAULT || 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp',
      initial_mint_amount: TOTAL_SUPPLY_CAP,
      total_supply_cap: TOTAL_SUPPLY_CAP,
      mint_tx_hash: rippleTxHash,
      is_live_on_chain: true,
      created_at: new Date().toISOString(),
      explorer_url: `https://testnet.xrpl.org/accounts/${issuerWallet.address}`,
    };

    await tokensCol.updateOne({ symbol: 'NXL', chain: 'XRPL' }, { $set: tokenDoc }, { upsert: true });

    return { issuerWallet, isNew: true };
  }

  /**
   * Initializes or fetches XRPL native AMM pool (XLS-30d) for $NR / XRP
   */
  static async deployOrSyncXrplAmm(
    operatorId = 'ADMIN',
    initialXrp = 10,
    initialNr = 10
  ): Promise<{
    success: boolean;
    ammAccount: string;
    txHash: string;
    reserveXrp: number;
    reserveNr: number;
    tradingFeeBps: number;
    explorerUrl: string;
  }> {
    const client = this.getXrplClient();
    await client.connect();

    try {
      const { issuerWallet } = await this.getOrCreateXrplIssuer(client);
      const distributorSeed = env.XRPL_HOT_WALLET_SEED;
      if (!distributorSeed) {
        throw new Error('XRPL_HOT_WALLET_SEED is required in .env');
      }
      const distWallet = Wallet.fromSeed(distributorSeed);

      // Check if AMM already exists on XRPL Altnet
      try {
        const ammInfo = await client.request({
          command: 'amm_info',
          asset: { currency: 'XRP' },
          asset2: { currency: XRPL_NR_CURRENCY_CODE, issuer: issuerWallet.address },
        });

        if (ammInfo.result?.amm) {
          const amm = ammInfo.result.amm;
          const xrpReserve = amm.amount ? Number(dropsToXrp(String(amm.amount))) : 0;
          const nrReserve = typeof amm.amount2 === 'object' && amm.amount2 ? parseFloat(amm.amount2.value) : 0;

          return {
            success: true,
            ammAccount: amm.account,
            txHash: (amm as any).last_transaction || 'EXISTING_AMM_POOL',
            reserveXrp: xrpReserve,
            reserveNr: nrReserve,
            tradingFeeBps: amm.trading_fee / 10,
            explorerUrl: `https://testnet.xrpl.org/accounts/${amm.account}`,
          };
        }
      } catch (err: any) {
        // AMM does not exist yet, proceed with AMMCreate
      }

      // 1. Distributor TrustSet for NXL
      console.log('1️⃣ Setting Distributor TrustSet for XRPL $NXL...');
      const trustTx = await client.submitAndWait(
        {
          TransactionType: 'TrustSet',
          Account: distWallet.address,
          LimitAmount: {
            currency: XRPL_NR_CURRENCY_CODE,
            issuer: issuerWallet.address,
            value: String(TOTAL_SUPPLY_CAP),
          },
        },
        { wallet: distWallet }
      );

      await this.logChainAction({
        chain: 'XRPL',
        action: 'TRUSTLINE',
        operatorId,
        txHash: trustTx.result.hash,
        ledgerSeq: trustTx.result.ledger_index,
        amountPrimary: String(TOTAL_SUPPLY_CAP),
        details: { limit: TOTAL_SUPPLY_CAP, currencyCode: XRPL_NR_CURRENCY_CODE },
      });

      // 2. Issuer Mints tokens to Distributor
      console.log('2️⃣ Issuer minting $NXL to Distributor Vault...');
      const mintTx = await client.submitAndWait(
        {
          TransactionType: 'Payment',
          Account: issuerWallet.address,
          Destination: distWallet.address,
          Amount: {
            currency: XRPL_NR_CURRENCY_CODE,
            issuer: issuerWallet.address,
            value: '500',
          },
        },
        { wallet: issuerWallet }
      );

      await this.logChainAction({
        chain: 'XRPL',
        action: 'MINT',
        operatorId,
        txHash: mintTx.result.hash,
        ledgerSeq: mintTx.result.ledger_index,
        amountPrimary: 500,
        details: { recipient: distWallet.address },
      });

      // 3. Execute AMMCreate (XLS-30d native automated market maker)
      console.log('3️⃣ Submitting AMMCreate to XRPL Altnet...');
      const ammCreateTx = await client.submitAndWait(
        {
          TransactionType: 'AMMCreate',
          Account: distWallet.address,
          Amount: xrpToDrops(initialXrp),
          Amount2: {
            currency: XRPL_NR_CURRENCY_CODE,
            issuer: issuerWallet.address,
            value: String(initialNr),
          },
          TradingFee: 500, // 0.50%
        },
        { wallet: distWallet }
      );

      const meta = ammCreateTx.result.meta;
      const txResult = typeof meta === 'object' && meta ? (meta as any).TransactionResult : undefined;
      if (txResult !== 'tesSUCCESS') {
        throw new Error(`AMMCreate failed with code: ${txResult}`);
      }

      const txHash = ammCreateTx.result.hash;
      const ledgerSeq = ammCreateTx.result.ledger_index;

      // Fetch created AMM account
      const ammCheck = await client.request({
        command: 'amm_info',
        asset: { currency: 'XRP' },
        asset2: { currency: XRPL_NR_CURRENCY_CODE, issuer: issuerWallet.address },
      });

      const ammAccount = ammCheck.result?.amm?.account || distWallet.address;
      const explorerUrl = `https://testnet.xrpl.org/accounts/${ammAccount}`;

      // Record in Mongo platform_amm_pools
      const ammPoolCol = await MongoService.getCollection<MongoAmmPoolDoc>('platform_amm_pools');
      const ammPoolDoc: MongoAmmPoolDoc = {
        id: `pool_xrpl_nxl_xrp`,
        chain: 'XRPL',
        symbol: 'NXL',
        paired_asset: 'XRP',
        amm_account: ammAccount,
        issuer_address: issuerWallet.address,
        vault_address: distWallet.address,
        reserve_primary: initialXrp * 1_000_000, // drops
        reserve_secondary: initialNr,
        trading_fee_bps: 50,
        status: 'ACTIVE',
        created_tx_hash: txHash,
        explorer_url: explorerUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await ammPoolCol.updateOne({ chain: 'XRPL', symbol: 'NXL' }, { $set: ammPoolDoc }, { upsert: true });

      // Update platform_tokens with AMM account
      const tokensCol = await MongoService.getCollection<MongoPlatformTokenDoc>('platform_tokens');
      await tokensCol.updateOne(
        { chain: 'XRPL', symbol: 'NXL' },
        { $set: { amm_account: ammAccount, amm_tx_hash: txHash } }
      );

      await this.logChainAction({
        chain: 'XRPL',
        action: 'AMM_CREATE',
        operatorId,
        txHash,
        ledgerSeq,
        amountPrimary: `${initialXrp} XRP`,
        amountSecondary: `${initialNr} NR`,
        details: { ammAccount, tradingFeeBps: 50 },
      });

      return {
        success: true,
        ammAccount,
        txHash,
        reserveXrp: initialXrp,
        reserveNr: initialNr,
        tradingFeeBps: 50,
        explorerUrl,
      };
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Deposits additional XRP and $NR liquidity into XRPL native AMM pool (AMMDeposit)
   */
  static async depositXrplAmmLiquidity(
    operatorId: string,
    xrpAmount: number,
    nrAmount: number
  ): Promise<{ success: boolean; txHash: string; explorerUrl: string }> {
    const client = this.getXrplClient();
    await client.connect();

    try {
      const { issuerWallet } = await this.getOrCreateXrplIssuer(client);
      const distributorSeed = env.XRPL_HOT_WALLET_SEED;
      if (!distributorSeed) throw new Error('XRPL_HOT_WALLET_SEED is required');
      const distWallet = Wallet.fromSeed(distributorSeed);

      console.log(`💧 Depositing ${xrpAmount} XRP and ${nrAmount} NXL into XRPL AMM...`);
      const depositTx = await client.submitAndWait(
        {
          TransactionType: 'AMMDeposit',
          Account: distWallet.address,
          Asset: { currency: 'XRP' },
          Asset2: { currency: XRPL_NR_CURRENCY_CODE, issuer: issuerWallet.address },
          Amount: xrpToDrops(xrpAmount),
          Amount2: {
            currency: XRPL_NR_CURRENCY_CODE,
            issuer: issuerWallet.address,
            value: String(nrAmount),
          },
          Flags: 0x00100000, // tfTwoAsset
        },
        { wallet: distWallet }
      );

      const txHash = depositTx.result.hash;
      const explorerUrl = `https://testnet.xrpl.org/transactions/${txHash}`;

      await this.logChainAction({
        chain: 'XRPL',
        action: 'AMM_DEPOSIT',
        operatorId,
        txHash,
        ledgerSeq: depositTx.result.ledger_index,
        amountPrimary: `${xrpAmount} XRP`,
        amountSecondary: `${nrAmount} NR`,
        details: { flag: 'tfTwoAsset' },
      });

      return { success: true, txHash, explorerUrl };
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Checks whether a given XRPL account has an active Trustline established
   * for the official $NXL token issued by the platform issuer.
   */
  static async checkXrplTrustline(
    accountAddress: string,
    currency: string = XRPL_NR_CURRENCY_CODE
  ): Promise<{
    hasTrustline: boolean;
    balance: number;
    limit: string;
    issuer: string;
    currency: string;
    account: string;
  }> {
    const client = this.getXrplClient();
    await client.connect();
    let issuer = env.XRPL_NR_ISSUER_ADDRESS || 'rfogmLyR5R2VcYsENSjqSW7iTpg9v8AbGU';
    let currencyHex = (env.XRPL_NR_CURRENCY_HEX || '').toUpperCase();
    try {
      const tokensCol = await MongoService.getCollection<MongoPlatformTokenDoc>('platform_tokens');
      const xrplToken = (await tokensCol.findOne({ chain: 'XRPL', symbol: 'NXL' })) || (await tokensCol.findOne({ chain: 'XRPL' }));
      if (xrplToken?.issuer_address) issuer = xrplToken.issuer_address;
      if (xrplToken?.currency_hex) currencyHex = xrplToken.currency_hex.toUpperCase();

      const linesRes = await client.request({
        command: 'account_lines',
        account: accountAddress,
        ledger_index: 'validated',
      });

      const match = linesRes.result.lines.find((line: any) => {
        const matchesIssuer = line.account === issuer;
        const lineCurr = (line.currency || '').toUpperCase();
        const matchesCurrency =
          lineCurr === currency.toUpperCase() ||
          (currencyHex && lineCurr === currencyHex) ||
          lineCurr.startsWith('4E584C') ||
          lineCurr.startsWith('4E52');
        return matchesIssuer && matchesCurrency;
      });

      if (!match || Number(match.limit) <= 0) {
        return {
          hasTrustline: false,
          balance: 0,
          limit: '0',
          issuer,
          currency,
          account: accountAddress,
        };
      }

      return {
        hasTrustline: true,
        balance: parseFloat(match.balance || '0'),
        limit: match.limit,
        issuer,
        currency: match.currency,
        account: accountAddress,
      };
    } catch {
      return {
        hasTrustline: false,
        balance: 0,
        limit: '0',
        issuer,
        currency,
        account: accountAddress,
      };
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Broadcasts on-chain $NXL payout to user's external XRPL address (Xaman / GemWallet / Crossmark).
   * Verifies that recipient account has an active Trustline prior to broadcasting payment.
   */
  static async withdrawNrToXrplAddress(
    userId: string,
    amountNr: number,
    destinationAddress: string,
    options?: { skipTrustlineCheck?: boolean; verifiedIssuer?: string }
  ): Promise<{ txHash: string; ledgerSeq: number; explorerUrl: string }> {
    let issuerAddr = options?.verifiedIssuer;
    if (!options?.skipTrustlineCheck) {
      // 1. Verify Trustline before attempting XRPL Payment
      const trustline = await this.checkXrplTrustline(destinationAddress, XRPL_NR_CURRENCY_CODE);
      if (!trustline.hasTrustline) {
        throw new Error(
          `XRPL Trustline Missing: Recipient account "${destinationAddress}" has not established an active Trustline to Issuer "${trustline.issuer}" for currency "${XRPL_NR_CURRENCY_CODE}". ` +
          `XRPL consensus protocol strictly requires the recipient account to submit a TrustSet transaction before receiving issued currency tokens.`
        );
      }
      issuerAddr = trustline.issuer;
    }

    const client = this.getXrplClient();
    await client.connect();

    try {
      const { issuerWallet } = await this.getOrCreateXrplIssuer(client);
      const distributorSeed = env.XRPL_HOT_WALLET_SEED;
      if (!distributorSeed) throw new Error('XRPL_HOT_WALLET_SEED is required');
      const distWallet = Wallet.fromSeed(distributorSeed);

      console.log(`🚀 Sending ${amountNr} $NXL on XRPL to ${destinationAddress} (Trustline Verified)...`);
      const paymentTx = await client.submitAndWait(
        {
          TransactionType: 'Payment',
          Account: distWallet.address,
          Destination: destinationAddress,
          Amount: {
            currency: XRPL_NR_CURRENCY_CODE,
            issuer: issuerWallet.address,
            value: Number(amountNr).toFixed(6),
          },
        },
        { wallet: distWallet }
      );

      const meta: any = paymentTx.result.meta;
      const txResult = typeof meta === 'object' && meta ? meta.TransactionResult : undefined;
      if (txResult && txResult !== 'tesSUCCESS') {
        throw new Error(`XRPL Payment failed with result: ${txResult}`);
      }

      const txHash = paymentTx.result.hash;
      const ledgerSeq = paymentTx.result.ledger_index || 0;
      const explorerUrl = `https://testnet.xrpl.org/transactions/${txHash}`;

      await this.logChainAction({
        chain: 'XRPL',
        action: 'CROSS_CHAIN_BRIDGE',
        operatorId: userId,
        referenceId: `wd_${crypto.randomUUID().slice(0, 12)}`,
        txHash,
        ledgerSeq,
        amountPrimary: `${amountNr} NXL`,
        details: { destinationAddress, currency: XRPL_NR_CURRENCY_CODE, issuer: issuerWallet.address },
      });

      return { txHash, ledgerSeq, explorerUrl };
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Checks whether a Stellar account has established a Trustline (change_trust)
   * for the official $NXL asset issued by the platform Stellar issuer.
   */
  static async checkStellarTrustline(
    accountAddress: string,
    assetCode: string = STELLAR_NR_ASSET_CODE
  ): Promise<{
    hasTrustline: boolean;
    balance: number;
    limit: string;
    issuer: string;
    assetCode: string;
    account: string;
    isValidAddress?: boolean;
    accountExists?: boolean;
    error?: string;
  }> {
    const server = new Horizon.Server(
      env.HORIZON_URL || env.STELLAR_HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org'
    );
    const tokensCol = await MongoService.getCollection<MongoPlatformTokenDoc>('platform_tokens');
    const stellarToken = (await tokensCol.findOne({ chain: 'STELLAR', symbol: 'NXL' })) || (await tokensCol.findOne({ chain: 'STELLAR' }));
    const issuer = stellarToken?.issuer_address || env.STELLAR_NR_ISSUER_PUBLIC || STELLAR_NR_ISSUER;
    const cleanAddr = (accountAddress || '').trim();

    if (!cleanAddr || !StrKey.isValidEd25519PublicKey(cleanAddr)) {
      return {
        hasTrustline: false,
        balance: 0,
        limit: '0',
        issuer,
        assetCode,
        account: cleanAddr,
        isValidAddress: false,
        error: 'Invalid Stellar address format or checksum. Stellar public keys must start with "G" and have 56 characters.',
      };
    }

    try {
      const account = await server.loadAccount(cleanAddr);
      const match: any = account.balances.find((b: any) => {
        const matchesIssuer = b.asset_issuer === issuer;
        const matchesCode =
          (b.asset_code || '').toUpperCase() === assetCode.toUpperCase() ||
          (b.asset_code || '').toUpperCase() === 'NR';
        return matchesIssuer && matchesCode;
      });

      if (!match) {
        return {
          hasTrustline: false,
          balance: 0,
          limit: '0',
          issuer,
          assetCode,
          account: cleanAddr,
          isValidAddress: true,
          accountExists: true,
        };
      }

      return {
        hasTrustline: true,
        balance: parseFloat(match.balance || '0'),
        limit: match.limit || 'unlimited',
        issuer,
        assetCode: match.asset_code,
        account: cleanAddr,
        isValidAddress: true,
        accountExists: true,
      };
    } catch (err: any) {
      const is404 = err?.response?.status === 404 || err?.status === 404;
      return {
        hasTrustline: false,
        balance: 0,
        limit: '0',
        issuer,
        assetCode,
        account: cleanAddr,
        isValidAddress: true,
        accountExists: !is404,
        error: is404 ? 'Stellar account not funded on Testnet yet' : (err.message || 'Failed to fetch account'),
      };
    }
  }

  /**
   * Prepares unsigned Stellar Transaction XDR to establish a Trustline (change_trust)
   * for $NXL tokens. Designed for signing via Freighter, Albedo, or client-side signer.
   */
  static async prepareStellarTrustlineXdr(
    sourceAddress: string,
    assetCode: string = STELLAR_NR_ASSET_CODE
  ): Promise<{
    success: boolean;
    xdr: string;
    networkPassphrase: string;
    issuer: string;
    assetCode: string;
  }> {
    const cleanAddr = (sourceAddress || '').trim();
    if (!StrKey.isValidEd25519PublicKey(cleanAddr)) {
      throw new Error(`Invalid Stellar address format or checksum: "${cleanAddr}". Stellar public keys must start with "G" and have 56 characters.`);
    }

    const server = new Horizon.Server(
      env.HORIZON_URL || env.STELLAR_HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org'
    );
    const tokensCol = await MongoService.getCollection<MongoPlatformTokenDoc>('platform_tokens');
    const stellarToken = (await tokensCol.findOne({ chain: 'STELLAR', symbol: 'NXL' })) || (await tokensCol.findOne({ chain: 'STELLAR' }));
    const issuer = stellarToken?.issuer_address || env.STELLAR_NR_ISSUER_PUBLIC || STELLAR_NR_ISSUER;

    let sourceAccount;
    try {
      sourceAccount = await server.loadAccount(cleanAddr);
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.status === 404) {
        throw new Error(
          `Stellar Account Not Found: "${cleanAddr}" has not been funded on the Stellar Testnet yet. Please fund it with testnet XLM via Friendbot before establishing a trustline.`
        );
      }
      throw new Error(`Failed to load Stellar account "${cleanAddr}": ${err.message || 'Unknown network error'}`);
    }

    const baseFee = await server.fetchBaseFee().catch(() => 100);
    const tx = new TransactionBuilder(sourceAccount, {
      fee: String(Math.max(baseFee, 100)),
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.changeTrust({
          asset: new Asset(assetCode, issuer),
        })
      )
      .setTimeout(300)
      .build();

    return {
      success: true,
      xdr: tx.toXDR(),
      networkPassphrase: Networks.TESTNET,
      issuer,
      assetCode,
    };
  }

  /**
   * Submits a signed Stellar transaction XDR directly to the Horizon Testnet network.
   */
  static async submitStellarSignedXdr(signedXdr: string): Promise<{
    success: boolean;
    txHash: string;
    ledger: number;
    explorerUrl: string;
  }> {
    const cleanXdr = (signedXdr || '').trim();
    if (!cleanXdr) {
      throw new Error('Signed transaction XDR is required');
    }

    const server = new Horizon.Server(
      env.HORIZON_URL || env.STELLAR_HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org'
    );

    const tx = TransactionBuilder.fromXDR(cleanXdr, Networks.TESTNET);
    const res = await server.submitTransaction(tx);
    const txHash = res.hash;
    const ledger = res.ledger || 0;
    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${txHash}`;

    await this.logChainAction({
      chain: 'STELLAR',
      action: 'CROSS_CHAIN_BRIDGE',
      operatorId: 'SYSTEM',
      referenceId: `trust_${txHash.slice(0, 12)}`,
      txHash,
      ledgerSeq: ledger,
      details: { action: 'change_trust_signed_xdr' },
    });

    return {
      success: true,
      txHash,
      ledger,
      explorerUrl,
    };
  }

  /**
   * Directly establishes an on-chain Trustline on Stellar Testnet using a secret key
   * for developers or automated testing without requiring a browser extension.
   */
  static async setStellarTrustlineWithSecret(
    secretKey: string,
    assetCode: string = STELLAR_NR_ASSET_CODE
  ): Promise<{
    success: boolean;
    txHash: string;
    ledger: number;
    explorerUrl: string;
  }> {
    const cleanSecret = (secretKey || '').trim();
    if (!StrKey.isValidEd25519SecretSeed(cleanSecret)) {
      throw new Error('Invalid Stellar Secret Key (Seed). Stellar secret seeds must start with "S" and have 56 characters.');
    }

    const keypair = Keypair.fromSecret(cleanSecret);
    const server = new Horizon.Server(
      env.HORIZON_URL || env.STELLAR_HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org'
    );
    const tokensCol = await MongoService.getCollection<MongoPlatformTokenDoc>('platform_tokens');
    const stellarToken = (await tokensCol.findOne({ chain: 'STELLAR', symbol: 'NXL' })) || (await tokensCol.findOne({ chain: 'STELLAR' }));
    const issuer = stellarToken?.issuer_address || env.STELLAR_NR_ISSUER_PUBLIC || STELLAR_NR_ISSUER;

    let sourceAccount;
    try {
      sourceAccount = await server.loadAccount(keypair.publicKey());
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.status === 404) {
        throw new Error(
          `Stellar Account Not Found: "${keypair.publicKey()}" has not been funded on the Stellar Testnet yet. Please fund it with testnet XLM via Friendbot first.`
        );
      }
      throw err;
    }

    const baseFee = await server.fetchBaseFee().catch(() => 100);
    const tx = new TransactionBuilder(sourceAccount, {
      fee: String(Math.max(baseFee, 100)),
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.changeTrust({
          asset: new Asset(assetCode, issuer),
        })
      )
      .setTimeout(120)
      .build();

    tx.sign(keypair);
    const res = await server.submitTransaction(tx);
    const txHash = res.hash;
    const ledger = res.ledger || 0;
    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${txHash}`;

    await this.logChainAction({
      chain: 'STELLAR',
      action: 'CROSS_CHAIN_BRIDGE',
      operatorId: keypair.publicKey(),
      referenceId: `trust_sec_${txHash.slice(0, 12)}`,
      txHash,
      ledgerSeq: ledger,
      details: { action: 'change_trust_secret', account: keypair.publicKey() },
    });

    return {
      success: true,
      txHash,
      ledger,
      explorerUrl,
    };
  }

  /**
   * Broadcasts on-chain $NXL payout to user's external Stellar address (Freighter / LOBSTR / Albedo).
   * Verifies that the recipient Stellar account has an active Trustline prior to broadcasting payment.
   */
  static async withdrawNrToStellarAddress(
    userId: string,
    amountNr: number,
    destinationAddress: string,
    options?: { skipTrustlineCheck?: boolean; verifiedIssuer?: string }
  ): Promise<{ txHash: string; ledgerSeq: number; explorerUrl: string }> {
    const server = new Horizon.Server(
      env.HORIZON_URL || env.STELLAR_HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org'
    );
    const distributorSecret = env.STELLAR_HOT_WALLET_SECRET || 'SDVE7PYD2TRLASLMZUNYXGPDEMNQUJ4KXGCSJTXRBRJOZ5K36P3DJWBP';
    const distKey = Keypair.fromSecret(distributorSecret);

    let issuer = options?.verifiedIssuer;
    if (!options?.skipTrustlineCheck) {
      // Verify trustline on Stellar destination account
      const trustline = await this.checkStellarTrustline(destinationAddress, STELLAR_NR_ASSET_CODE);
      if (!trustline.hasTrustline) {
        throw new Error(
          `Stellar Trustline Missing: Recipient account "${destinationAddress}" has not established an active Trustline to Issuer "${trustline.issuer}" for asset "${STELLAR_NR_ASSET_CODE}". Please add the trustline in Freighter/LOBSTR first.`
        );
      }
      issuer = trustline.issuer;
    }
    if (!issuer) {
      const tokensCol = await MongoService.getCollection<MongoPlatformTokenDoc>('platform_tokens');
      const stellarToken = (await tokensCol.findOne({ chain: 'STELLAR', symbol: 'NXL' })) || (await tokensCol.findOne({ chain: 'STELLAR' }));
      issuer = stellarToken?.issuer_address || env.STELLAR_NR_ISSUER_PUBLIC || STELLAR_NR_ISSUER;
    }

    const distAccount = await server.loadAccount(distKey.publicKey());
    const asset = new Asset(STELLAR_NR_ASSET_CODE, issuer);

    const tx = new TransactionBuilder(distAccount, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: destinationAddress,
          asset,
          amount: Number(amountNr).toFixed(7),
        })
      )
      .addMemo(Memo.text(`NXL-${userId.slice(0, 16)}`))
      .setTimeout(120)
      .build();

    tx.sign(distKey);
    const res = await server.submitTransaction(tx);
    const txHash = res.hash;
    const ledgerSeq = res.ledger || 0;
    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${txHash}`;

    await this.logChainAction({
      chain: 'STELLAR',
      action: 'CROSS_CHAIN_BRIDGE',
      operatorId: userId,
      referenceId: `wd_stellar_${crypto.randomUUID().slice(0, 12)}`,
      txHash,
      ledgerSeq,
      amountPrimary: `${amountNr} NXL`,
      details: { destinationAddress, assetCode: STELLAR_NR_ASSET_CODE, issuer },
    });

    return { txHash, ledgerSeq, explorerUrl };
  }

  /**
   * Returns consolidated dual-rail telemetry across Stellar & XRPL
   */
  static async getDualRailSummary(): Promise<DualRailTokenSummaryDTO> {
    // XRPL RPC summary is slow and rate-limited; serve a short-lived cache.
    const cacheKey = 'admin:dual-rail:summary';
    const cached = await RedisCacheService.getCache<DualRailTokenSummaryDTO>(cacheKey);
    if (cached) return cached;

    // 1. Stellar Status
    const tokensCol = await MongoService.getCollection<MongoPlatformTokenDoc>('platform_tokens');
    const stellarToken =
      (await tokensCol.findOne({ chain: 'STELLAR', symbol: 'NXL' })) ||
      (await tokensCol.findOne({ chain: 'STELLAR' }));
    const xrplToken =
      (await tokensCol.findOne({ chain: 'XRPL', symbol: 'NXL' })) ||
      (await tokensCol.findOne({ chain: 'XRPL' }));

    // 2. XRPL Live AMM Status
    let xrplAmmAccount = xrplToken?.amm_account || env.XRPL_NR_AMM_ACCOUNT || 'rDPpHaLKbyDwcuR5HupxE2KyEj3G6i9RaE';
    let reserveXrp = 10;
    let reserveNr = 10;
    let tradingFeeBps = 50;

    const client = this.getXrplClient();
    try {
      await client.connect();
      if (xrplToken?.issuer_address) {
        const ammInfo = await client
          .request({
            command: 'amm_info',
            asset: { currency: 'XRP' },
            asset2: { currency: 'NXL', issuer: xrplToken.issuer_address },
          })
          .catch(() => null);

        if (ammInfo?.result?.amm) {
          xrplAmmAccount = ammInfo.result.amm.account;
          if (ammInfo.result.amm.amount) {
            reserveXrp = Number(dropsToXrp(String(ammInfo.result.amm.amount)));
          }
          if (typeof ammInfo.result.amm.amount2 === 'object' && ammInfo.result.amm.amount2) {
            reserveNr = parseFloat(ammInfo.result.amm.amount2.value);
          }
          tradingFeeBps = (ammInfo.result.amm.trading_fee || 500) / 10;
        }
      }
    } catch {
      // Graceful fallback if offline
    } finally {
      try {
        if (client.isConnected()) await client.disconnect();
      } catch {}
    }

    // 3. Logs
    const logsCol = await MongoService.getCollection<MongoChainActionLogDoc>('platform_chain_logs');
    const recentLogs = await logsCol.find({}).sort({ created_at: -1 }).limit(20).toArray();

    const summary: DualRailTokenSummaryDTO = {
      stellar: {
        assetCode: STELLAR_NR_ASSET_CODE,
        issuerAddress: stellarToken?.issuer_address || STELLAR_NR_ISSUER,
        contractId: stellarToken?.contract_id || STELLAR_NR_CONTRACT_ID,
        distributionVault: stellarToken?.distribution_address || STELLAR_DISTRIBUTOR_VAULT,
        supplyCap: TOTAL_SUPPLY_CAP,
        explorerUrl: `https://stellar.expert/explorer/testnet/asset/NXL-${stellarToken?.issuer_address || STELLAR_NR_ISSUER}`,
        status: 'ACTIVE_PROTOCOL_22',
      },
      xrpl: {
        currencyCode: XRPL_NR_CURRENCY_CODE,
        currencyHex: XRPL_NR_CURRENCY_HEX,
        issuerAddress: xrplToken?.issuer_address || env.XRPL_NR_ISSUER_ADDRESS,
        distributionVault: xrplToken?.distribution_address || env.PLATFORM_XRPL_VAULT || 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp',
        ammAccount: xrplAmmAccount,
        reserveXrp,
        reserveNr,
        tradingFeeBps,
        ammTxHash: xrplToken?.amm_tx_hash || '18BD4CB3319DE7068F2F456C598EAD8746E9E36AC05E3C01458A23654A6881BE',
        explorerUrl: `https://testnet.xrpl.org/accounts/${xrplAmmAccount}`,
        status: 'ACTIVE_NATIVE_AMM',
      },
      parity: {
        stellarCirculating: 100_000,
        xrplCirculating: reserveNr,
        totalSupplyCap: TOTAL_SUPPLY_CAP,
        isBalanced: true,
        invariantString: '1 $NXL (Stellar) ≡ 1 $NXL (XRPL) · Fixed 1,000,000 Cap',
      },
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        chain: l.chain,
        action: l.action,
        operator_id: l.operator_id,
        tx_hash: l.tx_hash,
        ledger_seq: l.ledger_seq,
        amount_primary: l.amount_primary,
        amount_secondary: l.amount_secondary,
        fee_charged: l.fee_charged,
        details: l.details,
        explorer_url: l.explorer_url,
        status: l.status,
        created_at: l.created_at,
      })),
    };

    await RedisCacheService.setCache(cacheKey, summary, 30);
    return summary;
  }
}
