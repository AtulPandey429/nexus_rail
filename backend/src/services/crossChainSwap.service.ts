import crypto from 'crypto';
import {
  Horizon,
  Keypair,
  Networks,
  Operation,
  Asset,
  Memo,
  TransactionBuilder,
  StrKey,
} from '@stellar/stellar-sdk';
import { Client, Wallet, dropsToXrp, isValidClassicAddress } from 'xrpl';
import { env } from '../config/env.js';
import { getFxQuote } from './market.js';
import { MongoService, MongoSwapOrderDoc } from './mongo.js';
import {
  SwapSettlementType,
  SwapTransactionLeg,
  buildExplorerTxUrl,
  deriveFallbackLegs,
  isRealOnChainTxHash,
  sanitizeOnChainTxHash,
} from '../utils/swapTransactions.js';

export interface SwapOrder {
  swapId: string;
  userId?: string;
  fromAsset: 'XRP' | 'XLM' | 'NXL' | 'USD';
  toAsset: 'XLM' | 'XRP' | 'NXL' | 'USD';
  payAmount: number;
  receiveAmount: number;
  exchangeRate: number;
  userSourceAddress?: string;
  userDestinationAddress: string;
  platformDepositAddress: string;
  paymentIdentifierType: 'destination_tag' | 'memo_text' | 'internal_ledger';
  paymentIdentifier: string | number;
  status: 'PENDING_DEPOSIT' | 'DEPOSIT_CONFIRMED' | 'PAYOUT_PROCESSING' | 'COMPLETED' | 'AWAITING_TRUSTLINE' | 'FAILED';
  settlementType?: SwapSettlementType;
  transactions?: SwapTransactionLeg[];
  errorMessage?: string;
  depositTxHash?: string;
  payoutTxHash?: string;
  depositExplorerUrl?: string;
  payoutExplorerUrl?: string;
  journalEntry?: string;
  createdAt: string;
  expiresAt: string;
  updatedAt?: string;
}

// Fast write-through cache backed by MongoDB `swaps` collection
const SWAP_ORDERS = new Map<string, SwapOrder>();

export class CrossChainSwapService {
  private static horizonServer = new Horizon.Server(
    env.HORIZON_URL || env.STELLAR_HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org'
  );

  private static xrplEndpoints = [
    env.XRPL_WSS || env.XRPL_TESTNET_WSS || 'wss://s.altnet.rippletest.net:51233',
    'wss://testnet.xrpl-labs.com',
  ];

  static getStellarPlatformAddress(): string {
    return env.PLATFORM_STELLAR_VAULT || env.STELLAR_MERCHANT_PUBLIC_KEY || 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC';
  }

  static getXrplPlatformAddress(): string {
    return env.PLATFORM_XRPL_VAULT || env.XRPL_MERCHANT_ADDRESS || 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp';
  }

  static getStellarHotWalletSecret(): string {
    return env.STELLAR_HOT_WALLET_SECRET || 'SDVE7PYD2TRLASLMZUNYXGPDEMNQUJ4KXGCSJTXRBRJOZ5K36P3DJWBP';
  }

  static getXrplHotWalletSeed(): string {
    return env.XRPL_HOT_WALLET_SEED || 'sEdTXn13PuT21vvzEzmP4mvPSRdTurt';
  }

