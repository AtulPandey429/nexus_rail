import crypto from 'crypto';
import type { ClientSession } from 'mongodb';
import { StrKey } from '@stellar/stellar-sdk';
import { isValidClassicAddress } from 'xrpl';
import {
  MongoService,
  MongoTokenPoolDoc,
  MongoTokenPriceTickDoc,
  MongoOrderDoc,
} from './mongo.js';
import { walletService } from './wallet.js';
import { getFxQuote } from './market.js';
import { CrossChainSwapService } from './crossChainSwapService.js';
import { OrderSequenceService } from './orderSequence.js';
import { settlementEmitter } from './settlementEvents.js';
import { IpfsService } from './ipfs.js';
import { RedisCacheService } from './redis.js';
import { PortfolioService } from './portfolioService.js';

export const NR_MICRO_SCALE = 1_000_000;
export const GENESIS_RESERVE_USD_CENTS = 10_000_000; // $100,000.00
export const GENESIS_POOL_NR_MICRO = 100_000_000_000; // 100,000.000000 NR
export const TOTAL_SUPPLY_NR_MICRO = 1_000_000_000_000; // 1,000,000.000000 NR cap
export const DEFAULT_SWAP_FEE_BPS = 50; // 0.50%
export const MIN_RESERVE_USD_CENTS = 100_000; // $1,000.00 safety floor

export type NrSwapAsset = 'NR' | 'USD' | 'XLM' | 'XRP';

export interface NrPoolStats {
  symbol: 'NR';
  name: string;
  spotPriceUsd: number;
  spotPriceCents: number;
  change24hPercent: number;
  reserveUsd: number;
  reserveUsdCents: number;
  poolNrSupply: number;
  poolNrMicro: number;
  circulatingNr: number;
  circulatingNrMicro: number;
  totalSupplyNr: number;
  marketCapUsd: number;
  totalVolumeUsd: number;
  cumulativeFeeInjectedUsd: number;
  swapFeePercent: number;
  invariantK: string;
  updatedAt: string;
  history: Array<{
    spotPriceUsd: number;
    spotPriceCents: number;
    reserveUsd: number;
    trigger: MongoTokenPriceTickDoc['trigger'];
    referenceId: string;
    createdAt: string;
  }>;
}

export interface NrSwapQuote {
  fromAsset: NrSwapAsset;
  toAsset: NrSwapAsset;
  payAmount: number;
  receiveAmount: number;
  exchangeRate: number;
  spotPriceBeforeUsd: number;
  spotPriceAfterUsd: number;
  priceImpactPercent: number;
  feeUsd: number;
  feeCents: number;
  feePoolCents: number;
  feeOwnerCents: number;
  inputUsdCents: number;
  outputUsdCents: number;
  nrDeltaMicro: number;
  finalReserveUsdCents: number;
  finalPoolNrMicro: number;
  xlmUsd: number;
  xrpUsd: number;
  expiresInSeconds: number;
}

export interface NrSwapOrder {
  swapId: string;
  userId?: string;
  fromAsset: NrSwapAsset;
  toAsset: NrSwapAsset;
  payAmount: number;
  receiveAmount: number;
  exchangeRate: number;
  spotPriceBeforeUsd: number;
  spotPriceAfterUsd: number;
  priceImpactPercent: number;
  feeUsd: number;
  userDestinationAddress: string;
  platformDepositAddress: string;
  paymentIdentifierType: 'destination_tag' | 'memo_text' | 'internal_ledger';
  paymentIdentifier: string | number;
  status: 'PENDING_DEPOSIT' | 'DEPOSIT_CONFIRMED' | 'PAYOUT_PROCESSING' | 'COMPLETED' | 'FAILED';
  depositTxHash?: string;
  payoutTxHash?: string;
  depositExplorerUrl?: string;
  payoutExplorerUrl?: string;
  journalEntry?: string;
  createdAt: string;
  expiresAt: string;
}

const NR_SWAP_ORDERS = new Map<string, NrSwapOrder>();

/**
 * Pure BigInt spot price calculator in USD (6-decimal precision).
 */
export function computeSpotPriceUsd(reserveUsdCents: number, poolNrMicro: number): number {
  if (reserveUsdCents <= 0 || poolNrMicro <= 0) return 1.0;
  const scaled = (BigInt(Math.round(reserveUsdCents)) * 10_000_000_000n) / BigInt(Math.round(poolNrMicro));
  return Number(scaled) / 1_000_000;
}

/**
 * Pure BigInt constant-product Buy quote (USD cents -> micro-NR).
 * Preserves R * S = k with ceiling rounding so LP reserves never leak.
 */
