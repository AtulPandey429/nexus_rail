import { MongoService, MongoOrderDoc } from './mongo.js';
import { walletService } from './wallet.js';
import { NrTokenService, NR_MICRO_SCALE } from './nrTokenService.js';
import { CrossChainSwapService } from './crossChainSwapService.js';
import { PortfolioService } from './portfolioService.js';
import { settlementEmitter } from './settlementEvents.js';

export type UnderpaidResolutionMode =
  | 'TOPUP_USD'
  | 'TOPUP_NXL'
  | 'REFUND_ONCHAIN'
  | 'REFUND_WALLET';

export interface ResolveUnderpaidResult {
  orderId: string;
  orderNumber: string;
  orderStatus: 'PAID' | 'REFUNDED';
  mode: UnderpaidResolutionMode;
  message: string;
  shortfallPaidCents?: number;
  shortfallPaidNxl?: number;
  refundedCents?: number;
  refundTxHash?: string;
  refundExplorerUrl?: string;
}

/**
 * Resolves a slippage-quarantined UNDERPAID order cleanly and idempotently.
 * Supports paying the remaining shortfall (USD / $NXL) or claiming an instant refund.
 */
export async function resolveUnderpaidOrder(params: {
  orderId: string;
  userId: string;
  mode: UnderpaidResolutionMode;
  isAdmin?: boolean;
}): Promise<ResolveUnderpaidResult> {
  const { orderId, userId, mode, isAdmin = false } = params;
  const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');

  const query: any = { $or: [{ id: orderId }, { order_number: orderId }] };
  if (!isAdmin) {
    query.user_id = userId;
  }

  const order = await ordersCol.findOne(query);
  if (!order) {
    throw new Error('Order not found.');
  }

  if (order.status !== 'UNDERPAID') {
    throw new Error(
      order.status === 'PAID'
        ? 'This order is already paid.'
        : order.status === 'REFUNDED'
        ? 'This order has already been refunded.'
        : `Order cannot be resolved from status "${order.status}".`
    );
  }

  const shortfallCents = Math.max(0, Number(order.underpaid_cents || 0));
  const now = new Date().toISOString();

  // ---------------------------------------------------------------------------
  // MODE A: Pay Remaining Shortfall (USD or $NXL Balance)
  // ---------------------------------------------------------------------------
  if (mode === 'TOPUP_USD' || mode === 'TOPUP_NXL') {
    const ownerUserId = order.user_id;
    let shortfallPaidNxl: number | undefined;
    const topupRef = `topup:${order.order_number}:${mode.toLowerCase()}`;

    if (shortfallCents > 0) {
      if (mode === 'TOPUP_USD') {
        await walletService.debitBalance(ownerUserId, shortfallCents, 'USD', topupRef);
      } else {
        const poolStats = await NrTokenService.getPoolStats();
        const spotCents = Math.max(1, poolStats.spotPriceCents);
        const nxlNeededMicro = Math.ceil((shortfallCents / spotCents) * NR_MICRO_SCALE);
        await walletService.debitBalance(ownerUserId, nxlNeededMicro, 'NXL', topupRef);
        shortfallPaidNxl = Number((nxlNeededMicro / NR_MICRO_SCALE).toFixed(4));
      }
    }

    // Atomic transition UNDERPAID -> PAID (prevents race conditions)
    const updated = await ordersCol.findOneAndUpdate(
      { id: order.id, status: 'UNDERPAID' },
      {
        $set: {
          status: 'PAID',
          underpaid_cents: 0,
          topup_reference: topupRef,
          updated_at: now,
        },
      },
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw new Error('Order was already updated by another request.');
    }

    settlementEmitter.emitSettlement({
      orderId: order.id,
      orderNumber: order.order_number,
      status: 'PAID',
      paymentRail: order.payment_rail,
      txHash: order.tx_hash || topupRef,
      timestamp: now,
    });

    await PortfolioService.creditOrderAllocations(updated).catch(() => {});

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      orderStatus: 'PAID',
      mode,
      shortfallPaidCents: shortfallCents,
      shortfallPaidNxl,
      message:
        mode === 'TOPUP_USD'
          ? `Remaining $${(shortfallCents / 100).toFixed(2)} paid from USD balance. Your order is now confirmed.`
          : `Remaining ${shortfallPaidNxl ?? 0} $NXL paid from your balance. Your order is now confirmed.`,
    };
  }

  // ---------------------------------------------------------------------------
  // MODE B: Claim Instant Refund (On-Chain Payout or USD Wallet Credit)
  // ---------------------------------------------------------------------------
  const paidUsdCents = Math.max(0, order.total_cents - shortfallCents);

  // Atomically claim the UNDERPAID -> REFUNDED lock before sending funds
  const lockedOrder = await ordersCol.findOneAndUpdate(
    { id: order.id, status: 'UNDERPAID' },
    { $set: { status: 'REFUNDED', updated_at: now } },
    { returnDocument: 'after' }
  );

  if (!lockedOrder) {
    throw new Error('This order has already been resolved or refunded.');
  }

  let refundTxHash = `wallet_refund_${order.order_number}`;
  let refundExplorerUrl: string | undefined;
  let finalMode: UnderpaidResolutionMode = mode;

  try {
    const rail = String(order.payment_rail || '').toUpperCase();
    const canRefundOnChain =
      mode === 'REFUND_ONCHAIN' &&
      Boolean(order.sender_wallet_address) &&
      Number(order.delivered_crypto_amount || 0) > 0 &&
      (rail === 'XLM' || rail === 'XRP' || rail.includes('STELLAR') || rail.includes('XRPL'));

    if (canRefundOnChain) {
      const toAsset: 'XLM' | 'XRP' = rail === 'XLM' || rail.includes('STELLAR') ? 'XLM' : 'XRP';
      const payout = await CrossChainSwapService.payoutAssetToUser({
        toAsset,
        destinationAddress: order.sender_wallet_address!,
        amount: Number(order.delivered_crypto_amount),
        referenceId: `REFUND-${order.order_number}`,
      });
      refundTxHash = payout.txHash;
      refundExplorerUrl = payout.explorerUrl;
    } else {
      finalMode = 'REFUND_WALLET';
      if (paidUsdCents > 0) {
        await walletService.creditBalance(
          order.user_id,
          paidUsdCents,
          'USD',
          `refund:${order.order_number}`
        );
      }
    }

    await ordersCol.updateOne(
      { id: order.id },
      { $set: { refund_tx_hash: refundTxHash, updated_at: new Date().toISOString() } }
    );
  } catch (err: any) {
    // Rollback status to UNDERPAID if payout failed so user can retry
    await ordersCol.updateOne(
      { id: order.id },
      { $set: { status: 'UNDERPAID', updated_at: new Date().toISOString() } }
    );
    throw new Error(err?.message || 'Refund could not be completed. Please try again.');
  }

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    orderStatus: 'REFUNDED',
    mode: finalMode,
    refundedCents: paidUsdCents,
    refundTxHash,
    refundExplorerUrl,
    message:
      finalMode === 'REFUND_ONCHAIN'
        ? `Crypto refund sent back to your wallet (${refundTxHash.slice(0, 10)}...).`
        : `$${(paidUsdCents / 100).toFixed(2)} refunded directly to your NexusRail USD balance.`,
  };
}
