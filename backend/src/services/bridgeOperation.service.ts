import crypto from 'crypto';
import { StrKey } from '@stellar/stellar-sdk';
import { isValidClassicAddress } from 'xrpl';
import {
  MongoService,
  MongoBridgeOperationDoc,
  BridgeDirection,
  BridgeMechanism,
  BridgeOperationStatus,
} from './mongo.js';
import { CrossChainSwapService } from './crossChainSwap.service.js';
import { DualRailTokenService } from './dualRailToken.service.js';
import {
  SorobanService,
  NEXUS_SWAP_CONTRACT_ID,
  NEXUS_VAULT_CONTRACT_ID,
} from './soroban.js';
import { GlobalSupplyCoordinator } from './globalSupplyCoordinator.service.js';
import { getFxQuote } from './market.js';
import { NrTokenService } from './nrToken.service.js';
import {
  SwapTransactionLeg,
  buildExplorerTxUrl,
  isRealOnChainTxHash,
  sanitizeOnChainTxHash,
} from '../utils/swapTransactions.js';

export type SorobanBridgeMode =
  | 'SOROBAN_BRIDGE_ESCROW'
  | 'SOROBAN_BRIDGE_BURN'
  | 'SOROBAN_BRIDGE_NXL';

export class BridgeOperationService {
  private static readonly MAX_RETRIES = 5;

  private static computeBackoffMs(retryCount: number): number {
    return Math.min(300_000, 15_000 * Math.pow(2, Math.max(0, retryCount - 1)));
  }

  private static async updateDoc(
    swapId: string,
    patch: Partial<MongoBridgeOperationDoc>
  ): Promise<MongoBridgeOperationDoc> {
    const col = await MongoService.getCollection<MongoBridgeOperationDoc>('bridge_operations');
    const updatedAt = new Date().toISOString();
    await col.updateOne({ swap_id: swapId }, { $set: { ...patch, updated_at: updatedAt } });
    return (await col.findOne({ swap_id: swapId }))!;
  }

  private static async logChainSummary(op: MongoBridgeOperationDoc): Promise<void> {
    await DualRailTokenService.logChainAction({
      chain: op.source_chain,
      action: 'CROSS_CHAIN_BRIDGE',
      operatorId: op.user_id || 'BRIDGE_RELAYER',
      referenceId: op.swap_id,
      txHash: op.source_tx_hash,
      amountPrimary: op.from_amount,
      amountSecondary: op.to_amount,
      status: op.status === 'COMPLETED' ? 'SUCCESS' : 'FAILED',
      errorMessage: op.last_error,
      details: {
        direction: op.direction,
        mechanism: op.mechanism,
        fromAsset: op.from_asset,
        toAsset: op.to_asset,
        destinationAddress: op.destination_address,
        destTxHash: op.dest_tx_hash,
        escrowReleaseTxHash: op.escrow_release_tx_hash,
        escrowRefundTxHash: op.escrow_refund_tx_hash,
        status: op.status,
      },
    }).catch(() => {});
  }

  /**
   * Computes quote for Stellar -> XRPL Soroban bridges:
   * - `XLM -> XRP` (Escrow-First)
   * - `NXL -> XRP` (Burn-for-Bridge + XRP payout)
   * - `NXL -> NXL` (Strict 1:1 Burn-and-Mint cross-chain transfer)
   */
  static async quoteBridgeOutput(params: {
    fromAsset: 'XLM' | 'XRP' | 'NXL';
    toAsset: 'XLM' | 'XRP' | 'NXL';
    amount: number;
  }): Promise<{ toAmount: number; exchangeRate: number }> {
    const { fromAsset, toAsset, amount } = params;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Bridge amount must be greater than zero.');
    }

    if (fromAsset === 'NXL' && toAsset === 'NXL') {
      return {
        toAmount: Number(amount.toFixed(6)),
        exchangeRate: 1,
      };
    }

