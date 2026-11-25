import crypto from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { env } from '../config/env.js';
import {
  MongoService,
  MongoBuybackExecutionDoc,
} from './mongo.js';
import { VaultEncryptionService } from './vaultEncryption.service.js';
import { SorobanService, NEXUS_SWAP_CONTRACT_ID, NEXUS_VAULT_CONTRACT_ID } from './soroban.js';
import { GlobalSupplyCoordinator } from './globalSupplyCoordinator.service.js';
import { TreasuryService } from './treasury.service.js';

export const DEFAULT_MIN_BUYBACK_THRESHOLD_XLM = 50;
export const DEFAULT_GAS_BUFFER_XLM = 5;
export const DEFAULT_MAX_SINGLE_SWAP_XLM = 500;
export const DEFAULT_MAX_SLIPPAGE_BPS = 150; // 1.50%
export const DEFAULT_MAX_PRICE_IMPACT_PCT = 5.0; // 5.00%

export interface BuybackExecutionParams {
  idempotencyKey?: string;
  triggerType?: 'ADMIN_MANUAL' | 'SCHEDULED_WORKER';
  triggeredBy?: string;
  xlmAmount?: number;
  minThresholdXlm?: number;
  maxSingleSwapXlm?: number;
  maxSlippageBps?: number;
  maxPriceImpactPct?: number;
}

export interface BuybackStatusDTO {
  configured: boolean;
  reserveAddress: string | null;
  reserveCollisionDetected: boolean;
  configurationMessage?: string;
  onChainReserveXlmBalance: number;
  onChainReserveNxlBalance: number;
  spendableXlmAfterGasBuffer: number;
  minThresholdXlm: number;
  eligibleForBuyback: boolean;
  poolReserveXlm: number;
  poolReserveNxl: number;
  poolSpotPriceXlmPerNxl: number;
  virtualTreasuryPoolInjectedUsd: number;
  confirmedMetrics: {
    completedExecutions: number;
    pendingOrRetryingExecutions: number;
    totalXlmSpent: number;
    totalNxlPurchased: number;
    totalNxlBurnedOnChain: number;
    unburnedPurchasedNxl: number;
  };
  recentExecutions: MongoBuybackExecutionDoc[];
}

export class BuybackService {
  private static readonly EXEC_LOCK_KEY = 'buyback_execution_lock';
  private static readonly MAX_RETRIES = 5;

  private static computeBackoffMs(retryCount: number): number {
    return Math.min(300_000, 15_000 * Math.pow(2, Math.max(0, retryCount - 1)));
  }

  /**
   * Resolves the protocol-controlled Buyback Reserve signer.
   * Refuses if the configured reserve secret belongs to the Classic $NXL Issuer account.
   */
  static async resolveBuybackReserveSigner(): Promise<{
    keypair: Keypair;
    publicKey: string;
    secret: string;
  }> {
    let secret = env.STELLAR_BUYBACK_RESERVE_SECRET || '';
    if (!secret) {
      try {
        const secrets = await VaultEncryptionService.getDecryptedSecrets();
        secret = secrets.stellarBuybackReserveSecret || '';
      } catch {}
    }

    if (!secret || !secret.startsWith('S') || secret.length !== 56) {
      throw new Error(
        'Buyback Reserve secret (STELLAR_BUYBACK_RESERVE_SECRET) is not configured. Add a dedicated Stellar Buyback Reserve keypair in Admin Secrets Vault before executing on-chain buybacks.'
      );
    }

    const kp = Keypair.fromSecret(secret);
    const pub = kp.publicKey();
    const stellarIssuer =
      env.STELLAR_NR_ISSUER_PUBLIC || 'GB24JBHL5EIZPUJPGPT67W6BDSEWY2SJU4I2UOV3RAZ4DG4HLLBJRAOZ';

    if (pub === stellarIssuer) {
      throw new Error(
        `Unsafe Buyback Reserve configuration: reserve public key (${pub}) matches the $NXL Classic Issuer. Rotate STELLAR_BUYBACK_RESERVE_SECRET to an isolated protocol wallet.`
      );
    }

    return { keypair: kp, publicKey: pub, secret };
  }