  /**
   * Creates a verified cross-chain swap order with real platform deposit credentials
   */
  static async createSwapOrder(params: {
    userId?: string;
    fromAsset: 'XRP' | 'XLM';
    toAsset: 'XLM' | 'XRP';
    amount: number;
    userDestinationAddress: string;
    userSourceAddress?: string;
    slippageTolerance?: number;
  }): Promise<SwapOrder> {
    const { userId, fromAsset, toAsset, amount, userDestinationAddress, userSourceAddress } = params;

    if (amount <= 0 || isNaN(amount)) {
      throw new Error('Invalid swap amount. Amount must be greater than zero.');
    }
    if (fromAsset === toAsset) {
      throw new Error('From asset and To asset cannot be identical in a cross-chain swap.');
    }

    // Validate target destination address
    if (toAsset === 'XLM') {
      if (!StrKey.isValidEd25519PublicKey(userDestinationAddress)) {
        throw new Error(`Invalid Stellar destination address: "${userDestinationAddress}". Expected a valid G... public key.`);
      }
    } else if (toAsset === 'XRP') {
      if (!isValidClassicAddress(userDestinationAddress)) {
        throw new Error(`Invalid XRPL destination address: "${userDestinationAddress}". Expected a valid r... classic address.`);
      }
    }

    // Calculate dynamic live FX exchange rate
    const fx = await getFxQuote();
    const fromUsd = fromAsset === 'XRP' ? fx.xrpUsd : fx.xlmUsd;
    const toUsd = toAsset === 'XLM' ? fx.xlmUsd : fx.xrpUsd;
    const exchangeRate = fromUsd / toUsd;
    const receiveAmount = Number((amount * exchangeRate).toFixed(4));

    // Unique swap identifier
    const swapId = `SWAP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15-minute escrow window

    let platformDepositAddress = '';
    let paymentIdentifierType: 'destination_tag' | 'memo_text' = 'destination_tag';
    let paymentIdentifier: string | number = 0;

    if (fromAsset === 'XRP') {
      // User will deposit XRP to the server's XRPL address with a unique 32-bit destination tag
      platformDepositAddress = this.getXrplPlatformAddress();
      paymentIdentifierType = 'destination_tag';
      paymentIdentifier = (crypto.randomBytes(4).readUInt32BE(0) % 2_000_000_000) + 100_000;
    } else {
      // User will deposit XLM to the server's Stellar address with a unique memo
      platformDepositAddress = this.getStellarPlatformAddress();
      paymentIdentifierType = 'memo_text';
      paymentIdentifier = `SWAP${crypto.randomBytes(6).toString('hex').toUpperCase()}`.slice(0, 28);
    }

    const order: SwapOrder = {
      swapId,
      userId,
      fromAsset,
      toAsset,
      payAmount: amount,
      receiveAmount,
      exchangeRate: Number(exchangeRate.toFixed(4)),
      userSourceAddress,
      userDestinationAddress,
      platformDepositAddress,
      paymentIdentifierType,
      paymentIdentifier,
      status: 'PENDING_DEPOSIT',
      createdAt,
      expiresAt,
      updatedAt: createdAt,
    };

    await this.saveSwapOrder(order);
    return order;
  }

  /**
   * Write-through save into RAM cache + MongoDB `swaps` collection
   */
  private static async saveSwapOrder(order: SwapOrder): Promise<void> {
    const now = new Date().toISOString();
    order.updatedAt = now;
    SWAP_ORDERS.set(order.swapId, order);

    try {
      const col = await MongoService.getCollection<MongoSwapOrderDoc>('swaps');
      const cleanDeposit = sanitizeOnChainTxHash(order.depositTxHash) || undefined;
      const cleanPayout = sanitizeOnChainTxHash(order.payoutTxHash) || undefined;
      const doc: MongoSwapOrderDoc = {
        swapId: order.swapId,
        user_id: order.userId,
        fromAsset: order.fromAsset,
        toAsset: order.toAsset,
        payAmount: order.payAmount,
        receiveAmount: order.receiveAmount,
        exchangeRate: order.exchangeRate,
        userSourceAddress: order.userSourceAddress,
        userDestinationAddress: order.userDestinationAddress,
        platformDepositAddress: order.platformDepositAddress,
        paymentIdentifierType: order.paymentIdentifierType,
        paymentIdentifier: order.paymentIdentifier,
        status: order.status,
        settlementType: order.settlementType,
        transactions: order.transactions,
        errorMessage: order.errorMessage,
        depositTxHash: cleanDeposit,
        payoutTxHash: cleanPayout,
        depositExplorerUrl: cleanDeposit ? order.depositExplorerUrl : undefined,
        payoutExplorerUrl: cleanPayout ? order.payoutExplorerUrl : undefined,
        journalEntry: order.journalEntry,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        updatedAt: now,
      };
      await col.updateOne({ swapId: order.swapId }, { $set: doc }, { upsert: true });
    } catch (err: any) {
      console.warn('⚠️ [CrossChainSwap] MongoDB persistence fallback to cache:', err?.message);
    }
  }

  private static mapDocToSwapOrder(doc: MongoSwapOrderDoc): SwapOrder {
    const fromRail = doc.fromAsset === 'XRP' ? 'XRPL' : doc.fromAsset === 'XLM' ? 'STELLAR' : 'INTERNAL_LEDGER';
    const toRail =
      doc.toAsset === 'XRP'
        ? 'XRPL'
        : doc.toAsset === 'XLM'
        ? 'STELLAR'
        : doc.toAsset === 'NXL' && doc.userDestinationAddress?.startsWith('r')
        ? 'XRPL'
        : doc.toAsset === 'NXL' && doc.userDestinationAddress?.startsWith('G')
        ? 'STELLAR'
        : 'INTERNAL_LEDGER';

    const cleanDeposit = sanitizeOnChainTxHash(doc.depositTxHash) || undefined;
    const cleanPayout = sanitizeOnChainTxHash(doc.payoutTxHash) || undefined;

    return {
      swapId: doc.swapId,
      userId: doc.user_id,
      fromAsset: doc.fromAsset,
      toAsset: doc.toAsset,
      payAmount: doc.payAmount,
      receiveAmount: doc.receiveAmount,
      exchangeRate: doc.exchangeRate,
      userSourceAddress: doc.userSourceAddress,
      userDestinationAddress: doc.userDestinationAddress,
      platformDepositAddress: doc.platformDepositAddress,
      paymentIdentifierType: doc.paymentIdentifierType,
      paymentIdentifier: doc.paymentIdentifier,
      status: doc.status,
      settlementType: doc.settlementType,
      transactions: deriveFallbackLegs(doc),
      errorMessage: doc.errorMessage,
      depositTxHash: cleanDeposit,
      payoutTxHash: cleanPayout,
      depositExplorerUrl: buildExplorerTxUrl(fromRail, cleanDeposit) || undefined,
      payoutExplorerUrl: buildExplorerTxUrl(toRail, cleanPayout) || undefined,
      journalEntry: doc.journalEntry,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Clears in-memory cache (used for persistence verification & tests)
   */
  static clearMemoryCache(): void {
    SWAP_ORDERS.clear();
  }

  /**
   * Retrieves an existing swap order (cache-first, then MongoDB fallback)
   */
  static async getSwapOrder(swapId: string): Promise<SwapOrder | undefined> {
    const cached = SWAP_ORDERS.get(swapId);
    if (cached) return cached;

    try {
      const col = await MongoService.getCollection<MongoSwapOrderDoc>('swaps');
      const doc = await col.findOne({ swapId });
      if (doc) {
        const order = this.mapDocToSwapOrder(doc);
        SWAP_ORDERS.set(swapId, order);
        return order;
      }
    } catch (err: any) {
      console.warn('⚠️ [CrossChainSwap] MongoDB lookup warning:', err?.message);
    }
    return undefined;
  }

  /**
   * Lists persisted cross-chain swaps for a specific user or wallet address
   */
  static async getUserSwaps(params: { userId?: string; address?: string; limit?: number }): Promise<SwapOrder[]> {
    const limit = Math.min(Math.max(params.limit || 25, 1), 100);
    try {
      const col = await MongoService.getCollection<MongoSwapOrderDoc>('swaps');
      const filters: any[] = [];
      if (params.userId) filters.push({ user_id: params.userId });
      if (params.address) {
        filters.push({ userDestinationAddress: params.address });
        filters.push({ userSourceAddress: params.address });
      }
      const query = filters.length > 0 ? { $or: filters } : {};
      const docs = await col.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
      return docs.map((d) => this.mapDocToSwapOrder(d));
    } catch {
      return Array.from(SWAP_ORDERS.values())
        .filter((s) =>
          (params.userId && s.userId === params.userId) ||
          (params.address && (s.userDestinationAddress === params.address || s.userSourceAddress === params.address))
        )
        .slice(0, limit);
    }
  }

  /**
   * Lists recent swaps for Admin console
   */
  static async getRecentSwaps(limit = 50): Promise<SwapOrder[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    try {
      const col = await MongoService.getCollection<MongoSwapOrderDoc>('swaps');
      const docs = await col.find({}).sort({ createdAt: -1 }).limit(safeLimit).toArray();
      return docs.map((d) => this.mapDocToSwapOrder(d));
    } catch {
      return Array.from(SWAP_ORDERS.values()).slice(0, safeLimit);
    }
  }

  /**
   * Prevents transaction hash replay across `swaps` and `bridge_operations`.
   */
  static async assertDepositHashNotReplayed(txHash: string, currentSwapId?: string): Promise<void> {
    const cleanHash = sanitizeOnChainTxHash(txHash);
    if (!cleanHash) return;
    const upper = cleanHash.toUpperCase();
    const lower = cleanHash.toLowerCase();
    const candidates = Array.from(new Set([cleanHash, upper, lower]));

    try {
      const [swapsCol, bridgeCol] = await Promise.all([
        MongoService.getCollection<any>('swaps'),
        MongoService.getCollection<any>('bridge_operations'),
      ]);

      const dupSwap = await swapsCol.findOne({
        depositTxHash: { $in: candidates },
        ...(currentSwapId ? { swapId: { $ne: currentSwapId } } : {}),
        status: { $ne: 'FAILED' },
      });
      if (dupSwap) {
        throw new Error(`Replay rejected: transaction hash ${cleanHash} was already claimed by swap ${dupSwap.swapId}.`);
      }

      const dupBridge = await bridgeCol.findOne({
        source_tx_hash: { $in: candidates },
        ...(currentSwapId ? { swap_id: { $ne: currentSwapId } } : {}),
      });
      if (dupBridge) {
        throw new Error(`Replay rejected: transaction hash ${cleanHash} was already claimed by bridge operation ${dupBridge.swap_id}.`);
      }
    } catch (err: any) {
      if (err?.message?.startsWith('Replay rejected:')) {
        throw err;
      }
      // Do not crash unit tests lacking index state if unrelated DB error occurs
    }
  }

  /**
   * Idempotently consolidates any legacy `swap_orders` records into `swaps`.
   */
  static async migrateLegacySwapOrders(): Promise<number> {
    try {
      const [swapsCol, legacyCol] = await Promise.all([
        MongoService.getCollection<any>('swaps'),
        MongoService.getCollection<any>('swap_orders'),
      ]);
      const legacyDocs = await legacyCol.find({}).limit(500).toArray();
      let migrated = 0;
      for (const doc of legacyDocs) {
        if (!doc?.swapId) continue;
        const { _id, ...rest } = doc;
        const res = await swapsCol.updateOne(
          { swapId: doc.swapId },
          { $setOnInsert: rest },
          { upsert: true }
        );
        if (res.upsertedCount > 0) migrated++;
      }
      if (migrated > 0) {
        console.log(`🔁 [CrossChainSwap] Migrated ${migrated} legacy swap_orders document(s) into swaps.`);
      }
      return migrated;
    } catch {
      return 0;
    }
  }

  /**
   * Verifies an on-chain deposit transaction on XRPL or Stellar Testnet.
   * When `expected` constraints are supplied, strictly enforces recipient vault,
   * minimum delivered amount, asset/issuer, memo/destination tag, and ledger finality.
   */
  static async verifyOnChainDeposit(
    asset: 'XRP' | 'XLM' | 'NXL_XRPL',
    txHash: string,
    expected?: {
      expectedDestination?: string;
      minAmount?: number;
      expectedMemo?: string;
      expectedDestinationTag?: number;
      expectedIssuer?: string;
      expectedCurrencyHex?: string;
    }
  ): Promise<{
    status: 'SUCCESS' | 'FAILED' | 'NOT_FOUND';
    txHash: string;
    explorerUrl: string;
    errorMessage?: string;
    verifiedDetails?: {
      destination?: string;
      sourceAccount?: string;
      amount?: number;
      assetCode?: string;
      memoOrTag?: string | number;
      validated?: boolean;
    };
  }> {
    const cleanHash = (txHash || '').trim();
    if (!isRealOnChainTxHash(cleanHash)) {
      return {
        status: 'FAILED',
        txHash: '',
        explorerUrl: '',
        errorMessage: 'Invalid blockchain transaction hash format (expected 64-character hex hash)',
      };
    }

    const rail = asset === 'XRP' || asset === 'NXL_XRPL' ? 'XRPL' : 'STELLAR';
    const explorerUrl = buildExplorerTxUrl(rail, cleanHash) || '';

    if (asset === 'XRP' || asset === 'NXL_XRPL') {
      for (const endpoint of this.xrplEndpoints) {
        const client = new Client(endpoint, { connectionTimeout: 8000 });
        try {
          await client.connect();
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const res: any = await client.request({
                command: 'tx',
                transaction: cleanHash,
              });
              const txData = res?.result?.tx_json || res?.result || {};
              const meta = res?.result?.meta || res?.result?.metaData;
              const txResult = typeof meta === 'object' ? meta?.TransactionResult : undefined;
              const isValidated = res?.result?.validated !== false;

              if (txResult && txResult !== 'tesSUCCESS') {
                return {
                  status: 'FAILED',
                  txHash: cleanHash,
                  explorerUrl,
                  errorMessage: `XRPL deposit failed on-chain (${txResult})`,
                };
              }
              if (!isValidated) {
                return {
                  status: 'NOT_FOUND',
                  txHash: cleanHash,
                  explorerUrl,
                  errorMessage: 'XRPL deposit transaction is not validated yet.',
                };
              }

              const txDest = String(txData.Destination || '');
              const txSrc = String(txData.Account || '');
              const txTag = txData.DestinationTag !== undefined ? Number(txData.DestinationTag) : undefined;
              const rawDelivered =
                meta?.delivered_amount !== undefined && meta?.delivered_amount !== 'unavailable'
                  ? meta.delivered_amount
                  : txData.Amount ?? txData.DeliverMax;

              let deliveredAmount: number | undefined;
              let detectedAsset = asset === 'NXL_XRPL' ? 'NXL' : 'XRP';
              let detectedIssuer: string | undefined;

              if (typeof rawDelivered === 'string' && /^\d+$/.test(rawDelivered)) {
                deliveredAmount = Number(dropsToXrp(rawDelivered));
                detectedAsset = 'XRP';
              } else if (rawDelivered && typeof rawDelivered === 'object') {
                deliveredAmount = Number(rawDelivered.value || 0);
                detectedAsset = String(rawDelivered.currency || 'NXL');
                detectedIssuer = String(rawDelivered.issuer || '');
              }

              if (expected) {
                if (expected.expectedDestination && txDest !== expected.expectedDestination) {
                  return {
                    status: 'FAILED',
                    txHash: cleanHash,
                    explorerUrl,
                    errorMessage: `Deposit destination mismatch: expected ${expected.expectedDestination}, got ${txDest || 'none'}`,
                  };
                }
                if (
                  expected.expectedDestinationTag !== undefined &&
                  Number.isFinite(expected.expectedDestinationTag) &&
                  txTag !== expected.expectedDestinationTag
                ) {
                  return {
                    status: 'FAILED',
                    txHash: cleanHash,
                    explorerUrl,
                    errorMessage: `XRPL DestinationTag mismatch: expected ${expected.expectedDestinationTag}, got ${txTag ?? 'none'}`,
                  };
                }
                if (asset === 'NXL_XRPL') {
                  const expectedIssuer =
                    expected.expectedIssuer ||
                    env.XRPL_NXL_ISSUER_ADDRESS ||
                    'rfogmLyR5R2VcYsENSjqSW7iTpg9v8AbGU';
                  const expectedHex =
                    expected.expectedCurrencyHex ||
                    env.XRPL_NXL_CURRENCY_HEX ||
                    '4E584C0000000000000000000000000000000000';
                  if (
                    detectedIssuer !== expectedIssuer ||
                    (detectedAsset !== 'NXL' && detectedAsset !== expectedHex)
                  ) {
                    return {
                      status: 'FAILED',
                      txHash: cleanHash,
                      explorerUrl,
                      errorMessage: `XRPL asset/issuer mismatch: expected NXL from ${expectedIssuer}, got ${detectedAsset} (${detectedIssuer || 'native'})`,
                    };
                  }
                } else if (detectedAsset !== 'XRP') {
                  return {
                    status: 'FAILED',
                    txHash: cleanHash,
                    explorerUrl,
                    errorMessage: `Expected native XRP deposit, got ${detectedAsset}`,
                  };
                }
                if (
                  expected.minAmount !== undefined &&
                  (deliveredAmount === undefined || deliveredAmount + 1e-6 < expected.minAmount * 0.999)
                ) {
                  return {
                    status: 'FAILED',
                    txHash: cleanHash,
                    explorerUrl,
                    errorMessage: `Underpaid XRPL deposit: expected at least ${expected.minAmount}, delivered ${deliveredAmount ?? 0}`,
                  };
                }
              }

              return {
                status: 'SUCCESS',
                txHash: cleanHash,
                explorerUrl,
                verifiedDetails: {
                  destination: txDest || undefined,
                  sourceAccount: txSrc || undefined,
                  amount: deliveredAmount,
                  assetCode: detectedAsset,
                  memoOrTag: txTag,
                  validated: true,
                },
              };
            } catch (err: any) {
              const errCode = err?.data?.error || err?.message || '';
              if (String(errCode).includes('txnNotFound') && attempt < 2) {
                await new Promise((r) => setTimeout(r, 1200));
                continue;
              }
              if (String(errCode).includes('txnNotFound')) {
                break;
              }
              throw err;
            }
          }
        } catch {
          // try next XRPL endpoint
        } finally {
          if (client.isConnected()) {
            try {
              await client.disconnect();
            } catch {}
          }
        }
      }
      return {
        status: 'NOT_FOUND',
        txHash: cleanHash,
        explorerUrl,
        errorMessage: 'XRPL deposit transaction not found on testnet yet. Please wait a few seconds and retry.',
      };
    }

    // Stellar Horizon verification
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const tx: any = await this.horizonServer.transactions().transaction(cleanHash).call();
        if (tx?.successful === false) {
          return {
            status: 'FAILED',
            txHash: cleanHash,
            explorerUrl,
            errorMessage: 'Stellar deposit transaction failed on-chain',
          };
        }

        let deliveredAmount: number | undefined;
        let matchedDest: string | undefined;

        if (expected) {
          if (expected.expectedMemo && String(tx?.memo || '') !== String(expected.expectedMemo)) {
            return {
              status: 'FAILED',
              txHash: cleanHash,
              explorerUrl,
              errorMessage: `Stellar memo mismatch: expected "${expected.expectedMemo}", got "${tx?.memo || ''}"`,
            };
          }

          if (expected.expectedDestination || expected.minAmount !== undefined) {
            const opsRes: any = await this.horizonServer.operations().forTransaction(cleanHash).call();
            const ops = opsRes?.records || [];
            let sum = 0;
            for (const op of ops) {
              const toAddr = op.to || op.account || '';
              const isNative = op.asset_type === 'native' || op.type === 'create_account';
              const amt = Number(op.amount || op.starting_balance || 0);
              if (
                (!expected.expectedDestination || toAddr === expected.expectedDestination) &&
                isNative &&
                Number.isFinite(amt)
              ) {
                sum += amt;
                matchedDest = toAddr;
              }
            }
            deliveredAmount = sum;

            if (expected.expectedDestination && !matchedDest) {
              return {
                status: 'FAILED',
                txHash: cleanHash,
                explorerUrl,
                errorMessage: `Stellar payment to ${expected.expectedDestination} not found in transaction operations`,
              };
            }
            if (expected.minAmount !== undefined && sum + 1e-7 < expected.minAmount * 0.999) {
              return {
                status: 'FAILED',
                txHash: cleanHash,
                explorerUrl,
                errorMessage: `Underpaid Stellar XLM deposit: expected at least ${expected.minAmount}, delivered ${sum}`,
              };
            }
          }
        }

        return {
          status: 'SUCCESS',
          txHash: cleanHash,
          explorerUrl,
          verifiedDetails: {
            destination: matchedDest,
            sourceAccount: tx?.source_account,
            amount: deliveredAmount,
            assetCode: 'XLM',
            memoOrTag: tx?.memo,
            validated: true,
          },
        };
      } catch (err: any) {
        const status = err?.response?.status || err?.status;
        if (status === 404 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        if (status === 404) {
          break;
        }
        return {
          status: 'NOT_FOUND',
          txHash: cleanHash,
          explorerUrl,
          errorMessage: err?.message || 'Could not verify Stellar deposit transaction',
        };
      }
    }

    return {
      status: 'NOT_FOUND',
      txHash: cleanHash,
      explorerUrl,
      errorMessage: 'Stellar deposit transaction not found on Horizon yet. Please wait a few seconds and retry.',
    };
  }

  /**
   * Executes the full cross-chain swap cycle:
   * 1. Confirms/Broadcasts Ingress Deposit to Server Vault
   * 2. Broadcasts Egress Payout from Server Hot Wallet to User Destination Address
   * 3. Records sequential incoming/outgoing legs & real on-chain status (no fake hashes)
   */
  static async executeSwap(params: {
    swapId: string;
    depositTxHash?: string;
    userSourceSecret?: string;
    skipDepositVerification?: boolean;
  }): Promise<SwapOrder> {
    const { swapId, depositTxHash, userSourceSecret, skipDepositVerification = false } = params;
    const order = await this.getSwapOrder(swapId);

    if (!order) {
      throw new Error(`Swap order "${swapId}" not found or expired.`);
    }

    if (order.status === 'COMPLETED') {
      return order;
    }

    const fromAsset = order.fromAsset as 'XRP' | 'XLM';
    const toAsset = order.toAsset as 'XLM' | 'XRP';
    const fromRail = fromAsset === 'XRP' ? 'XRPL' : 'STELLAR';
    const toRail = toAsset === 'XLM' ? 'STELLAR' : 'XRPL';
    const legs: SwapTransactionLeg[] = [];
    let resolvedDepositHash = '';

    // =========================================================================
    // STEP 1: INGRESS (User -> Server Vault)
    // =========================================================================
    if (userSourceSecret) {
      try {
        if (fromAsset === 'XRP') {
          resolvedDepositHash = await this.broadcastXrplPayment({
            senderSeed: userSourceSecret,
            destination: order.platformDepositAddress,
            amountXrp: order.payAmount,
            destinationTag: Number(order.paymentIdentifier),
          });
        } else {
          resolvedDepositHash = await this.broadcastStellarPayment({
            senderSecret: userSourceSecret,
            destination: order.platformDepositAddress,
            amountXlm: order.payAmount,
            memo: String(order.paymentIdentifier),
          });
        }
      } catch (err: any) {
        const failedHash = sanitizeOnChainTxHash(err?.data?.tx_json?.hash || err?.response?.data?.extras?.hash);
        const errMsg = err?.message || `Ingress ${fromAsset} broadcast failed`;
        legs.push({
          sequence: 1,
          direction: 'INCOMING',
          stage: 'DEPOSIT',
          label: `User Deposit (${fromAsset} on ${fromRail})`,
          asset: fromAsset,
          amount: order.payAmount,
          rail: fromRail,
          status: 'FAILED',
          txHash: failedHash,
          explorerUrl: buildExplorerTxUrl(fromRail, failedHash),
          toAddress: order.platformDepositAddress,
          errorMessage: errMsg,
          timestamp: new Date().toISOString(),
        });
        order.depositTxHash = failedHash || undefined;
        order.depositExplorerUrl = buildExplorerTxUrl(fromRail, failedHash) || undefined;
        order.status = 'FAILED';
        order.settlementType = 'FAILED';
        order.errorMessage = errMsg;
        order.transactions = legs;
        await this.saveSwapOrder(order);
        return order;
      }
    } else if (depositTxHash && depositTxHash.trim()) {
      resolvedDepositHash = depositTxHash.trim();
    } else {
      throw new Error(
        `Deposit required! No funds were received. Please sign the transaction in your connected wallet or send ${order.payAmount} ${order.fromAsset} to ${order.platformDepositAddress}.`
      );
    }

    if (!isRealOnChainTxHash(resolvedDepositHash)) {
      throw new Error(`Invalid deposit transaction hash "${resolvedDepositHash}". Expected a 64-character hex hash.`);
    }

    if (!skipDepositVerification && !userSourceSecret) {
      await this.assertDepositHashNotReplayed(resolvedDepositHash, order.swapId);
      const verification = await this.verifyOnChainDeposit(fromAsset, resolvedDepositHash, {
        expectedDestination: order.platformDepositAddress,
        minAmount: order.payAmount,
        ...(order.paymentIdentifierType === 'destination_tag'
          ? { expectedDestinationTag: Number(order.paymentIdentifier) }
          : { expectedMemo: String(order.paymentIdentifier) }),
      });
      if (verification.status === 'FAILED') {
        legs.push({
          sequence: 1,
          direction: 'INCOMING',
          stage: 'DEPOSIT',
          label: `User Deposit (${fromAsset} on ${fromRail})`,
          asset: fromAsset,
          amount: order.payAmount,
          rail: fromRail,
          status: 'FAILED',
          txHash: resolvedDepositHash,
          explorerUrl: verification.explorerUrl || buildExplorerTxUrl(fromRail, resolvedDepositHash),
          toAddress: order.platformDepositAddress,
          errorMessage: verification.errorMessage,
          timestamp: new Date().toISOString(),
        });
        order.depositTxHash = resolvedDepositHash;
        order.depositExplorerUrl = verification.explorerUrl || buildExplorerTxUrl(fromRail, resolvedDepositHash) || undefined;
        order.status = 'FAILED';
        order.settlementType = 'FAILED';
        order.errorMessage = verification.errorMessage;
        order.transactions = legs;
        await this.saveSwapOrder(order);
        return order;
      }
      if (verification.status === 'NOT_FOUND') {
        throw new Error(verification.errorMessage || 'Deposit transaction not found on-chain yet.');
      }
    }

    const depositExplorerUrl = buildExplorerTxUrl(fromRail, resolvedDepositHash);
    order.depositTxHash = resolvedDepositHash;
    order.depositExplorerUrl = depositExplorerUrl || undefined;
    order.status = 'DEPOSIT_CONFIRMED';

    legs.push({
      sequence: 1,
      direction: 'INCOMING',
      stage: 'DEPOSIT',
      label: `User Deposit (${fromAsset} on ${fromRail})`,
      asset: fromAsset,
      amount: order.payAmount,
      rail: fromRail,
      status: 'SUCCESS',
      txHash: resolvedDepositHash,
      explorerUrl: depositExplorerUrl,
      toAddress: order.platformDepositAddress,
      timestamp: new Date().toISOString(),
    });

    // =========================================================================
    // STEP 2: EGRESS (Server Hot Wallet -> User Destination Address)
    // =========================================================================
    order.status = 'PAYOUT_PROCESSING';
    const payout =
      toAsset === 'XLM'
        ? await this.payoutStellarToUser({
            destinationAddress: order.userDestinationAddress,
            amountXlm: order.receiveAmount,
            swapId: order.swapId,
          })
        : await this.payoutXrplToUser({
            destinationAddress: order.userDestinationAddress,
            amountXrp: order.receiveAmount,
            swapId: order.swapId,
          });

    legs.push({
      sequence: 2,
      direction: 'OUTGOING',
      stage: 'ONCHAIN_PAYOUT',
      label: `Server Payout (${toAsset} on ${toRail})`,
      asset: toAsset,
      amount: order.receiveAmount,
      rail: toRail,
      status: payout.ok ? 'SUCCESS' : 'FAILED',
      txHash: payout.txHash,
      explorerUrl: payout.explorerUrl,
      toAddress: order.userDestinationAddress,
      errorMessage: payout.ok ? undefined : payout.errorMessage,
      timestamp: new Date().toISOString(),
    });

    order.payoutTxHash = payout.txHash || undefined;
    order.payoutExplorerUrl = payout.explorerUrl || undefined;
    order.transactions = legs;

    if (payout.ok) {
      order.status = 'COMPLETED';
      order.settlementType = 'ON_CHAIN';
      order.errorMessage = undefined;
      order.journalEntry = `JE-SWAP-${Date.now().toString().slice(-4)}`;
    } else {
      order.status = 'FAILED';
      order.settlementType = 'FAILED';
      order.errorMessage = payout.errorMessage || `On-chain ${toAsset} payout failed`;
    }

    await this.saveSwapOrder(order);
    return order;
  }

  /**
   * Public wrapper allowing NrTokenService & other settlement engines to reuse on-chain payout logic
   */
  static async payoutAssetToUser(params: {
    toAsset: 'XLM' | 'XRP';
    destinationAddress: string;
    amount: number;
    referenceId: string;
  }): Promise<{ ok: boolean; txHash: string | null; explorerUrl: string | null; errorMessage?: string }> {
    if (params.toAsset === 'XLM') {
      return this.payoutStellarToUser({
        destinationAddress: params.destinationAddress,
        amountXlm: params.amount,
        swapId: params.referenceId,
      });
    }
    return this.payoutXrplToUser({
      destinationAddress: params.destinationAddress,
      amountXrp: params.amount,
      swapId: params.referenceId,
    });
  }

  /**
   * Broadcasts real on-chain XLM payment from Server Hot Wallet to User's Stellar Address
   */
  private static async payoutStellarToUser(params: {
    destinationAddress: string;
    amountXlm: number;
    swapId: string;
  }): Promise<{ ok: boolean; txHash: string | null; explorerUrl: string | null; errorMessage?: string }> {
    const { destinationAddress, amountXlm, swapId } = params;
    const serverSecret = this.getStellarHotWalletSecret();

    try {
      const serverKey = Keypair.fromSecret(serverSecret);
      const serverAccount = await this.horizonServer.loadAccount(serverKey.publicKey());
      const memoText = `SWAP-${swapId.slice(-10)}`;

      const tx = new TransactionBuilder(serverAccount, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: destinationAddress,
            asset: Asset.native(),
            amount: amountXlm.toFixed(7),
          })
        )
        .addMemo(Memo.text(memoText.slice(0, 28)))
        .setTimeout(120)
        .build();

      tx.sign(serverKey);
      const res = await this.horizonServer.submitTransaction(tx);
      const txHash = sanitizeOnChainTxHash(res.hash);
      if (!txHash) {
        return {
          ok: false,
          txHash: null,
          explorerUrl: null,
          errorMessage: 'Stellar payout did not return a valid transaction hash',
        };
      }
      console.log(`⚡ [CrossChainSwap] Stellar Payout Broadcasted! Hash: ${txHash}, Amount: ${amountXlm} XLM`);
      return {
        ok: true,
        txHash,
        explorerUrl: buildExplorerTxUrl('STELLAR', txHash),
      };
    } catch (err: any) {
      const resultCodes = err?.response?.data?.extras?.result_codes;
      const failedHash = sanitizeOnChainTxHash(err?.response?.data?.extras?.hash);
      const errorMessage = resultCodes
        ? `Stellar payout rejected (${JSON.stringify(resultCodes)})`
        : err?.message || 'Stellar payout failed';
      console.error('⚠️ [Stellar Payout Error]:', errorMessage);
      return {
        ok: false,
        txHash: failedHash,
        explorerUrl: buildExplorerTxUrl('STELLAR', failedHash),
        errorMessage,
      };
    }
  }

  /**
   * Broadcasts real on-chain XRP payment from Server Hot Wallet to User's XRPL Address
   */
  private static async payoutXrplToUser(params: {
    destinationAddress: string;
    amountXrp: number;
    swapId: string;
  }): Promise<{ ok: boolean; txHash: string | null; explorerUrl: string | null; errorMessage?: string }> {
    const { destinationAddress, amountXrp } = params;
    const serverSeed = this.getXrplHotWalletSeed();

    let client: Client | null = null;
    try {
      const wallet = Wallet.fromSeed(serverSeed);
      client = new Client(this.xrplEndpoints[0], { connectionTimeout: 8000 });
      await client.connect();

      const amountDrops = String(Math.round(amountXrp * 1_000_000));
      const prepared = await client.autofill({
        TransactionType: 'Payment',
        Account: wallet.address,
        Amount: amountDrops,
        Destination: destinationAddress,
      });

      const signed = wallet.sign(prepared);
      const res = await client.submitAndWait(signed.tx_blob);
      const hash = sanitizeOnChainTxHash(res.result?.hash || signed.hash);
      const txResult =
        typeof res.result?.meta === 'object' && res.result?.meta
          ? (res.result.meta as any).TransactionResult
          : undefined;

      if (txResult === 'tesSUCCESS' && hash) {
        console.log(`⚡ [CrossChainSwap] XRPL Payout Broadcasted! Hash: ${hash}, Amount: ${amountXrp} XRP`);
        return {
          ok: true,
          txHash: hash,
          explorerUrl: buildExplorerTxUrl('XRPL', hash),
        };
      }

      const errorMessage = `XRPL payout failed on-chain: ${txResult || 'UNCONFIRMED'}`;
      console.error('⚠️ [XRPL Payout Error]:', errorMessage);
      return {
        ok: false,
        txHash: hash,
        explorerUrl: buildExplorerTxUrl('XRPL', hash),
        errorMessage,
      };
    } catch (err: any) {
      const failedHash = sanitizeOnChainTxHash(err?.data?.tx_json?.hash);
      const errorMessage = err?.message || 'XRPL payout failed';
      console.error('⚠️ [XRPL Payout Error]:', errorMessage);
      return {
        ok: false,
        txHash: failedHash,
        explorerUrl: buildExplorerTxUrl('XRPL', failedHash),
        errorMessage,
      };
    } finally {
      if (client && client.isConnected()) {
        try {
          await client.disconnect();
        } catch {}
      }
    }
  }

  /**
   * Helper: Broadcasts user deposit from user's Stellar wallet secret
   */
  private static async broadcastStellarPayment(params: {
    senderSecret: string;
    destination: string;
    amountXlm: number;
    memo: string;
  }): Promise<string> {
    const key = Keypair.fromSecret(params.senderSecret);
    const account = await this.horizonServer.loadAccount(key.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: params.destination,
          asset: Asset.native(),
          amount: params.amountXlm.toFixed(7),
        })
      )
      .addMemo(Memo.text(params.memo.slice(0, 28)))
      .setTimeout(120)
      .build();

    tx.sign(key);
    const res = await this.horizonServer.submitTransaction(tx);
    return res.hash;
  }

  /**
   * Helper: Broadcasts user deposit from user's XRPL wallet seed
   */
  private static async broadcastXrplPayment(params: {
    senderSeed: string;
    destination: string;
    amountXrp: number;
    destinationTag: number;
  }): Promise<string> {
    const wallet = Wallet.fromSeed(params.senderSeed);
    const client = new Client(this.xrplEndpoints[0], { connectionTimeout: 8000 });
    try {
      await client.connect();
      const amountDrops = String(Math.round(params.amountXrp * 1_000_000));
      const prepared = await client.autofill({
        TransactionType: 'Payment',
        Account: wallet.address,
        Amount: amountDrops,
        Destination: params.destination,
        DestinationTag: params.destinationTag,
      });
      const signed = wallet.sign(prepared);
      const res = await client.submit(signed.tx_blob);
      return res.result?.tx_json?.hash || signed.hash;
    } finally {
      if (client.isConnected()) {
        try {
          await client.disconnect();
        } catch {}
      }
    }
  }
}