export function computeBuyQuoteFromPool(
  reserveUsdCents: number,
  poolNrMicro: number,
  inputUsdCents: number,
  feeBps = DEFAULT_SWAP_FEE_BPS
) {
  if (!Number.isFinite(inputUsdCents) || inputUsdCents < 2) {
    throw new Error('Buy amount must be at least $0.02 USD');
  }
  if (reserveUsdCents <= 0 || poolNrMicro <= 0) {
    throw new Error('Pool liquidity must be positive');
  }

  const rBefore = Math.round(reserveUsdCents);
  const sBefore = Math.round(poolNrMicro);
  const grossInCents = Math.round(inputUsdCents);

  const feeCents = Math.max(1, Math.round((grossInCents * feeBps) / 10_000));
  const netUsdCents = grossInCents - feeCents;
  if (netUsdCents <= 0) {
    throw new Error('Input amount too small after swap fee');
  }

  const k = BigInt(rBefore) * BigInt(sBefore);
  const rMid = BigInt(rBefore + netUsdCents);
  const sAfter = (k + rMid - 1n) / rMid; // ceil(k / rMid)
  const nrOutMicro = Number(BigInt(sBefore) - sAfter);
  if (nrOutMicro <= 0) {
    throw new Error('Output amount rounds to 0 NR; increase input amount');
  }

  const feePoolCents = Math.floor(feeCents * 0.5);
  const feeOwnerCents = feeCents - feePoolCents;
  const finalReserveUsdCents = rBefore + netUsdCents + feePoolCents;
  const finalPoolNrMicro = Number(sAfter);

  const spotBeforeUsd = computeSpotPriceUsd(rBefore, sBefore);
  const spotAfterUsd = computeSpotPriceUsd(finalReserveUsdCents, finalPoolNrMicro);
  const effectiveExecPriceUsd = (grossInCents / 100) / (nrOutMicro / NR_MICRO_SCALE);
  const priceImpactPercent = spotBeforeUsd > 0
    ? Math.max(0, Number((((effectiveExecPriceUsd - spotBeforeUsd) / spotBeforeUsd) * 100).toFixed(4)))
    : 0;

  return {
    grossInCents,
    feeCents,
    feePoolCents,
    feeOwnerCents,
    netUsdCents,
    nrOutMicro,
    nrOut: Number((nrOutMicro / NR_MICRO_SCALE).toFixed(6)),
    finalReserveUsdCents,
    finalPoolNrMicro,
    spotBeforeUsd,
    spotAfterUsd,
    priceImpactPercent,
  };
}

/**
 * Pure BigInt constant-product Sell quote (micro-NR -> USD cents).
 */
export function computeSellQuoteFromPool(
  reserveUsdCents: number,
  poolNrMicro: number,
  inputNrMicro: number,
  feeBps = DEFAULT_SWAP_FEE_BPS
) {
  if (!Number.isFinite(inputNrMicro) || inputNrMicro <= 0) {
    throw new Error('Sell amount must be greater than zero');
  }
  if (reserveUsdCents <= 0 || poolNrMicro <= 0) {
    throw new Error('Pool liquidity must be positive');
  }

  const rBefore = Math.round(reserveUsdCents);
  const sBefore = Math.round(poolNrMicro);
  const nrIn = Math.round(inputNrMicro);

  const k = BigInt(rBefore) * BigInt(sBefore);
  const sAfter = BigInt(sBefore + nrIn);
  const rMid = (k + sAfter - 1n) / sAfter; // ceil(k / sAfter)
  const grossUsdCents = Number(BigInt(rBefore) - rMid);
  if (grossUsdCents <= 1) {
    throw new Error('Sell amount too small to settle');
  }

  const feeCents = Math.max(1, Math.round((grossUsdCents * feeBps) / 10_000));
  const netUsdOutCents = grossUsdCents - feeCents;
  if (netUsdOutCents <= 0) {
    throw new Error('Net payout too small after exit fee');
  }

  const feePoolCents = Math.floor(feeCents * 0.5);
  const feeOwnerCents = feeCents - feePoolCents;
  const finalReserveUsdCents = Number(rMid) + feePoolCents;
  const finalPoolNrMicro = Number(sAfter);

  const spotBeforeUsd = computeSpotPriceUsd(rBefore, sBefore);
  const spotAfterUsd = computeSpotPriceUsd(finalReserveUsdCents, finalPoolNrMicro);
  const effectiveExecPriceUsd = (netUsdOutCents / 100) / (nrIn / NR_MICRO_SCALE);
  const priceImpactPercent = spotBeforeUsd > 0
    ? Math.max(0, Number((((spotBeforeUsd - effectiveExecPriceUsd) / spotBeforeUsd) * 100).toFixed(4)))
    : 0;

  return {
    nrInMicro: nrIn,
    grossUsdCents,
    feeCents,
    feePoolCents,
    feeOwnerCents,
    netUsdOutCents,
    finalReserveUsdCents,
    finalPoolNrMicro,
    spotBeforeUsd,
    spotAfterUsd,
    priceImpactPercent,
  };
}

/**
 * Computes direct asset-to-USD cents using live FX oracle rates.
 */