  /**
   * Reads live Horizon native XLM and $NXL balances for a Stellar account.
   */
  static async fetchAccountBalances(address: string): Promise<{ xlmBalance: number; nxlBalance: number }> {
    const horizonUrl =
      env.HORIZON_URL || env.STELLAR_HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org';
    const stellarIssuer =
      env.STELLAR_NR_ISSUER_PUBLIC || 'GB24JBHL5EIZPUJPGPT67W6BDSEWY2SJU4I2UOV3RAZ4DG4HLLBJRAOZ';
    const assetCode = env.STELLAR_NR_ASSET_CODE || 'NXL';

    const res = await fetch(`${horizonUrl.replace(/\/$/, '')}/accounts/${address}`);
    if (!res.ok) {
      if (res.status === 404) {
        return { xlmBalance: 0, nxlBalance: 0 };
      }
      throw new Error(`Horizon balance lookup failed (${res.status}) for ${address}`);
    }
    const data: any = await res.json();
    const balances = Array.isArray(data?.balances) ? data.balances : [];
    const native = balances.find((b: any) => b.asset_type === 'native');
    const nxl = balances.find(
      (b: any) => b.asset_code === assetCode && b.asset_issuer === stellarIssuer
    );
    return {
      xlmBalance: native ? parseFloat(native.balance || '0') : 0,
      nxlBalance: nxl ? parseFloat(nxl.balance || '0') : 0,
    };
  }

  /**
   * Returns complete observable buyback & burn telemetry.
   * Strictly separates virtual DB treasury pool metrics from confirmed on-chain swaps & SAC burns.
   */
  static async getStatus(): Promise<BuybackStatusDTO> {
    let configured = false;
    let reserveAddress: string | null = null;
    let configurationMessage: string | undefined;
    let reserveCollisionDetected = false;

    try {
      const signer = await this.resolveBuybackReserveSigner();
      configured = true;
      reserveAddress = signer.publicKey;
    } catch (err: any) {
      configurationMessage = err?.message;
      reserveAddress = env.STELLAR_BUYBACK_RESERVE_PUBLIC || null;
      const stellarIssuer =
        env.STELLAR_NR_ISSUER_PUBLIC || 'GB24JBHL5EIZPUJPGPT67W6BDSEWY2SJU4I2UOV3RAZ4DG4HLLBJRAOZ';
      if (reserveAddress === stellarIssuer) reserveCollisionDetected = true;
    }

    let onChainReserveXlmBalance = 0;
    let onChainReserveNxlBalance = 0;
    if (reserveAddress) {
      try {
        const bal = await this.fetchAccountBalances(reserveAddress);
        onChainReserveXlmBalance = bal.xlmBalance;
        onChainReserveNxlBalance = bal.nxlBalance;
      } catch {}
    }

    let poolReserveXlm = 0;
    let poolReserveNxl = 0;
    let poolSpotPriceXlmPerNxl = 0;
    try {
      const pool = await SorobanService.getLiveSwapPoolState();
      poolReserveXlm = pool.reserveXlm;
      poolReserveNxl = pool.reserveNxl;
      poolSpotPriceXlmPerNxl = pool.spotPriceXlmPerNxl;
    } catch {}

    let virtualTreasuryPoolInjectedUsd = 0;
    try {
      const t = await TreasuryService.getTreasurySummary();
      virtualTreasuryPoolInjectedUsd = t.nrPoolInjectedUsd || 0;
    } catch {}

    const col = await MongoService.getCollection<MongoBuybackExecutionDoc>('buyback_executions');
    const [recentExecutions, allExecs] = await Promise.all([
      col.find({}).sort({ created_at: -1 }).limit(20).toArray(),
      col.find({}).toArray(),
    ]);

    let completedExecutions = 0;
    let pendingOrRetryingExecutions = 0;
    let totalXlmSpent = 0;
    let totalNxlPurchased = 0;
    let totalNxlBurnedOnChain = 0;
    let unburnedPurchasedNxl = 0;

    for (const ex of allExecs) {
      if (ex.status === 'COMPLETED') {
        completedExecutions++;
        totalXlmSpent += Number(ex.xlm_to_spend || 0);
        totalNxlPurchased += Number(ex.actual_nxl_purchased || 0);
        totalNxlBurnedOnChain += Number(ex.burned_nxl || 0);
      } else if (ex.status !== 'FAILED') {
        pendingOrRetryingExecutions++;
        if (ex.swap_tx_hash && ex.actual_nxl_purchased > 0 && !ex.burn_tx_hash) {
          unburnedPurchasedNxl += Number(ex.actual_nxl_purchased || 0);
        }
      }
    }

    const spendableXlmAfterGasBuffer = Number(
      Math.max(0, onChainReserveXlmBalance - DEFAULT_GAS_BUFFER_XLM).toFixed(7)
    );

    return {
      configured,
      reserveAddress,
      reserveCollisionDetected,
      configurationMessage,
      onChainReserveXlmBalance: Number(onChainReserveXlmBalance.toFixed(7)),
      onChainReserveNxlBalance: Number(onChainReserveNxlBalance.toFixed(7)),
      spendableXlmAfterGasBuffer,
      minThresholdXlm: DEFAULT_MIN_BUYBACK_THRESHOLD_XLM,
      eligibleForBuyback: configured && spendableXlmAfterGasBuffer >= DEFAULT_MIN_BUYBACK_THRESHOLD_XLM,
      poolReserveXlm,
      poolReserveNxl,
      poolSpotPriceXlmPerNxl,
      virtualTreasuryPoolInjectedUsd,
      confirmedMetrics: {
        completedExecutions,
        pendingOrRetryingExecutions,
        totalXlmSpent: Number(totalXlmSpent.toFixed(7)),
        totalNxlPurchased: Number(totalNxlPurchased.toFixed(7)),
        totalNxlBurnedOnChain: Number(totalNxlBurnedOnChain.toFixed(7)),
        unburnedPurchasedNxl: Number(unburnedPurchasedNxl.toFixed(7)),
      },
      recentExecutions,
    };
  }

