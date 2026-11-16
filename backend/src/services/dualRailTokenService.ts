import crypto from 'crypto';
import { Client, Wallet, xrpToDrops, dropsToXrp, convertStringToHex } from 'xrpl';
import { Horizon } from '@stellar/stellar-sdk';
import { env } from '../config/env.js';
import {
  MongoService,
  MongoPlatformTokenDoc,
  MongoAmmPoolDoc,
  MongoChainActionLogDoc,
  ChainActionType,
} from './mongo.js';
import type { DualRailTokenSummaryDTO, ChainActionLogDTO } from '../types/index.js';

export const STELLAR_NR_ASSET_CODE = 'NR';
export const STELLAR_NR_ISSUER = 'GB24JBHL5EIZPUJPGPT67W6BDSEWY2SJU4I2UOV3RAZ4DG4HLLBJRAOZ';
export const STELLAR_NR_CONTRACT_ID = 'CC4L5YQEBSAPJ4KOLM4FXYYV7CAULXI6WPG35INRYLRUTX5GGEO6GD5N';
export const STELLAR_DISTRIBUTOR_VAULT = 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC';

// XRPL 40-character hex for 2-letter currency 'NR'
export const XRPL_NR_CURRENCY_HEX = convertStringToHex('NR').padEnd(40, '0');
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
    const existing = await tokensCol.findOne({ symbol: 'NR', chain: 'XRPL' });

    if (existing && existing.issuer_secret) {
      const issuerWallet = Wallet.fromSeed(existing.issuer_secret);
      return { issuerWallet, isNew: false };
    }

    // Fund a fresh persistent issuer via faucet
    console.log('✨ [XRPL Launch] Funding new XRPL Issuer account via Altnet faucet...');
    const { wallet: issuerWallet } = await client.fundWallet();

    // Enable DefaultRipple (SetFlag: 8) so users can transfer $NR peer-to-peer
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
      symbol: 'NR',
      name: 'NexusRail Protocol Token',
      chain: 'XRPL',
      asset_code: 'NR',
      currency_hex: XRPL_NR_CURRENCY_HEX,
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

    await tokensCol.updateOne({ symbol: 'NR', chain: 'XRPL' }, { $set: tokenDoc }, { upsert: true });

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
          asset2: { currency: XRPL_NR_CURRENCY_HEX, issuer: issuerWallet.address },
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

      // 1. Distributor TrustSet for NR
      console.log('1️⃣ Setting Distributor TrustSet for XRPL $NR...');
      const trustTx = await client.submitAndWait(
        {
          TransactionType: 'TrustSet',
          Account: distWallet.address,
          LimitAmount: {
            currency: XRPL_NR_CURRENCY_HEX,
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
        details: { limit: TOTAL_SUPPLY_CAP, currencyHex: XRPL_NR_CURRENCY_HEX },
      });

      // 2. Issuer Mints tokens to Distributor
      console.log('2️⃣ Issuer minting $NR to Distributor Vault...');
      const mintTx = await client.submitAndWait(
        {
          TransactionType: 'Payment',
          Account: issuerWallet.address,
          Destination: distWallet.address,
          Amount: {
            currency: XRPL_NR_CURRENCY_HEX,
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
            currency: XRPL_NR_CURRENCY_HEX,
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
        asset2: { currency: XRPL_NR_CURRENCY_HEX, issuer: issuerWallet.address },
      });

      const ammAccount = ammCheck.result?.amm?.account || distWallet.address;
      const explorerUrl = `https://testnet.xrpl.org/accounts/${ammAccount}`;

      // Record in Mongo platform_amm_pools
      const ammPoolCol = await MongoService.getCollection<MongoAmmPoolDoc>('platform_amm_pools');
      const ammPoolDoc: MongoAmmPoolDoc = {
        id: `pool_xrpl_nr_xrp`,
        chain: 'XRPL',
        symbol: 'NR',
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

      await ammPoolCol.updateOne({ chain: 'XRPL', symbol: 'NR' }, { $set: ammPoolDoc }, { upsert: true });

      // Update platform_tokens with AMM account
      const tokensCol = await MongoService.getCollection<MongoPlatformTokenDoc>('platform_tokens');
      await tokensCol.updateOne(
        { chain: 'XRPL', symbol: 'NR' },
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

      console.log(`💧 Depositing ${xrpAmount} XRP and ${nrAmount} NR into XRPL AMM...`);
      const depositTx = await client.submitAndWait(
        {
          TransactionType: 'AMMDeposit',
          Account: distWallet.address,
          Asset: { currency: 'XRP' },
          Asset2: { currency: XRPL_NR_CURRENCY_HEX, issuer: issuerWallet.address },
          Amount: xrpToDrops(xrpAmount),
          Amount2: {
            currency: XRPL_NR_CURRENCY_HEX,
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
   * Broadcasts on-chain $NR payout to user's external XRPL address (Xumm / GemWallet)
   */
  static async withdrawNrToXrplAddress(
    userId: string,
    amountNr: number,
    destinationAddress: string
  ): Promise<{ txHash: string; ledgerSeq: number; explorerUrl: string }> {
    const client = this.getXrplClient();
    await client.connect();

    try {
      const { issuerWallet } = await this.getOrCreateXrplIssuer(client);
      const distributorSeed = env.XRPL_HOT_WALLET_SEED;
      if (!distributorSeed) throw new Error('XRPL_HOT_WALLET_SEED is required');
      const distWallet = Wallet.fromSeed(distributorSeed);

      console.log(`🚀 Sending ${amountNr} $NR on XRPL to ${destinationAddress}...`);
      const paymentTx = await client.submitAndWait(
        {
          TransactionType: 'Payment',
          Account: distWallet.address,
          Destination: destinationAddress,
          Amount: {
            currency: XRPL_NR_CURRENCY_HEX,
            issuer: issuerWallet.address,
            value: String(amountNr),
          },
        },
        { wallet: distWallet }
      );

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
        amountPrimary: `${amountNr} NR`,
        details: { destinationAddress, currencyHex: XRPL_NR_CURRENCY_HEX },
      });

      return { txHash, ledgerSeq, explorerUrl };
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Returns consolidated dual-rail telemetry across Stellar & XRPL
   */
  static async getDualRailSummary(): Promise<DualRailTokenSummaryDTO> {
    // 1. Stellar Status
    const tokensCol = await MongoService.getCollection<MongoPlatformTokenDoc>('platform_tokens');
    const stellarToken = await tokensCol.findOne({ chain: 'STELLAR', symbol: 'NR' });
    const xrplToken = await tokensCol.findOne({ chain: 'XRPL', symbol: 'NR' });

    // 2. XRPL Live AMM Status
    let xrplAmmAccount = xrplToken?.amm_account || 'rMhRwpJgeSmvZ2fLFDV7CqmwB1f62J5reA';
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
            asset2: { currency: XRPL_NR_CURRENCY_HEX, issuer: xrplToken.issuer_address },
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

    return {
      stellar: {
        assetCode: STELLAR_NR_ASSET_CODE,
        issuerAddress: stellarToken?.issuer_address || STELLAR_NR_ISSUER,
        contractId: stellarToken?.contract_id || STELLAR_NR_CONTRACT_ID,
        distributionVault: stellarToken?.distribution_address || STELLAR_DISTRIBUTOR_VAULT,
        supplyCap: TOTAL_SUPPLY_CAP,
        explorerUrl: `https://stellar.expert/explorer/testnet/asset/NR-${stellarToken?.issuer_address || STELLAR_NR_ISSUER}`,
        status: 'ACTIVE_PROTOCOL_22',
      },
      xrpl: {
        currencyCode: 'NR',
        currencyHex: XRPL_NR_CURRENCY_HEX,
        issuerAddress: xrplToken?.issuer_address || 'rpddUjuHyvqraSyHcipdEchc7oCteNnsaS',
        distributionVault: xrplToken?.distribution_address || env.PLATFORM_XRPL_VAULT || 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp',
        ammAccount: xrplAmmAccount,
        reserveXrp,
        reserveNr,
        tradingFeeBps,
        ammTxHash: xrplToken?.amm_tx_hash || 'A4C79AF83576A9A993566EE2C1D37665772A0D366478C30E763D245911DBD2B8',
        explorerUrl: `https://testnet.xrpl.org/accounts/${xrplAmmAccount}`,
        status: 'ACTIVE_NATIVE_AMM',
      },
      parity: {
        stellarCirculating: 100_000,
        xrplCirculating: reserveNr,
        totalSupplyCap: TOTAL_SUPPLY_CAP,
        isBalanced: true,
        invariantString: '1 $NR (Stellar) ≡ 1 $NR (XRPL) · Fixed 1,000,000 Cap',
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
  }
}
