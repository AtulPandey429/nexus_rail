import crypto from 'crypto';
import { StrKey } from '@stellar/stellar-sdk';
import { isValidClassicAddress } from 'xrpl';
import {
  MongoService,
  MongoOrderDoc,
  MongoUserDoc,
  MongoCashbackIssuanceDoc,
} from './mongo.js';
import { CouponService } from './coupon.service.js';
import { DualRailTokenService, STELLAR_NR_ISSUER } from './dualRailToken.service.js';
import { SorobanService } from './soroban.js';
import {
  GlobalSupplyCoordinator,
  GlobalSupplyCapExceededError,
} from './globalSupplyCoordinator.service.js';
import { env } from '../config/env.js';

export interface IssueCashbackOptions {
  targetChain?: 'STELLAR' | 'XRPL';
  recipientAddress?: string;
}

export class CashbackMintService {
  private static readonly MAX_RETRIES = 5;

  private static computeBackoffMs(retryCount: number): number {
    // Exponential backoff: 15s, 30s, 60s, 120s, 240s
    return Math.min(300_000, 15_000 * Math.pow(2, Math.max(0, retryCount - 1)));
  }

  private static resolveWalletTarget(
    user: MongoUserDoc | null,
    options?: IssueCashbackOptions
  ): { chain: 'STELLAR' | 'XRPL' | 'UNSELECTED'; address: string } {
    const explicitAddr = (options?.recipientAddress || '').trim();
    if (explicitAddr) {
      if (options?.targetChain === 'STELLAR' || StrKey.isValidEd25519PublicKey(explicitAddr)) {
        if (!StrKey.isValidEd25519PublicKey(explicitAddr)) {
          throw new Error(`Invalid Stellar recipient address "${explicitAddr}"`);
        }
        return { chain: 'STELLAR', address: explicitAddr };
      }
      if (options?.targetChain === 'XRPL' || isValidClassicAddress(explicitAddr)) {
        if (!isValidClassicAddress(explicitAddr)) {
          throw new Error(`Invalid XRPL recipient address "${explicitAddr}"`);
        }
        return { chain: 'XRPL', address: explicitAddr };
      }
      throw new Error(`Unsupported cashback recipient address "${explicitAddr}"`);
    }

    if (user?.lastConnectedWallet?.address) {
      const addr = user.lastConnectedWallet.address.trim();
      if (user.lastConnectedWallet.network === 'stellar' && StrKey.isValidEd25519PublicKey(addr)) {
        return { chain: 'STELLAR', address: addr };
      }
      if (user.lastConnectedWallet.network === 'xrpl' && isValidClassicAddress(addr)) {
        return { chain: 'XRPL', address: addr };
      }
    }

    if (options?.targetChain === 'STELLAR' && user?.stellarAddress && StrKey.isValidEd25519PublicKey(user.stellarAddress)) {
      return { chain: 'STELLAR', address: user.stellarAddress };
    }
    if (options?.targetChain === 'XRPL' && user?.xrplAddress && isValidClassicAddress(user.xrplAddress)) {
      return { chain: 'XRPL', address: user.xrplAddress };
    }

    if (user?.stellarAddress && StrKey.isValidEd25519PublicKey(user.stellarAddress)) {
      return { chain: 'STELLAR', address: user.stellarAddress };
    }
    if (user?.xrplAddress && isValidClassicAddress(user.xrplAddress)) {
      return { chain: 'XRPL', address: user.xrplAddress };
    }
    if (user?.walletAddress) {
      if (StrKey.isValidEd25519PublicKey(user.walletAddress)) {
        return { chain: 'STELLAR', address: user.walletAddress };
      }
      if (isValidClassicAddress(user.walletAddress)) {
        return { chain: 'XRPL', address: user.walletAddress };
      }
    }

    return { chain: 'UNSELECTED', address: '' };
  }