function assetToUsdCents(asset: Exclude<NrSwapAsset, 'NR'>, amount: number, fx: { xlmUsd: number; xrpUsd: number }): number {
  if (asset === 'USD') return Math.round(amount * 100);
  if (asset === 'XLM') return Math.round(amount * fx.xlmUsd * 100);
  return Math.round(amount * fx.xrpUsd * 100);
}

/**
 * Converts USD cents to target non-NR asset units using live FX oracle rates.
 */
function usdCentsToTargetAsset(asset: Exclude<NrSwapAsset, 'NR'>, usdCents: number, fx: { xlmUsd: number; xrpUsd: number }): number {
  const usd = usdCents / 100;
  if (asset === 'USD') return Number(usd.toFixed(2));
  if (asset === 'XLM') return Number((usd / (fx.xlmUsd || 0.17)).toFixed(6));
  return Number((usd / (fx.xrpUsd || 1.2)).toFixed(6));
}

export class NrTokenService {
  /**
   * Idempotently ensures the genesis $NR liquidity pool & baseline tick exist in MongoDB.
   */
  static async ensureGenesisPool(): Promise<MongoTokenPoolDoc> {
    const poolCol = await MongoService.getCollection<MongoTokenPoolDoc>('token_pool');
    const existing = await poolCol.findOne({ symbol: 'NR' });
    if (existing) return existing;

    const now = new Date().toISOString();
    const genesisSpotUsd = computeSpotPriceUsd(GENESIS_RESERVE_USD_CENTS, GENESIS_POOL_NR_MICRO);
    const genesisDoc: MongoTokenPoolDoc = {
      symbol: 'NR',
      name: 'NexusRail Protocol Token',
      reserve_usd_cents: GENESIS_RESERVE_USD_CENTS,
      pool_nr_micro: GENESIS_POOL_NR_MICRO,
      total_supply_nr_micro: TOTAL_SUPPLY_NR_MICRO,
      circulating_nr_micro: 0,
      spot_price_cents: Math.round(genesisSpotUsd * 100),
      price_24h_open_cents: Math.round(genesisSpotUsd * 100),
      total_volume_usd_cents: 0,
      cumulative_fee_injected_cents: 0,
      swap_fee_bps: DEFAULT_SWAP_FEE_BPS,
      updated_at: now,
    };

    await poolCol.updateOne({ symbol: 'NR' }, { $setOnInsert: genesisDoc }, { upsert: true });

    const historyCol = await MongoService.getCollection<MongoTokenPriceTickDoc>('token_price_history');
    const count = await historyCol.countDocuments({ symbol: 'NR' });
    if (count === 0) {
      await historyCol.insertOne({
        id: `tick_${crypto.randomUUID()}`,
        symbol: 'NR',
        spot_price_cents: genesisDoc.spot_price_cents,
        spot_price_usd: genesisSpotUsd,
        reserve_usd_cents: genesisDoc.reserve_usd_cents,
        pool_nr_micro: genesisDoc.pool_nr_micro,
        trigger: 'GENESIS',
        reference_id: 'GENESIS-POOL-V1',
        created_at: now,
      });
    }

    return (await poolCol.findOne({ symbol: 'NR' })) || genesisDoc;
  }

  /**
   * Returns live $NR AMM pool telemetry and recent price ticks.
   */
  static async getPoolStats(): Promise<NrPoolStats> {
    const pool = await this.ensureGenesisPool();
    const historyCol = await MongoService.getCollection<MongoTokenPriceTickDoc>('token_price_history');
    const recentTicks = await historyCol
      .find({ symbol: 'NR' })
      .sort({ created_at: -1 })
      .limit(30)
      .toArray();

    const spotPriceUsd = computeSpotPriceUsd(pool.reserve_usd_cents, pool.pool_nr_micro);
    const spotPriceCents = Math.round(spotPriceUsd * 100);
    const openUsd = (pool.price_24h_open_cents || 100) / 100;
    const change24hPercent = openUsd > 0
      ? Number((((spotPriceUsd - openUsd) / openUsd) * 100).toFixed(2))
      : 0;

    const circulatingNr = pool.circulating_nr_micro / NR_MICRO_SCALE;
    const invariantK = (BigInt(pool.reserve_usd_cents) * BigInt(pool.pool_nr_micro)).toString();

    return {
      symbol: 'NR',
      name: pool.name,
      spotPriceUsd: Number(spotPriceUsd.toFixed(6)),
      spotPriceCents,
      change24hPercent,
      reserveUsd: Number((pool.reserve_usd_cents / 100).toFixed(2)),
      reserveUsdCents: pool.reserve_usd_cents,
      poolNrSupply: Number((pool.pool_nr_micro / NR_MICRO_SCALE).toFixed(6)),
      poolNrMicro: pool.pool_nr_micro,
      circulatingNr: Number(circulatingNr.toFixed(6)),
      circulatingNrMicro: pool.circulating_nr_micro,
      totalSupplyNr: pool.total_supply_nr_micro / NR_MICRO_SCALE,
      marketCapUsd: Number((circulatingNr * spotPriceUsd).toFixed(2)),
      totalVolumeUsd: Number((pool.total_volume_usd_cents / 100).toFixed(2)),
      cumulativeFeeInjectedUsd: Number((pool.cumulative_fee_injected_cents / 100).toFixed(2)),
      swapFeePercent: (pool.swap_fee_bps || DEFAULT_SWAP_FEE_BPS) / 100,
      invariantK,
      updatedAt: pool.updated_at,
      history: recentTicks.reverse().map((tick) => ({
        spotPriceUsd: tick.spot_price_usd,
        spotPriceCents: tick.spot_price_cents,
        reserveUsd: Number((tick.reserve_usd_cents / 100).toFixed(2)),
        trigger: tick.trigger,
        referenceId: tick.reference_id,
        createdAt: tick.created_at,
      })),
    };
  }