    const fx = await getFxQuote();
    if (fromAsset === 'XLM' && toAsset === 'XRP') {
      const rate = fx.xlmUsd / fx.xrpUsd;
      return { toAmount: Number((amount * rate).toFixed(4)), exchangeRate: Number(rate.toFixed(6)) };
    }
    if (fromAsset === 'XRP' && toAsset === 'XLM') {
      const rate = fx.xrpUsd / fx.xlmUsd;
      return { toAmount: Number((amount * rate).toFixed(4)), exchangeRate: Number(rate.toFixed(6)) };
    }

    const poolStats = await NrTokenService.getPoolStats().catch(() => ({ spotPriceUsd: 1 }));
    const nxlUsd = poolStats.spotPriceUsd || 1;
    if (fromAsset === 'NXL') {
      const targetUsd = toAsset === 'XRP' ? fx.xrpUsd : fx.xlmUsd;
      const rate = nxlUsd / Math.max(0.01, targetUsd);
      return { toAmount: Number((amount * rate).toFixed(4)), exchangeRate: Number(rate.toFixed(6)) };
    }

    // XRP or XLM -> NXL
    const sourceUsd = fromAsset === 'XRP' ? fx.xrpUsd : fx.xlmUsd;
    const rate = sourceUsd / Math.max(0.01, nxlUsd);
    return { toAmount: Number((amount * rate).toFixed(6)), exchangeRate: Number(rate.toFixed(6)) };
  }

  /**
   * Submits a user-signed Soroban bridge tx (`lock_bridge_escrow` or `burn_for_bridge`),
   * records a durable `bridge_operations` document immediately upon ingress finality,
   * and executes destination payout + escrow release with automatic retry recovery.
   */
  static async submitSorobanBridge(params: {
    signedXdr: string;
    mode: SorobanBridgeMode;
    swapId: string;
    fromAsset: 'XLM' | 'NXL';
    toAsset: 'XRP' | 'NXL';
    amount: number;
    xrplDestination: string;
    userSourceAddress?: string;
    userId?: string;
    escrowExpiryUnixSec?: number;
  }): Promise<MongoBridgeOperationDoc> {
    const cleanXdr = String(params.signedXdr || '').trim();
    const xrplDest = String(params.xrplDestination || '').trim();
    if (!cleanXdr) throw new Error('signedXdr is required');
    if (!isValidClassicAddress(xrplDest)) {
      throw new Error(`Invalid XRPL destination address: "${xrplDest}"`);
    }
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new Error('Bridge amount must be greater than zero');
    }

    const col = await MongoService.getCollection<MongoBridgeOperationDoc>('bridge_operations');
    const existingBySwap = await col.findOne({ swap_id: params.swapId });
    if (existingBySwap) {
      if (existingBySwap.status === 'COMPLETED' || existingBySwap.status === 'REFUNDED') {
        return existingBySwap;
      }
      return this.processBridgeOperation(params.swapId);
    }

    // Broadcast user-signed Soroban ingress tx
    const txRes = await SorobanService.submitSignedSorobanXdr(cleanXdr);
    const ingressHash = sanitizeOnChainTxHash(txRes.txHash) || txRes.txHash;
    const ingressExplorerUrl = buildExplorerTxUrl('STELLAR', ingressHash) || txRes.explorerUrl;

    await CrossChainSwapService.assertDepositHashNotReplayed(ingressHash, params.swapId);

    const { toAmount, exchangeRate } = await this.quoteBridgeOutput({
      fromAsset: params.fromAsset,
      toAsset: params.toAsset,
      amount: params.amount,
    });

    const nowIso = new Date().toISOString();
    const mechanism: BridgeMechanism =
      params.mode === 'SOROBAN_BRIDGE_ESCROW' ? 'SOROBAN_ESCROW' : 'BURN_AND_MINT';

    const initialLeg: SwapTransactionLeg = {
      sequence: 1,
      direction: 'INCOMING',
      stage: 'DEPOSIT',
      label:
        mechanism === 'SOROBAN_ESCROW'
          ? `Lock ${params.fromAsset} in Bridge Escrow (Stellar)`
          : `Burn ${params.fromAsset} on NexusVault (Stellar)`,
      asset: params.fromAsset,
      amount: params.amount,
      rail: 'STELLAR',
      status: 'SUCCESS',
      txHash: ingressHash,
      explorerUrl: ingressExplorerUrl,
      timestamp: nowIso,
    };

    const doc: MongoBridgeOperationDoc = {
      id: `bridge_${crypto.randomUUID()}`,
      swap_id: params.swapId,
      user_id: params.userId,
      direction: 'STELLAR_TO_XRPL',
      mechanism,
      from_asset: params.fromAsset,
      to_asset: params.toAsset,
      from_amount: params.amount,
      to_amount: toAmount,
      exchange_rate: exchangeRate,
      source_chain: 'STELLAR',
      dest_chain: 'XRPL',
      source_address: params.userSourceAddress || '',
      destination_address: xrplDest,
      source_tx_hash: ingressHash,
      source_explorer_url: ingressExplorerUrl,
      source_verified_at: nowIso,
      escrow_contract_id:
        mechanism === 'SOROBAN_ESCROW' ? NEXUS_SWAP_CONTRACT_ID : NEXUS_VAULT_CONTRACT_ID,
      escrow_expiry_unix_sec:
        mechanism === 'SOROBAN_ESCROW'
          ? params.escrowExpiryUnixSec || Math.floor(Date.now() / 1000) + 900
          : undefined,
      status: 'SOURCE_VERIFIED',
      retry_count: 0,
      max_retries: this.MAX_RETRIES,
      legs: [initialLeg],
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      await col.insertOne(doc);
    } catch (err: any) {
      if (err?.code === 11000) {
        const dup =
          (await col.findOne({ swap_id: params.swapId })) ||
          (await col.findOne({ source_tx_hash: ingressHash }));
        if (dup && dup.swap_id !== params.swapId) {
          throw new Error(`Replay rejected: transaction hash ${ingressHash} already claimed by ${dup.swap_id}`);
        }
        if (dup) return this.processBridgeOperation(dup.swap_id);
      }
      throw err;
    }

    return this.processBridgeOperation(params.swapId);
  }

  /**
   * Executes or verifies an XRPL -> Stellar bridge (`XRP` or `NXL` ingress -> `XLM` or 1:1 `NXL` egress).
   */
  static async executeXrplToStellarBridge(params: {
    swapId?: string;
    userId?: string;
    fromAsset: 'XRP' | 'NXL';
    toAsset: 'XLM' | 'NXL';
    amount: number;
    destinationAddress: string;
    sourceTxHash: string;
    expectedDestinationTag?: number;
    skipDepositVerification?: boolean;
  }): Promise<MongoBridgeOperationDoc> {
    const dest = String(params.destinationAddress || '').trim();
    if (!StrKey.isValidEd25519PublicKey(dest)) {
      throw new Error(`Invalid Stellar destination address: "${dest}"`);
    }
    const cleanHash = sanitizeOnChainTxHash(params.sourceTxHash);
    if (!cleanHash || !isRealOnChainTxHash(cleanHash)) {
      throw new Error('Valid 64-character XRPL transaction hash is required');
    }

    const swapId =
      params.swapId ||
      `BRG-IN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const col = await MongoService.getCollection<MongoBridgeOperationDoc>('bridge_operations');
    const existing =
      (await col.findOne({ swap_id: swapId })) || (await col.findOne({ source_tx_hash: cleanHash }));
    if (existing) {
      if (existing.swap_id !== swapId) {
        throw new Error(`Replay rejected: XRPL tx ${cleanHash} already used by ${existing.swap_id}`);
      }
      if (existing.status === 'COMPLETED') return existing;
      return this.processBridgeOperation(existing.swap_id);
    }

    await CrossChainSwapService.assertDepositHashNotReplayed(cleanHash, swapId);

    const platformXrplVault = CrossChainSwapService.getXrplPlatformAddress();
    let verifiedSourceAddr = '';
    let verifiedAmount = params.amount;

    if (!params.skipDepositVerification) {
      const verifyType = params.fromAsset === 'NXL' ? 'NXL_XRPL' : 'XRP';
      const verification = await CrossChainSwapService.verifyOnChainDeposit(verifyType, cleanHash, {
        expectedDestination: platformXrplVault,
        minAmount: params.amount,
        expectedDestinationTag: params.expectedDestinationTag,
      });

      if (verification.status === 'NOT_FOUND') {
        throw new Error(verification.errorMessage || 'XRPL deposit not validated yet');
      }
      if (verification.status === 'FAILED') {
        throw new Error(verification.errorMessage || 'XRPL deposit verification failed');
      }
      verifiedSourceAddr = verification.verifiedDetails?.sourceAccount || '';
      if (verification.verifiedDetails?.amount) {
        verifiedAmount = verification.verifiedDetails.amount;
      }
    }

    const { toAmount, exchangeRate } = await this.quoteBridgeOutput({
      fromAsset: params.fromAsset,
      toAsset: params.toAsset,
      amount: Math.min(params.amount, verifiedAmount) || params.amount,
    });

    const nowIso = new Date().toISOString();
    const ingressExplorer = buildExplorerTxUrl('XRPL', cleanHash) || '';
    const mechanism: BridgeMechanism =
      params.fromAsset === 'NXL' && params.toAsset === 'NXL' ? 'BURN_AND_MINT' : 'LOCK_AND_RELEASE';

    const doc: MongoBridgeOperationDoc = {
      id: `bridge_${crypto.randomUUID()}`,
      swap_id: swapId,
      user_id: params.userId,
      direction: 'XRPL_TO_STELLAR',
      mechanism,
      from_asset: params.fromAsset,
      to_asset: params.toAsset,
      from_amount: params.amount,
      to_amount: toAmount,
      exchange_rate: exchangeRate,
      source_chain: 'XRPL',
      dest_chain: 'STELLAR',
      source_address: verifiedSourceAddr,
      destination_address: dest,
      source_tx_hash: cleanHash,
      source_explorer_url: ingressExplorer,
      source_verified_at: nowIso,
      status: 'SOURCE_VERIFIED',
      retry_count: 0,
      max_retries: this.MAX_RETRIES,
      legs: [
        {
          sequence: 1,
          direction: 'INCOMING',
          stage: 'DEPOSIT',
          label: `Verified XRPL ${params.fromAsset} Deposit`,
          asset: params.fromAsset,
          amount: params.amount,
          rail: 'XRPL',
          status: 'SUCCESS',
          txHash: cleanHash,
          explorerUrl: ingressExplorer,
          toAddress: platformXrplVault,
          timestamp: nowIso,
        },
      ],
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      await col.insertOne(doc);
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new Error(`Replay rejected: XRPL tx ${cleanHash} already claimed`);
      }
      throw err;
    }

    return this.processBridgeOperation(swapId);
  }

  /**
   * Idempotent state-machine driver for a `bridge_operations` record.
   * Safe against double-payout, double-mint, and crash recovery.
   */
  static async processBridgeOperation(swapId: string): Promise<MongoBridgeOperationDoc> {
    const col = await MongoService.getCollection<MongoBridgeOperationDoc>('bridge_operations');
    let op = await col.findOne({ swap_id: swapId });
    if (!op) throw new Error(`Bridge operation ${swapId} not found`);

    if (op.status === 'COMPLETED' || op.status === 'REFUNDED') {
      return op;
    }

    const lockKey = `bridge_op_lock:${swapId}`;
    const ownerId = `br_${crypto.randomUUID()}`;
    const acquired = await GlobalSupplyCoordinator.acquireLeaseLock(lockKey, ownerId, 45_000).catch(
      () => false
    );
    if (!acquired) {
      return op;
    }

    try {
      const reloaded = await col.findOne({ swap_id: swapId });
      if (!reloaded || reloaded.status === 'COMPLETED' || reloaded.status === 'REFUNDED') {
        return reloaded || op;
      }

      const legs: SwapTransactionLeg[] = Array.isArray(reloaded.legs) ? [...reloaded.legs] : [];
      let current = await this.updateDoc(swapId, { status: 'EXECUTING', last_error: undefined });

      // STEP A: Destination Payout (skip cleanly if dest_tx_hash was already settled!)
      let destTxHash = sanitizeOnChainTxHash(current.dest_tx_hash) || '';
      let destExplorerUrl = current.dest_explorer_url || '';

      if (!destTxHash) {
        if (current.dest_chain === 'XRPL' && current.to_asset === 'XRP') {
          const payout = await CrossChainSwapService.payoutAssetToUser({
            toAsset: 'XRP',
            destinationAddress: current.destination_address,
            amount: current.to_amount,
            referenceId: current.swap_id,
          });

          if (!payout.ok || !payout.txHash) {
            return this.scheduleRetryOrFail(current, legs, payout.errorMessage || 'XRPL XRP payout failed');
          }
          destTxHash = payout.txHash;
          destExplorerUrl = payout.explorerUrl || buildExplorerTxUrl('XRPL', destTxHash) || '';
        } else if (current.dest_chain === 'XRPL' && current.to_asset === 'NXL') {
          const tl = await DualRailTokenService.checkXrplTrustline(current.destination_address, 'NXL');
          if (!tl.hasTrustline) {
            const msg = `XRPL NXL Trustline Missing for ${current.destination_address}`;
            const updated = await this.updateDoc(swapId, {
              status: 'AWAITING_TRUSTLINE',
              last_error: msg,
              legs,
            });
            await this.logChainSummary(updated);
            return updated;
          }

          const opCapId = `bridge_out_xrpl_${current.swap_id}`;
          await GlobalSupplyCoordinator.reserveMintCapacity({
            operationId: opCapId,
            chain: 'XRPL',
            amountNxl: current.to_amount,
            reason: 'bridge',
            recipientAddress: current.destination_address,
          });
          try {
            const mintRes = await DualRailTokenService.mintNxlOnXrpl({
              recipientAddress: current.destination_address,
              amountNxl: current.to_amount,
              orderId: current.swap_id,
              operatorId: current.user_id || 'BRIDGE_RELAYER',
              skipTrustlineCheck: true,
              memoTag: 'BRIDGE',
              referencePrefix: 'bridge',
            });
            await GlobalSupplyCoordinator.confirmMintCapacity(opCapId, mintRes.txHash, mintRes.ledgerSeq);
            destTxHash = mintRes.txHash;
            destExplorerUrl = mintRes.explorerUrl;
          } catch (mintErr: any) {
            await GlobalSupplyCoordinator.releaseMintCapacity(opCapId, mintErr?.message || 'XRPL bridge mint failed').catch(() => {});
            return this.scheduleRetryOrFail(current, legs, mintErr?.message || 'XRPL NXL bridge mint failed');
          }
        } else if (current.dest_chain === 'STELLAR' && current.to_asset === 'XLM') {
          const payout = await CrossChainSwapService.payoutAssetToUser({
            toAsset: 'XLM',
            destinationAddress: current.destination_address,
            amount: current.to_amount,
            referenceId: current.swap_id,
          });

          if (!payout.ok || !payout.txHash) {
            return this.scheduleRetryOrFail(current, legs, payout.errorMessage || 'Stellar XLM payout failed');
          }
          destTxHash = payout.txHash;
          destExplorerUrl = payout.explorerUrl || buildExplorerTxUrl('STELLAR', destTxHash) || '';
        } else if (current.dest_chain === 'STELLAR' && current.to_asset === 'NXL') {
          const tl = await DualRailTokenService.checkStellarTrustline(current.destination_address, 'NXL');
          if (!tl.hasTrustline) {
            const msg = `Stellar NXL Trustline Missing for ${current.destination_address}`;
            const updated = await this.updateDoc(swapId, {
              status: 'AWAITING_TRUSTLINE',
              last_error: msg,
              legs,
            });
            await this.logChainSummary(updated);
            return updated;
          }

          const opCapId = `bridge_in_stellar_${current.swap_id}`;
          await GlobalSupplyCoordinator.reserveMintCapacity({
            operationId: opCapId,
            chain: 'STELLAR',
            amountNxl: current.to_amount,
            reason: 'bridge',
            recipientAddress: current.destination_address,
          });
          try {
            const mintRes = await SorobanService.mintNxlOnChain({
              recipientAddress: current.destination_address,
              amountNxl: current.to_amount,
              reason: 'bridge',
              refId: `bridge:${current.swap_id}`,
              operatorId: current.user_id || 'BRIDGE_RELAYER',
            });
            await GlobalSupplyCoordinator.confirmMintCapacity(opCapId, mintRes.txHash, mintRes.ledger);
            destTxHash = mintRes.txHash;
            destExplorerUrl = mintRes.explorerUrl;
          } catch (mintErr: any) {
            await GlobalSupplyCoordinator.releaseMintCapacity(opCapId, mintErr?.message || 'Stellar bridge mint failed').catch(() => {});
            return this.scheduleRetryOrFail(current, legs, mintErr?.message || 'Stellar NXL bridge mint failed');
          }
        }

        legs.push({
          sequence: legs.length + 1,
          direction: 'OUTGOING',
          stage: 'ONCHAIN_PAYOUT',
          label:
            current.to_asset === 'NXL' && current.mechanism === 'BURN_AND_MINT'
              ? `Bridge Mint (${current.to_amount} NXL on ${current.dest_chain})`
              : `Server Payout (${current.to_amount} ${current.to_asset} on ${current.dest_chain})`,
          asset: current.to_asset,
          amount: current.to_amount,
          rail: current.dest_chain,
          status: 'SUCCESS',
          txHash: destTxHash,
          explorerUrl: destExplorerUrl,
          toAddress: current.destination_address,
          timestamp: new Date().toISOString(),
        });

        current = await this.updateDoc(swapId, {
          status: 'DEST_VERIFIED',
          dest_tx_hash: destTxHash,
          dest_explorer_url: destExplorerUrl,
          dest_verified_at: new Date().toISOString(),
          legs,
        });
      }

      // STEP B: If SOROBAN_ESCROW and not yet released on-chain, release escrow using destTxHash proof
      if (current.mechanism === 'SOROBAN_ESCROW' && !current.escrow_release_tx_hash) {
        try {
          const rel = await SorobanService.releaseBridgeEscrowOnChain({
            swapId: current.swap_id,
            xrplTxHash: destTxHash,
          });
          const relHash = sanitizeOnChainTxHash(rel?.txHash) || rel?.txHash;
          const relExplorer = buildExplorerTxUrl('STELLAR', relHash) || rel?.explorerUrl;

          legs.push({
            sequence: legs.length + 1,
            direction: 'OUTGOING',
            stage: 'ESCROW_RELEASE',
            label: 'Soroban Bridge Escrow Release (Stellar)',
            asset: current.from_asset,
            amount: current.from_amount,
            rail: 'STELLAR',
            status: 'SUCCESS',
            txHash: relHash,
            explorerUrl: relExplorer,
            timestamp: new Date().toISOString(),
          });

          current = await this.updateDoc(swapId, {
            status: 'COMPLETED',
            escrow_release_tx_hash: relHash,
            escrow_release_explorer_url: relExplorer || undefined,
            completed_at: new Date().toISOString(),
            legs,
          });
          await this.logChainSummary(current);
          return current;
        } catch (relErr: any) {
          // Payout succeeded (dest_tx_hash is persisted!), schedule retry strictly for ESCROW_RELEASE
          return this.scheduleRetryOrFail(current, legs, relErr?.message || 'Escrow release failed');
        }
      }

      current = await this.updateDoc(swapId, {
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        legs,
      });
      await this.logChainSummary(current);
      return current;
    } finally {
      await GlobalSupplyCoordinator.releaseLeaseLock(lockKey, ownerId);
    }
  }

  private static async scheduleRetryOrFail(
    op: MongoBridgeOperationDoc,
    legs: SwapTransactionLeg[],
    errMsg: string
  ): Promise<MongoBridgeOperationDoc> {
    const nextRetryCount = (op.retry_count || 0) + 1;
    const maxRetries = op.max_retries || this.MAX_RETRIES;
    const nowUnix = Math.floor(Date.now() / 1000);
    const escrowExpired =
      op.mechanism === 'SOROBAN_ESCROW' &&
      !op.dest_tx_hash &&
      op.escrow_expiry_unix_sec !== undefined &&
      nowUnix >= op.escrow_expiry_unix_sec;

    let status: BridgeOperationStatus;
    let nextRetryAt: string | undefined;

    if (escrowExpired) {
      status = 'REFUNDABLE';
    } else if (nextRetryCount < maxRetries) {
      status = 'RETRY_SCHEDULED';
      nextRetryAt = new Date(Date.now() + this.computeBackoffMs(nextRetryCount)).toISOString();
    } else {
      status = op.mechanism === 'SOROBAN_ESCROW' && !op.dest_tx_hash ? 'REFUNDABLE' : 'FAILED';
    }

    const updated = await this.updateDoc(op.swap_id, {
      status,
      retry_count: nextRetryCount,
      next_retry_at: nextRetryAt,
      last_error: errMsg,
      legs,
    });
    await this.logChainSummary(updated);
    return updated;
  }

  /**
   * Builds unsigned self-refund XDR after escrow expiry OR executes relayer/admin refund on-chain.
   */
  static async refundEscrow(params: {
    swapId: string;
    callerAddress?: string;
    executeRelayerRefund?: boolean;
  }): Promise<{
    mode: 'UNSIGNED_XDR' | 'REFUNDED_ONCHAIN';
    unsignedXdr?: string;
    txHash?: string;
    explorerUrl?: string;
    operation: MongoBridgeOperationDoc;
  }> {
    const col = await MongoService.getCollection<MongoBridgeOperationDoc>('bridge_operations');
    const op = await col.findOne({ swap_id: params.swapId });
    if (!op) throw new Error(`Bridge operation ${params.swapId} not found`);

    if (op.mechanism !== 'SOROBAN_ESCROW') {
      throw new Error('Only escrow-locked bridges (SOROBAN_ESCROW) support on-chain escrow refunds.');
    }
    if (op.status === 'REFUNDED') {
      return {
        mode: 'REFUNDED_ONCHAIN',
        txHash: op.escrow_refund_tx_hash,
        explorerUrl: op.escrow_refund_explorer_url,
        operation: op,
      };
    }
    if (op.dest_tx_hash || op.status === 'COMPLETED') {
      throw new Error('Cannot refund escrow after destination payout has already settled.');
    }

    if (params.executeRelayerRefund) {
      const rel = await SorobanService.refundBridgeEscrowOnChain({ swapId: op.swap_id });
      const refHash = sanitizeOnChainTxHash(rel.txHash) || rel.txHash;
      const refExplorer = buildExplorerTxUrl('STELLAR', refHash) || rel.explorerUrl;
      const legs: SwapTransactionLeg[] = [
        ...(op.legs || []),
        {
          sequence: (op.legs?.length || 0) + 1,
          direction: 'INCOMING',
          stage: 'ESCROW_REFUND',
          label: 'Soroban Bridge Escrow Refunded',
          asset: op.from_asset,
          amount: op.from_amount,
          rail: 'STELLAR',
          status: 'SUCCESS',
          txHash: refHash,
          explorerUrl: refExplorer,
          timestamp: new Date().toISOString(),
        },
      ];
      const updated = await this.updateDoc(op.swap_id, {
        status: 'REFUNDED',
        escrow_refund_tx_hash: refHash,
        escrow_refund_explorer_url: refExplorer,
        legs,
      });
      await this.logChainSummary(updated);
      return { mode: 'REFUNDED_ONCHAIN', txHash: refHash, explorerUrl: refExplorer, operation: updated };
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    if (op.escrow_expiry_unix_sec && nowUnix < op.escrow_expiry_unix_sec) {
      const waitSec = op.escrow_expiry_unix_sec - nowUnix;
      throw new Error(`Escrow 15-minute lock window has not expired yet (${waitSec}s remaining).`);
    }

    const caller = (params.callerAddress || op.source_address || '').trim();
    if (!StrKey.isValidEd25519PublicKey(caller)) {
      throw new Error('Valid Stellar callerAddress (G...) is required to build refund XDR');
    }

    const prep = await SorobanService.buildRefundExpiredEscrowXdr({
      callerAddress: caller,
      swapId: op.swap_id,
    });
    return {
      mode: 'UNSIGNED_XDR',
      unsignedXdr: prep.unsignedXdr,
      operation: op,
    };
  }

  static async getOperationStatus(swapId: string): Promise<{
    operation: MongoBridgeOperationDoc | null;
    onChainEscrow: any | null;
    isExpired: boolean;
    canSelfRefund: boolean;
  }> {
    const col = await MongoService.getCollection<MongoBridgeOperationDoc>('bridge_operations');
    const op = await col.findOne({ swap_id: swapId });
    let onChainEscrow: any = null;
    if (!op || op.mechanism === 'SOROBAN_ESCROW') {
      try {
        onChainEscrow = await SorobanService.getOnChainEscrow(swapId);
      } catch {}
    }

    const expiry = op?.escrow_expiry_unix_sec || Number(onChainEscrow?.expiry_timestamp || 0);
    const nowUnix = Math.floor(Date.now() / 1000);
    const isExpired = expiry > 0 && nowUnix >= expiry;
    const canSelfRefund = Boolean(
      isExpired &&
        op?.mechanism === 'SOROBAN_ESCROW' &&
        !op?.dest_tx_hash &&
        op?.status !== 'COMPLETED' &&
        op?.status !== 'REFUNDED'
    );

    return { operation: op, onChainEscrow, isExpired, canSelfRefund };
  }

  static async listOperations(params: {
    status?: string;
    direction?: string;
    limit?: number;
  } = {}): Promise<{
    operations: MongoBridgeOperationDoc[];
    summary: {
      total: number;
      completed: number;
      retrying: number;
      awaitingTrustline: number;
      refundable: number;
      failed: number;
      xlmEscrowVolume: number;
      nxlBridgeVolume: number;
    };
  }> {
    const col = await MongoService.getCollection<MongoBridgeOperationDoc>('bridge_operations');
    const filter: any = {};
    if (params.status) filter.status = params.status;
    if (params.direction) filter.direction = params.direction;

    const [operations, all] = await Promise.all([
      col
        .find(filter)
        .sort({ created_at: -1 })
        .limit(Math.min(Math.max(params.limit || 50, 1), 200))
        .toArray(),
      col.find({}).toArray(),
    ]);

    const summary = {
      total: all.length,
      completed: all.filter((o) => o.status === 'COMPLETED').length,
      retrying: all.filter((o) => o.status === 'RETRY_SCHEDULED' || o.status === 'DEST_VERIFIED').length,
      awaitingTrustline: all.filter((o) => o.status === 'AWAITING_TRUSTLINE').length,
      refundable: all.filter((o) => o.status === 'REFUNDABLE').length,
      failed: all.filter((o) => o.status === 'FAILED').length,
      xlmEscrowVolume: Number(
        all
          .filter((o) => o.from_asset === 'XLM' && o.mechanism === 'SOROBAN_ESCROW')
          .reduce((sum, o) => sum + (o.from_amount || 0), 0)
          .toFixed(6)
      ),
      nxlBridgeVolume: Number(
        all
          .filter((o) => o.from_asset === 'NXL' || o.to_asset === 'NXL')
          .reduce((sum, o) => sum + (o.from_amount || 0), 0)
          .toFixed(6)
      ),
    };

    return { operations, summary };
  }
}