  /**
   * Issues direct 1:1 on-chain $NXL cashback on the user's selected chain (Stellar SAC or XRPL Issuer).
   * Strictly idempotent per order_id and gated by Unified Global Supply Coordinator (2M global cap).
   */
  static async issueOrderCashback(
    order: MongoOrderDoc,
    options?: IssueCashbackOptions
  ): Promise<MongoCashbackIssuanceDoc> {
    if (!order?.id || !order.user_id || !order.total_cents || order.total_cents <= 0) {
      throw new Error('Valid paid order with positive total_cents is required for cashback issuance');
    }

    const col = await MongoService.getCollection<MongoCashbackIssuanceDoc>('cashback_issuances');
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const usersCol = await MongoService.getCollection<MongoUserDoc>('users');

    // 1. Check existing issuance record (strict 1-per-order idempotency)
    let record: MongoCashbackIssuanceDoc | null = await col.findOne({ order_id: order.id });
    if (record && (record.status === 'COMPLETED' || record.status === 'MINTING' || record.status === 'VERIFYING')) {
      return record;
    }

    const user = await usersCol.findOne({ id: order.user_id }).catch(() => null);
    const target = this.resolveWalletTarget(user, options);

    const { cashbackUsdCents, cashbackNxl, spotPriceCents } =
      await CouponService.estimateCashback(order.total_cents);
    if (cashbackUsdCents <= 0 || cashbackNxl <= 0) {
      throw new Error('Computed cashback amount is zero');
    }

    const now = new Date().toISOString();
    const operationId = `cashback:${order.id}`;

    // 2. Atomically create or claim the durable issuance record (prevents concurrent double-minting)
    if (!record) {
      const initialDoc: MongoCashbackIssuanceDoc = {
        id: `cb_${crypto.randomUUID()}`,
        order_id: order.id,
        order_number: order.order_number || order.id,
        user_id: order.user_id,
        target_chain: target.chain,
        recipient_address: target.address,
        cashback_usd_cents: cashbackUsdCents,
        cashback_nxl: cashbackNxl, // Strict 1:1 amount regardless of Stellar or XRPL
        spot_price_cents: spotPriceCents,
        status: 'PENDING',
        retry_count: 0,
        max_retries: this.MAX_RETRIES,
        created_at: now,
        updated_at: now,
      };
      try {
        await col.insertOne(initialDoc);
        record = initialDoc;
      } catch (err: any) {
        if (err?.code === 11000) {
          const existing = await col.findOne({ order_id: order.id });
          if (existing) return existing;
        }
        throw err;
      }
    } else {
      // Atomic state lock: only transition from claimable/retryable states
      const claimedRes: any = await col.findOneAndUpdate(
        {
          order_id: order.id,
          status: { $in: ['PENDING', 'AWAITING_WALLET', 'AWAITING_TRUSTLINE', 'RETRY_SCHEDULED'] },
        },
        {
          $set: {
            target_chain: target.chain,
            recipient_address: target.address,
            status: 'PENDING',
            updated_at: now,
          },
        },
        { returnDocument: 'after' }
      );
      const claimed = claimedRes?.value || claimedRes;
      if (!claimed) {
        return (await col.findOne({ order_id: order.id }))!;
      }
      record = claimed;
    }

    if (!record) {
      throw new Error(`Failed to initialize cashback issuance record for order ${order.id}`);
    }
    const activeRecord: MongoCashbackIssuanceDoc = record;

    // 3. If user has not selected a Stellar or XRPL wallet yet -> park cleanly in AWAITING_WALLET
    if (target.chain === 'UNSELECTED' || !target.address) {
      await col.updateOne(
        { order_id: order.id },
        {
          $set: {
            status: 'AWAITING_WALLET',
            last_error: 'Connect a Stellar or XRPL wallet to mint your 1:1 on-chain $NXL cashback.',
            updated_at: new Date().toISOString(),
          },
        }
      );
      await ordersCol.updateOne(
        { id: order.id },
        {
          $set: {
            cashback_usd_cents: activeRecord.cashback_usd_cents,
            cashback_nxl_amount: activeRecord.cashback_nxl,
            cashback_status: 'AWAITING_WALLET',
            updated_at: new Date().toISOString(),
          },
        }
      );
      return (await col.findOne({ order_id: order.id }))!;
    }

    // 4. Verify recipient trustline on target chain BEFORE reserving cap or minting
    if (target.chain === 'STELLAR') {
      const tl = await DualRailTokenService.checkStellarTrustline(target.address, 'NXL');
      if (!tl.hasTrustline) {
        const msg = `Stellar Trustline Missing: Account "${target.address}" must add a trustline to issuer "${tl.issuer || STELLAR_NR_ISSUER}" for asset "NXL" before receiving on-chain cashback.`;
        await col.updateOne(
          { order_id: order.id },
          {
            $set: {
              status: 'AWAITING_TRUSTLINE',
              issuer_address: tl.issuer || STELLAR_NR_ISSUER,
              last_error: msg,
              updated_at: new Date().toISOString(),
            },
          }
        );
        await ordersCol.updateOne(
          { id: order.id },
          { $set: { cashback_status: 'AWAITING_TRUSTLINE', cashback_chain: 'STELLAR', updated_at: new Date().toISOString() } }
        );
        return (await col.findOne({ order_id: order.id }))!;
      }
    } else {
      const tl = await DualRailTokenService.checkXrplTrustline(target.address, 'NXL');
      if (!tl.hasTrustline) {
        const xrplIssuer = tl.issuer || env.XRPL_NR_ISSUER_ADDRESS;
        const msg = `XRPL Trustline Missing: Account "${target.address}" must establish a TrustSet to issuer "${xrplIssuer}" for currency "NXL" before receiving on-chain cashback.`;
        await col.updateOne(
          { order_id: order.id },
          {
            $set: {
              status: 'AWAITING_TRUSTLINE',
              issuer_address: xrplIssuer,
              last_error: msg,
              updated_at: new Date().toISOString(),
            },
          }
        );
        await ordersCol.updateOne(
          { id: order.id },
          { $set: { cashback_status: 'AWAITING_TRUSTLINE', cashback_chain: 'XRPL', updated_at: new Date().toISOString() } }
        );
        return (await col.findOne({ order_id: order.id }))!;
      }
    }

    // 5. Reserve unified global supply capacity (Stellar + XRPL <= 2,000,000 NXL)
    try {
      await GlobalSupplyCoordinator.reserveMintCapacity({
        operationId,
        chain: target.chain,
        amountNxl: activeRecord.cashback_nxl,
        reason: 'cashback',
        recipientAddress: target.address,
      });
    } catch (capErr: any) {
      const isCapExceeded = capErr instanceof GlobalSupplyCapExceededError;
      await col.updateOne(
        { order_id: order.id },
        {
          $set: {
            status: isCapExceeded ? 'FAILED' : 'RETRY_SCHEDULED',
            last_error: capErr?.message || 'Global supply cap reservation failed',
            next_retry_at: isCapExceeded
              ? undefined
              : new Date(Date.now() + this.computeBackoffMs((activeRecord.retry_count || 0) + 1)).toISOString(),
            updated_at: new Date().toISOString(),
          },
          $inc: { retry_count: 1 },
        }
      );
      if (isCapExceeded) throw capErr;
      return (await col.findOne({ order_id: order.id }))!;
    }

    await col.updateOne(
      { order_id: order.id },
      {
        $set: {
          status: 'MINTING',
          reservation_id: operationId,
          updated_at: new Date().toISOString(),
        },
      }
    );

    // 6. Execute Chain-Specific Direct On-Chain Mint (1:1 NXL)
    try {
      let txHash: string;
      let ledgerSeq: number | undefined;
      let explorerUrl: string;
      let issuerAddress: string;

      if (target.chain === 'STELLAR') {
        const mintRes = await SorobanService.mintNxlOnChain({
          recipientAddress: target.address,
          amountNxl: activeRecord.cashback_nxl,
          reason: 'cashback',
          refId: operationId,
          operatorId: 'CASHBACK_MINTER',
        });
        if (mintRes.status !== 'SUCCESS' || !mintRes.txHash) {
          throw new Error('Soroban mint_nxl did not achieve confirmed SUCCESS finality');
        }
        txHash = mintRes.txHash;
        ledgerSeq = mintRes.ledger;
        explorerUrl = mintRes.explorerUrl;
        issuerAddress = STELLAR_NR_ISSUER;
      } else {
        const xrplRes = await DualRailTokenService.mintNxlOnXrpl({
          recipientAddress: target.address,
          amountNxl: activeRecord.cashback_nxl,
          orderId: order.id,
          operatorId: 'CASHBACK_MINTER',
          skipTrustlineCheck: true,
        });
        txHash = xrplRes.txHash;
        ledgerSeq = xrplRes.ledgerSeq;
        explorerUrl = xrplRes.explorerUrl;
        issuerAddress = xrplRes.issuerAddress;
      }

      // 7. Mark VERIFYING -> Confirm Global Supply Reservation -> Mark COMPLETED
      await col.updateOne(
        { order_id: order.id },
        { $set: { status: 'VERIFYING', tx_hash: txHash, ledger_seq: ledgerSeq, updated_at: new Date().toISOString() } }
      );

      await GlobalSupplyCoordinator.confirmMintCapacity(operationId, txHash, ledgerSeq);

      const completedAt = new Date().toISOString();
      await col.updateOne(
        { order_id: order.id },
        {
          $set: {
            status: 'COMPLETED',
            tx_hash: txHash,
            ledger_seq: ledgerSeq,
            explorer_url: explorerUrl,
            issuer_address: issuerAddress,
            last_error: undefined,
            next_retry_at: undefined,
            completed_at: completedAt,
            updated_at: completedAt,
          },
        }
      );

      await ordersCol.updateOne(
        { id: order.id },
        {
          $set: {
            cashback_credited: true,
            cashback_usd_cents: activeRecord.cashback_usd_cents,
            cashback_nxl_amount: activeRecord.cashback_nxl,
            cashback_chain: target.chain,
            cashback_tx_hash: txHash,
            cashback_status: 'COMPLETED',
            updated_at: completedAt,
          },
        }
      );

      return (await col.findOne({ order_id: order.id }))!;
    } catch (mintErr: any) {
      await GlobalSupplyCoordinator.releaseMintCapacity(
        operationId,
        mintErr?.message || 'On-chain mint execution failed'
      );

      const nextRetryCount = (activeRecord.retry_count || 0) + 1;
      const exhausted = nextRetryCount >= (activeRecord.max_retries || this.MAX_RETRIES);
      const nextStatus = exhausted ? 'FAILED' : 'RETRY_SCHEDULED';
      const nextRetryAt = exhausted
        ? undefined
        : new Date(Date.now() + this.computeBackoffMs(nextRetryCount)).toISOString();

      await col.updateOne(
        { order_id: order.id },
        {
          $set: {
            status: nextStatus,
            retry_count: nextRetryCount,
            next_retry_at: nextRetryAt,
            last_error: mintErr?.message || 'On-chain cashback mint failed',
            updated_at: new Date().toISOString(),
          },
        }
      );
      await ordersCol.updateOne(
        { id: order.id },
        { $set: { cashback_status: nextStatus, updated_at: new Date().toISOString() } }
      );

      return (await col.findOne({ order_id: order.id }))!;
    }
  }