  /**
   * Simulates a swap quote involving $NR or USD/XLM/XRP using live oracle prices and AMM curve math.
   */
  static async quoteSwap(params: {
    fromAsset: NrSwapAsset;
    toAsset: NrSwapAsset;
    amount: number;
  }): Promise<NrSwapQuote> {
    const { fromAsset, toAsset, amount } = params;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Swap amount must be greater than zero');
    }
    if (fromAsset === toAsset) {
      throw new Error('Source and target assets must be different');
    }

    const [pool, fx] = await Promise.all([this.ensureGenesisPool(), getFxQuote()]);
    const feeBps = pool.swap_fee_bps || DEFAULT_SWAP_FEE_BPS;

    if (toAsset === 'NR') {
      const inputUsdCents = assetToUsdCents(fromAsset as Exclude<NrSwapAsset, 'NR'>, amount, fx);
      const q = computeBuyQuoteFromPool(pool.reserve_usd_cents, pool.pool_nr_micro, inputUsdCents, feeBps);
      return {
        fromAsset,
        toAsset,
        payAmount: amount,
        receiveAmount: q.nrOut,
        exchangeRate: Number((q.nrOut / amount).toFixed(6)),
        spotPriceBeforeUsd: Number(q.spotBeforeUsd.toFixed(6)),
        spotPriceAfterUsd: Number(q.spotAfterUsd.toFixed(6)),
        priceImpactPercent: q.priceImpactPercent,
        feeUsd: Number((q.feeCents / 100).toFixed(2)),
        feeCents: q.feeCents,
        feePoolCents: q.feePoolCents,
        feeOwnerCents: q.feeOwnerCents,
        inputUsdCents: q.grossInCents,
        outputUsdCents: Math.round(q.nrOut * q.spotAfterUsd * 100),
        nrDeltaMicro: q.nrOutMicro,
        finalReserveUsdCents: q.finalReserveUsdCents,
        finalPoolNrMicro: q.finalPoolNrMicro,
        xlmUsd: fx.xlmUsd,
        xrpUsd: fx.xrpUsd,
        expiresInSeconds: 45,
      };
    }

    if (fromAsset === 'NR') {
      const inputNrMicro = Math.round(amount * NR_MICRO_SCALE);
      const q = computeSellQuoteFromPool(pool.reserve_usd_cents, pool.pool_nr_micro, inputNrMicro, feeBps);
      const receiveAmount = usdCentsToTargetAsset(toAsset as Exclude<NrSwapAsset, 'NR'>, q.netUsdOutCents, fx);
      return {
        fromAsset,
        toAsset,
        payAmount: amount,
        receiveAmount,
        exchangeRate: Number((receiveAmount / amount).toFixed(6)),
        spotPriceBeforeUsd: Number(q.spotBeforeUsd.toFixed(6)),
        spotPriceAfterUsd: Number(q.spotAfterUsd.toFixed(6)),
        priceImpactPercent: q.priceImpactPercent,
        feeUsd: Number((q.feeCents / 100).toFixed(2)),
        feeCents: q.feeCents,
        feePoolCents: q.feePoolCents,
        feeOwnerCents: q.feeOwnerCents,
        inputUsdCents: q.grossUsdCents,
        outputUsdCents: q.netUsdOutCents,
        nrDeltaMicro: inputNrMicro,
        finalReserveUsdCents: q.finalReserveUsdCents,
        finalPoolNrMicro: q.finalPoolNrMicro,
        xlmUsd: fx.xlmUsd,
        xrpUsd: fx.xrpUsd,
        expiresInSeconds: 45,
      };
    }

    // Direct USD <-> XLM / XRP quote fallback when neither side is NR
    const inputUsdCents = assetToUsdCents(fromAsset as Exclude<NrSwapAsset, 'NR'>, amount, fx);
    const feeCents = Math.max(1, Math.round((inputUsdCents * feeBps) / 10_000));
    const netOutCents = Math.max(1, inputUsdCents - feeCents);
    const receiveAmount = usdCentsToTargetAsset(toAsset as Exclude<NrSwapAsset, 'NR'>, netOutCents, fx);
    const spotPriceUsd = computeSpotPriceUsd(pool.reserve_usd_cents, pool.pool_nr_micro);