  /**
   * Executes or resumes a durable Buyback-and-Burn cycle:
   *   COLLECTING -> QUOTED -> SWAPPING -> SWAPPED -> BURNING -> COMPLETED
   *
   * Safety guarantees:
   * - Distributed MongoDB lease lock prevents concurrent overlapping buybacks.
   * - Minimum threshold, max single-swap limit, slippage bound, and max price-impact guards.
   * - Never counts purchased tokens as burned until SAC `burn_nxl` finality confirms.
   * - Crash-safe resume: if interrupted after swap confirms (`SWAPPED` or `RETRY_SCHEDULED`
   *   with `swap_tx_hash`), resumes strictly at `BURNING` without executing a duplicate swap.
   */
  static async executeBuybackAndBurn(
    params: BuybackExecutionParams = {}
  ): Promise<MongoBuybackExecutionDoc> {
    const col = await MongoService.getCollection<MongoBuybackExecutionDoc>('buyback_executions');
    const idempotencyKey =
      (params.idempotencyKey || '').trim() ||
      `bb_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

    const existingCompleted = await col.findOne({ idempotency_key: idempotencyKey });
    if (existingCompleted?.status === 'COMPLETED') {
      return existingCompleted;
    }

    const ownerId = `bb_exec_${crypto.randomUUID()}`;
    const lockAcquired = await GlobalSupplyCoordinator.acquireLeaseLock(
      this.EXEC_LOCK_KEY,
      ownerId,
      60_000
    );
    if (!lockAcquired) {
      throw new Error('Another buyback-and-burn execution is currently in progress');
    }

    try {
      const recheck = await col.findOne({ idempotency_key: idempotencyKey });
      if (recheck?.status === 'COMPLETED') {
        return recheck;
      }

      const signer = await this.resolveBuybackReserveSigner();

      // Resume directly at BURNING if this idempotencyKey already completed Step 1 (Swap)
      if (recheck && recheck.swap_tx_hash && recheck.actual_nxl_purchased > 0 && !recheck.burn_tx_hash) {
        return await this.executeBurnStep(col, recheck, signer.secret, params.triggeredBy || recheck.triggered_by);
      }

      const minThresholdXlm = params.minThresholdXlm ?? DEFAULT_MIN_BUYBACK_THRESHOLD_XLM;
      const maxSingleSwapXlm = params.maxSingleSwapXlm ?? DEFAULT_MAX_SINGLE_SWAP_XLM;
      const maxSlippageBps = Math.min(1000, Math.max(10, params.maxSlippageBps ?? DEFAULT_MAX_SLIPPAGE_BPS));
      const maxPriceImpactPct = Math.min(25, Math.max(0.1, params.maxPriceImpactPct ?? DEFAULT_MAX_PRICE_IMPACT_PCT));

      // 1. COLLECTING: Check actual on-chain XLM balance of Buyback Reserve wallet
      const { xlmBalance } = await this.fetchAccountBalances(signer.publicKey);
      const spendableXlm = Number(Math.max(0, xlmBalance - DEFAULT_GAS_BUFFER_XLM).toFixed(7));

      if (spendableXlm < minThresholdXlm) {
        throw new Error(
          `Buyback threshold not met: spendable XLM (${spendableXlm.toFixed(4)} XLM after ${DEFAULT_GAS_BUFFER_XLM} XLM gas buffer) is below minimum threshold (${minThresholdXlm} XLM).`
        );
      }

      const requestedXlm =
        params.xlmAmount !== undefined ? Number(params.xlmAmount) : spendableXlm;
      if (!Number.isFinite(requestedXlm) || requestedXlm <= 0) {
        throw new Error('Buyback XLM spend amount must be positive');
      }
      const xlmToSpend = Number(Math.min(requestedXlm, spendableXlm, maxSingleSwapXlm).toFixed(7));
      if (xlmToSpend < minThresholdXlm) {
        throw new Error(
          `Requested/capped buyback amount (${xlmToSpend} XLM) is below minimum threshold (${minThresholdXlm} XLM).`
        );
      }

      // 2. QUOTED: Quote on-chain NexusSwap AMM & validate slippage + price impact
      const [poolState, quote] = await Promise.all([
        SorobanService.getLiveSwapPoolState(),
        SorobanService.quoteOnChainSwap('XLM', xlmToSpend),
      ]);

      if (poolState.isPaused) {
        throw new Error('NexusSwap AMM contract is currently paused');
      }
      if (quote.amountOut <= 0 || poolState.reserveXlm <= 0 || poolState.reserveNxl <= 0) {
        throw new Error('NexusSwap AMM pool returned zero output quote');
      }

      const spotExpectedNxl = xlmToSpend * (poolState.reserveNxl / poolState.reserveXlm);
      const estimatedPriceImpactPct =
        spotExpectedNxl > 0
          ? Number(Math.max(0, ((spotExpectedNxl - quote.amountOut) / spotExpectedNxl) * 100).toFixed(4))
          : 0;

      if (estimatedPriceImpactPct > maxPriceImpactPct) {
        throw new Error(
          `Buyback aborted: estimated AMM price impact (${estimatedPriceImpactPct.toFixed(2)}%) exceeds maximum allowed (${maxPriceImpactPct.toFixed(2)}%).`
        );
      }

      const minNxlOut = Number((quote.amountOut * (1 - maxSlippageBps / 10_000)).toFixed(7));
      const execId = recheck?.id || `bb_${crypto.randomUUID()}`;
      const burnRefId = recheck?.burn_ref_id || `BUYBACK_BURN_${idempotencyKey}`;
      const now = new Date().toISOString();

      const quotedDoc: MongoBuybackExecutionDoc = {
        id: execId,
        idempotency_key: idempotencyKey,
        trigger_type: params.triggerType || 'ADMIN_MANUAL',
        triggered_by: params.triggeredBy || 'ADMIN',
        reserve_address: signer.publicKey,
        status: 'QUOTED',
        reserve_xlm_before: xlmBalance,
        xlm_to_spend: xlmToSpend,
        quoted_nxl_out: quote.amountOut,
        min_nxl_out: minNxlOut,
        max_slippage_bps: maxSlippageBps,
        max_price_impact_pct: maxPriceImpactPct,
        estimated_price_impact_pct: estimatedPriceImpactPct,
        actual_nxl_purchased: 0,
        burned_nxl: 0,
        burn_ref_id: burnRefId,
        retry_count: recheck?.retry_count || 0,
        max_retries: this.MAX_RETRIES,
        created_at: recheck?.created_at || now,
        updated_at: now,
      };

      await col.updateOne(
        { idempotency_key: idempotencyKey },
        { $set: quotedDoc },
        { upsert: true }
      );

      // 3. SWAPPING -> SWAPPED: Execute real swap_exact_in(XLM -> NXL) on NexusSwap
      await col.updateOne(
        { id: execId },
        { $set: { status: 'SWAPPING', updated_at: new Date().toISOString() } }
      );

      let swapRes: Awaited<ReturnType<typeof SorobanService.executeBuybackSwapOnNexusSwap>>;
      try {
        swapRes = await SorobanService.executeBuybackSwapOnNexusSwap({
          buyerSecret: signer.secret,
          amountXlm: xlmToSpend,
          minNxlOut,
          refId: `BUYBACK_SWAP_${idempotencyKey}`,
          operatorId: quotedDoc.triggered_by,
        });
        if (swapRes.status !== 'SUCCESS' || !swapRes.txHash || swapRes.amountNxlReceived <= 0) {
          throw new Error('NexusSwap swap_exact_in did not confirm positive NXL purchase on-chain');
        }
      } catch (swapErr: any) {
        const errMsg = swapErr?.message || 'On-chain NexusSwap buyback failed';
        await col.updateOne(
          { id: execId },
          {
            $set: {
              status: 'FAILED',
              last_error: errMsg,
              updated_at: new Date().toISOString(),
            },
          }
        );
        throw swapErr;
      }

      const swappedAt = new Date().toISOString();
      await col.updateOne(
        { id: execId },
        {
          $set: {
            status: 'SWAPPED',
            swap_tx_hash: swapRes.txHash,
            swap_ledger_seq: swapRes.ledger,
            swap_explorer_url: swapRes.explorerUrl,
            actual_nxl_purchased: swapRes.amountNxlReceived,
            burned_nxl: 0, // Strictly zero until SAC burn_nxl confirms!
            last_error: undefined,
            updated_at: swappedAt,
          },
        }
      );

      const swappedDoc = (await col.findOne({ id: execId }))!;

      // 4. BURNING -> COMPLETED: Execute real SAC burn_nxl(reason="buyback") from Buyback Reserve
      return await this.executeBurnStep(col, swappedDoc, signer.secret, quotedDoc.triggered_by);
    } finally {
      await GlobalSupplyCoordinator.releaseLeaseLock(this.EXEC_LOCK_KEY, ownerId);
    }
  }

  /**
   * Executes ONLY the SAC burn leg on an already-swapped buyback execution.
   * Ensures crash/restart safety: purchased tokens are burned once without re-swapping.
   */
  private static async executeBurnStep(
    col: Awaited<ReturnType<typeof MongoService.getCollection<MongoBuybackExecutionDoc>>>,
    doc: MongoBuybackExecutionDoc,
    holderSecret: string,
    operatorId: string
  ): Promise<MongoBuybackExecutionDoc> {
    if (doc.status === 'COMPLETED' && doc.burn_tx_hash) {
      return doc;
    }

    await col.updateOne(
      { id: doc.id },
      { $set: { status: 'BURNING', updated_at: new Date().toISOString() } }
    );

    const burnRefId = doc.burn_ref_id || `BUYBACK_BURN_${doc.idempotency_key}`;
    try {
      const burnRes = await SorobanService.burnNxlOnChain({
        amountNxl: doc.actual_nxl_purchased,
        reason: 'buyback',
        refId: burnRefId,
        operatorId,
        holderSecret,
      });

      if (burnRes.status !== 'SUCCESS' || !burnRes.txHash) {
        throw new Error('NexusVault burn_nxl did not achieve confirmed SUCCESS finality');
      }

      const completedAt = new Date().toISOString();
      await col.updateOne(
        { id: doc.id },
        {
          $set: {
            status: 'COMPLETED',
            burned_nxl: doc.actual_nxl_purchased,
            burn_tx_hash: burnRes.txHash,
            burn_ledger_seq: burnRes.ledger,
            burn_explorer_url: burnRes.explorerUrl,
            burn_ref_id: burnRefId,
            last_error: undefined,
            next_retry_at: undefined,
            completed_at: completedAt,
            updated_at: completedAt,
          },
        }
      );

      return (await col.findOne({ id: doc.id }))!;
    } catch (burnErr: any) {
      const nextRetryCount = (doc.retry_count || 0) + 1;
      const exhausted = nextRetryCount >= (doc.max_retries || this.MAX_RETRIES);
      const nextStatus = exhausted ? 'FAILED' : 'RETRY_SCHEDULED';
      const nextRetryAt = exhausted
        ? undefined
        : new Date(Date.now() + this.computeBackoffMs(nextRetryCount)).toISOString();

      await col.updateOne(
        { id: doc.id },
        {
          $set: {
            status: nextStatus,
            burned_nxl: 0, // Must stay 0 until burn succeeds!
            retry_count: nextRetryCount,
            next_retry_at: nextRetryAt,
            last_error: burnErr?.message || 'On-chain buyback burn_nxl failed',
            updated_at: new Date().toISOString(),
          },
        }
      );

      return (await col.findOne({ id: doc.id }))!;
    }
  }

  /**
   * Resumes a previously swapped or retry-scheduled buyback execution by ID.
   */
  static async resumePendingBurn(executionId: string): Promise<MongoBuybackExecutionDoc> {
    const col = await MongoService.getCollection<MongoBuybackExecutionDoc>('buyback_executions');
    const doc = await col.findOne({ id: executionId });
    if (!doc) {
      throw new Error(`Buyback execution "${executionId}" not found`);
    }
    return this.executeBuybackAndBurn({
      idempotencyKey: doc.idempotency_key,
      triggerType: doc.trigger_type,
      triggeredBy: doc.triggered_by,
    });
  }

  static async getHistory(limit = 50): Promise<MongoBuybackExecutionDoc[]> {
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const col = await MongoService.getCollection<MongoBuybackExecutionDoc>('buyback_executions');
    return col.find({}).sort({ created_at: -1 }).limit(safeLimit).toArray();
  }
}