  /**
   * User-initiated claim for orders parked in AWAITING_WALLET, AWAITING_TRUSTLINE, or RETRY_SCHEDULED.
   */
  static async claimOrderCashback(params: {
    userId: string;
    orderId: string;
    targetChain: 'STELLAR' | 'XRPL';
    recipientAddress: string;
  }): Promise<MongoCashbackIssuanceDoc> {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const order = await ordersCol.findOne({
      $or: [{ id: params.orderId }, { order_number: params.orderId }],
      user_id: params.userId,
    });
    if (!order) {
      throw new Error('Order not found');
    }
    if (!['PAID', 'FULFILLING', 'FULFILLED'].includes(order.status)) {
      throw new Error(`Cashback can only be claimed on paid orders (current status: ${order.status})`);
    }

    return this.issueOrderCashback(order, {
      targetChain: params.targetChain,
      recipientAddress: params.recipientAddress,
    });
  }

  static async getOrderCashbackStatus(
    userId: string,
    orderId: string
  ): Promise<MongoCashbackIssuanceDoc | null> {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const order = await ordersCol.findOne({
      $or: [{ id: orderId }, { order_number: orderId }],
      user_id: userId,
    });
    if (!order) return null;

    const col = await MongoService.getCollection<MongoCashbackIssuanceDoc>('cashback_issuances');
    return col.findOne({ order_id: order.id });
  }
}