    return {
      fromAsset,
      toAsset,
      payAmount: amount,
      receiveAmount,
      exchangeRate: Number((receiveAmount / amount).toFixed(6)),
      spotPriceBeforeUsd: spotPriceUsd,
      spotPriceAfterUsd: spotPriceUsd,
      priceImpactPercent: 0,
      feeUsd: Number((feeCents / 100).toFixed(2)),
      feeCents,
      feePoolCents: Math.floor(feeCents * 0.5),
      feeOwnerCents: feeCents - Math.floor(feeCents * 0.5),
      inputUsdCents,
      outputUsdCents: netOutCents,
      nrDeltaMicro: 0,
      finalReserveUsdCents: pool.reserve_usd_cents,
      finalPoolNrMicro: pool.pool_nr_micro,
      xlmUsd: fx.xlmUsd,
      xrpUsd: fx.xrpUsd,
      expiresInSeconds: 45,
    };
  }

  /**
   * Creates an authoritative swap order involving $NR or USD internal ledger.
   */
  static async createNrSwapOrder(params: {
    userId?: string;
    fromAsset: NrSwapAsset;
    toAsset: NrSwapAsset;
    amount: number;
    userDestinationAddress?: string;
  }): Promise<NrSwapOrder> {
    const { userId, fromAsset, toAsset, amount } = params;
    let destination = (params.userDestinationAddress || '').trim();

    if (toAsset === 'XLM') {
      if (!StrKey.isValidEd25519PublicKey(destination)) {
        throw new Error(`Invalid Stellar destination address: "${destination}". Expected a valid G... public key.`);
      }
    } else if (toAsset === 'XRP') {
      if (!isValidClassicAddress(destination)) {
        throw new Error(`Invalid XRPL destination address: "${destination}". Expected a valid r... classic address.`);
      }
    } else if (!destination) {
      destination = userId ? `nexus_wallet_${userId.slice(0, 8)}` : 'NEXUS_INTERNAL_LEDGER';
    }

    const quote = await this.quoteSwap({ fromAsset, toAsset, amount });
    const swapId = `SWAP-NR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    let platformDepositAddress = 'NEXUS_INTERNAL_LEDGER';
    let paymentIdentifierType: NrSwapOrder['paymentIdentifierType'] = 'internal_ledger';
    let paymentIdentifier: string | number = swapId;

    if (fromAsset === 'XRP') {
      platformDepositAddress = CrossChainSwapService.getXrplPlatformAddress();
      paymentIdentifierType = 'destination_tag';
      paymentIdentifier = (crypto.randomBytes(4).readUInt32BE(0) % 2_000_000_000) + 100_000;
    } else if (fromAsset === 'XLM') {
      platformDepositAddress = CrossChainSwapService.getStellarPlatformAddress();
      paymentIdentifierType = 'memo_text';
      paymentIdentifier = `SWAP${crypto.randomBytes(6).toString('hex').toUpperCase()}`.slice(0, 28);
    }

    const order: NrSwapOrder = {
      swapId,
      userId,
      fromAsset,
      toAsset,
      payAmount: amount,
      receiveAmount: quote.receiveAmount,
      exchangeRate: quote.exchangeRate,
      spotPriceBeforeUsd: quote.spotPriceBeforeUsd,
      spotPriceAfterUsd: quote.spotPriceAfterUsd,
      priceImpactPercent: quote.priceImpactPercent,
      feeUsd: quote.feeUsd,
      userDestinationAddress: destination,
      platformDepositAddress,
      paymentIdentifierType,
      paymentIdentifier,
      status: 'PENDING_DEPOSIT',
      createdAt,
      expiresAt,
    };

    NR_SWAP_ORDERS.set(swapId, order);
    return order;
  }

  static getNrSwapOrder(swapId: string): NrSwapOrder | undefined {
    return NR_SWAP_ORDERS.get(swapId);
  }

  /**
   * Executes an $NR or USD AMM swap inside an atomic MongoDB ClientSession transaction.
   * Supports either a previously created swapId or direct execution parameters.
   */
  static async executeNrSwap(params: {
    swapId?: string;
    userId: string;
    fromAsset?: NrSwapAsset;
    toAsset?: NrSwapAsset;
    amount?: number;
    depositTxHash?: string;
    userDestinationAddress?: string;
  }): Promise<{ order: NrSwapOrder; poolStats: NrPoolStats }> {
    let order = params.swapId ? NR_SWAP_ORDERS.get(params.swapId) : undefined;
    if (params.swapId && !order && (!params.fromAsset || !params.toAsset || !params.amount)) {
      throw new Error(`Swap order "${params.swapId}" not found or expired.`);
    }

    if (!order) {
      if (!params.fromAsset || !params.toAsset || !params.amount) {
        throw new Error('fromAsset, toAsset, and amount are required to execute swap');
      }
      order = await this.createNrSwapOrder({
        userId: params.userId,
        fromAsset: params.fromAsset,
        toAsset: params.toAsset,
        amount: params.amount,
        userDestinationAddress: params.userDestinationAddress,
      });
    }

    if (order.status === 'COMPLETED') {
      return { order, poolStats: await this.getPoolStats() };
    }

    const userId = params.userId || order.userId;
    if (!userId) {
      throw new Error('Authentication is required to credit or debit NexusRail wallet balances');
    }

    // Validate on-chain ingress hash when deposit is external XLM/XRP
    if ((order.fromAsset === 'XLM' || order.fromAsset === 'XRP') && !params.depositTxHash?.trim()) {
      throw new Error(
        `Deposit required! Please sign and broadcast ${order.payAmount} ${order.fromAsset} to ${order.platformDepositAddress} first.`
      );
    }

    await this.ensureGenesisPool();
    const client = await MongoService.getClient();
    const session = client.startSession();
    let finalQuote: NrSwapQuote | null = null;
    const txHashIngress = params.depositTxHash?.trim() || `nr_ledger_in_${crypto.randomBytes(12).toString('hex')}`;

    try {
      await session.withTransaction(async () => {
        const poolCol = await MongoService.getCollection<MongoTokenPoolDoc>('token_pool');
        const historyCol = await MongoService.getCollection<MongoTokenPriceTickDoc>('token_price_history');

        const currentPool = await poolCol.findOne({ symbol: 'NR' }, { session });
        if (!currentPool) throw new Error('NR pool not initialized');

        finalQuote = await this.quoteSwap({
          fromAsset: order!.fromAsset,
          toAsset: order!.toAsset,
          amount: order!.payAmount,
        });

        // 1. Ingress Debit (if internal USD or NR wallet balance)
        if (order!.fromAsset === 'USD') {
          const debitCents = Math.round(order!.payAmount * 100);
          await walletService.debitBalance(userId, debitCents, 'USD', order!.swapId, session);
        } else if (order!.fromAsset === 'NR') {
          const debitNrMicro = Math.round(order!.payAmount * NR_MICRO_SCALE);
          await walletService.debitBalance(userId, debitNrMicro, 'NR', order!.swapId, session);
        }

        // 2. Update AMM Pool with optimistic concurrency check
        if (order!.toAsset === 'NR' || order!.fromAsset === 'NR') {
          const newSpotCents = Math.round(finalQuote.spotPriceAfterUsd * 100);
          const circulatingDelta = order!.toAsset === 'NR' ? finalQuote.nrDeltaMicro : -finalQuote.nrDeltaMicro;
          const now = new Date().toISOString();

          const updateRes: any = await poolCol.findOneAndUpdate(
            {
              symbol: 'NR',
              reserve_usd_cents: currentPool.reserve_usd_cents,
              pool_nr_micro: currentPool.pool_nr_micro,
            },
            {
              $set: {
                reserve_usd_cents: finalQuote.finalReserveUsdCents,
                pool_nr_micro: finalQuote.finalPoolNrMicro,
                spot_price_cents: newSpotCents,
                updated_at: now,
              },
              $inc: {
                circulating_nr_micro: circulatingDelta,
                total_volume_usd_cents: finalQuote.inputUsdCents,
                cumulative_fee_injected_cents: finalQuote.feePoolCents,
              },
            },
            { session, returnDocument: 'after' }
          );

          const updatedPool = updateRes?.value || updateRes;
          if (!updatedPool) {
            throw new Error('Concurrent AMM pool update conflict; please retry swap');
          }

          await historyCol.insertOne(
            {
              id: `tick_${crypto.randomUUID()}`,
              symbol: 'NR',
              spot_price_cents: newSpotCents,
              spot_price_usd: finalQuote.spotPriceAfterUsd,
              reserve_usd_cents: finalQuote.finalReserveUsdCents,
              pool_nr_micro: finalQuote.finalPoolNrMicro,
              trigger: order!.toAsset === 'NR' ? 'SWAP_BUY' : 'SWAP_SELL',
              reference_id: order!.swapId,
              created_at: now,
            },
            { session }
          );
        }

        // 3. Egress Internal Credit (when toAsset is NR or USD)
        if (order!.toAsset === 'NR') {
          await walletService.creditBalance(userId, finalQuote.nrDeltaMicro, 'NR', order!.swapId, session);
        } else if (order!.toAsset === 'USD') {
          await walletService.creditBalance(userId, finalQuote.outputUsdCents, 'USD', order!.swapId, session);
        }
      });
    } finally {
      await session.endSession();
    }

    const q = finalQuote!;
    order.payAmount = q.payAmount;
    order.receiveAmount = q.receiveAmount;
    order.exchangeRate = q.exchangeRate;
    order.spotPriceBeforeUsd = q.spotPriceBeforeUsd;
    order.spotPriceAfterUsd = q.spotPriceAfterUsd;
    order.priceImpactPercent = q.priceImpactPercent;
    order.feeUsd = q.feeUsd;
    order.depositTxHash = txHashIngress;
    order.depositExplorerUrl =
      order.fromAsset === 'XRP'
        ? `https://testnet.xrpl.org/transactions/${txHashIngress}`
        : order.fromAsset === 'XLM'
        ? `https://stellar.expert/explorer/testnet/tx/${txHashIngress}`
        : undefined;

    // 4. Egress On-Chain Payout if target is XLM or XRP (after DB debit commit to prevent unbacked payouts)
    if (order.toAsset === 'XLM' || order.toAsset === 'XRP') {
      const payout = await CrossChainSwapService.payoutAssetToUser({
        toAsset: order.toAsset,
        destinationAddress: order.userDestinationAddress,
        amount: order.receiveAmount,
        referenceId: order.swapId,
      });
      order.payoutTxHash = payout.txHash;
      order.payoutExplorerUrl = payout.explorerUrl;
    } else {
      order.payoutTxHash = `nr_ledger_out_${crypto.randomBytes(12).toString('hex')}`;
    }

    order.status = 'COMPLETED';
    order.journalEntry = `JE-NR-${Date.now().toString().slice(-4)}`;
    NR_SWAP_ORDERS.set(order.swapId, order);
    RedisCacheService.invalidateCache('products:active').catch(() => {});

    return { order, poolStats: await this.getPoolStats() };
  }

  /**
   * Pays a PENDING order using user's $NR wallet balance with 10% discount + 0% routing fee.
   */
  static async payOrderWithNr(params: { userId: string; orderId: string }) {
    const { userId, orderId } = params;
    const variants = OrderSequenceService.getLookupVariants(orderId);
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');

    const order = await ordersCol.findOne({
      $or: [{ id: { $in: variants } }, { order_number: { $in: variants } }],
      user_id: userId,
    });

    if (!order) {
      throw new Error('Order not found');
    }
    if (order.status === 'PAID') {
      throw new Error('Order is already paid');
    }
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new Error(`Cannot pay order in ${order.status} status`);
    }

    const poolStats = await this.getPoolStats();
    const originalCents = Number(order.total_cents || 0);
    if (originalCents <= 0) {
      throw new Error('Invalid order total');
    }

    const nrDiscountCents = Math.round(originalCents * 0.1);
    const finalPaidCents = originalCents >= 100
      ? Math.max(100, originalCents - nrDiscountCents)
      : Math.max(1, originalCents - nrDiscountCents);

    const spotPriceUsd = poolStats.spotPriceUsd > 0 ? poolStats.spotPriceUsd : 1.0;
    const paidNrMicro = Math.max(1, Math.round(((finalPaidCents / 100) / spotPriceUsd) * NR_MICRO_SCALE));
    const paidNrAmount = Number((paidNrMicro / NR_MICRO_SCALE).toFixed(6));
    const txHash = `nr_pay_${crypto.randomBytes(16).toString('hex')}`;
    const now = new Date().toISOString();

    const client = await MongoService.getClient();
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. Atomic debit from user's NR balance (throws Insufficient NR balance if short)
        await walletService.debitBalance(
          userId,
          paidNrMicro,
          'NR',
          order.order_number || order.id,
          session
        );

        // 2. Conditional update on order so concurrent calls cannot pay twice
        const updateRes: any = await ordersCol.findOneAndUpdate(
          { id: order.id, status: { $nin: ['PAID', 'CANCELLED', 'REFUNDED'] } },
          {
            $set: {
              status: 'PAID',
              payment_rail: 'NR_TOKEN',
              tx_hash: txHash,
              total_cents: finalPaidCents,
              nr_discount_cents: nrDiscountCents,
              paid_nr_micro: paidNrMicro,
              nr_spot_rate_usd: spotPriceUsd,
              updated_at: now,
            },
          },
          { session, returnDocument: 'after' }
        );

        const updated = updateRes?.value || updateRes;
        if (!updated) {
          throw new Error('Order could not be settled (already paid or modified)');
        }
      });
    } finally {
      await session.endSession();
    }

    settlementEmitter.emitSettlement({
      orderId: order.id,
      orderNumber: order.order_number,
      status: 'PAID',
      paymentRail: 'NR_TOKEN',
      txHash,
      timestamp: now,
    });

    // Credit underlying asset holdings to user portfolio
    try {
      await PortfolioService.creditOrderAllocations(order);
    } catch (portErr: any) {
      console.warn('⚠️ [NrTokenService] Portfolio crediting warning:', portErr.message);
    }

    // Best-effort IPFS receipt anchor (non-blocking if PINATA_JWT is absent)
    IpfsService.pinOrderReceipt(order.id, {
      orderNumber: order.order_number,
      status: 'PAID',
      rail: 'NR_TOKEN',
      originalCents,
      nrDiscountCents,
      finalPaidCents,
      paidNrAmount,
      spotPriceUsd,
      txHash,
    })
      .then((pinned) => ordersCol.updateOne({ id: order.id }, { $set: { ipfs_cid: pinned.ipfsCid } }))
      .catch(() => {});

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      originalCents,
      nrDiscountCents,
      finalPaidCents,
      paidNrAmount,
      paidNrMicro,
      spotPriceUsd,
      txHash,
    };
  }

  /**
   * Injects platform revenue into R_USD without minting new NR, raising the $NR floor price.
   */
  static async injectRevenueToPool(
    amountUsdCents: number,
    referenceId: string,
    session?: ClientSession
  ): Promise<{ spotPriceUsd: number; reserveUsdCents: number }> {
    const cents = Math.round(amountUsdCents);
    if (!Number.isFinite(cents) || cents <= 0) {
      const stats = await this.getPoolStats();
      return { spotPriceUsd: stats.spotPriceUsd, reserveUsdCents: stats.reserveUsdCents };
    }

    const pool = await this.ensureGenesisPool();
    const poolCol = await MongoService.getCollection<MongoTokenPoolDoc>('token_pool');
    const historyCol = await MongoService.getCollection<MongoTokenPriceTickDoc>('token_price_history');

    const newReserve = pool.reserve_usd_cents + cents;
    const newSpotUsd = computeSpotPriceUsd(newReserve, pool.pool_nr_micro);
    const newSpotCents = Math.round(newSpotUsd * 100);
    const now = new Date().toISOString();

    const updateOpts: any = { returnDocument: 'after' };
    if (session) updateOpts.session = session;

    const updatedRes: any = await poolCol.findOneAndUpdate(
      { symbol: 'NR' },
      {
        $inc: {
          reserve_usd_cents: cents,
          cumulative_fee_injected_cents: cents,
        },
        $set: {
          spot_price_cents: newSpotCents,
          updated_at: now,
        },
      },
      updateOpts
    );

    const updatedDoc: MongoTokenPoolDoc = updatedRes?.value || updatedRes || {
      ...pool,
      reserve_usd_cents: newReserve,
    };
    const actualSpotUsd = computeSpotPriceUsd(updatedDoc.reserve_usd_cents, updatedDoc.pool_nr_micro);

    const insertOpts: any = {};
    if (session) insertOpts.session = session;
    await historyCol.insertOne(
      {
        id: `tick_${crypto.randomUUID()}`,
        symbol: 'NR',
        spot_price_cents: Math.round(actualSpotUsd * 100),
        spot_price_usd: Number(actualSpotUsd.toFixed(6)),
        reserve_usd_cents: updatedDoc.reserve_usd_cents,
        pool_nr_micro: updatedDoc.pool_nr_micro,
        trigger: 'REVENUE_INJECTION',
        reference_id: referenceId,
        created_at: now,
      },
      insertOpts
    );

    return {
      spotPriceUsd: Number(actualSpotUsd.toFixed(6)),
      reserveUsdCents: updatedDoc.reserve_usd_cents,
    };
  }

  /**
   * Operator admin reserve liquidity adjustment with safety floor check.
   */
  static async adminAdjustReserve(params: {
    deltaUsdCents: number;
    adminId: string;
    note?: string;
  }): Promise<NrPoolStats> {
    const delta = Math.round(params.deltaUsdCents);
    if (!Number.isFinite(delta) || delta === 0) {
      throw new Error('deltaUsdCents must be a non-zero integer');
    }

    const pool = await this.ensureGenesisPool();
    const targetReserve = pool.reserve_usd_cents + delta;
    if (targetReserve < MIN_RESERVE_USD_CENTS) {
      throw new Error(`Reserve cannot drop below safety floor of $${(MIN_RESERVE_USD_CENTS / 100).toFixed(2)}`);
    }

    const poolCol = await MongoService.getCollection<MongoTokenPoolDoc>('token_pool');
    const historyCol = await MongoService.getCollection<MongoTokenPriceTickDoc>('token_price_history');

    const newSpotUsd = computeSpotPriceUsd(targetReserve, pool.pool_nr_micro);
    const newSpotCents = Math.round(newSpotUsd * 100);
    const now = new Date().toISOString();

    await poolCol.updateOne(
      { symbol: 'NR' },
      {
        $inc: {
          reserve_usd_cents: delta,
          ...(delta > 0 ? { cumulative_fee_injected_cents: delta } : {}),
        },
        $set: {
          spot_price_cents: newSpotCents,
          updated_at: now,
        },
      }
    );

    await historyCol.insertOne({
      id: `tick_${crypto.randomUUID()}`,
      symbol: 'NR',
      spot_price_cents: newSpotCents,
      spot_price_usd: Number(newSpotUsd.toFixed(6)),
      reserve_usd_cents: targetReserve,
      pool_nr_micro: pool.pool_nr_micro,
      trigger: 'ADMIN_ADJUST',
      reference_id: `ADMIN:${params.adminId}${params.note ? `:${params.note}` : ''}`,
      created_at: now,
    });

    RedisCacheService.invalidateCache('products:active').catch(() => {});
    return this.getPoolStats();
  }
}
