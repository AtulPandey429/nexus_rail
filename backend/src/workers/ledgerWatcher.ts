import crypto from 'crypto';
import { stellarProvider, stellarUsdcProvider, xrplProvider } from '../services/crypto/index.js';
import { MongoService, MongoOrderDoc } from '../services/mongo.js';
import { settlementEmitter } from '../services/settlementEvents.js';

export class LedgerWatcherWorker {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;

  /**
   * Reconciles all pending Stellar and XRPL orders against active on-chain ledger records
   */
  static async reconcilePendingOrders(): Promise<{ reconciledCount: number }> {
    let reconciledCount = 0;

    try {
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const pendingCryptoOrders = await ordersCol
        .find({
          status: 'PENDING',
          payment_rail: { $in: ['XLM', 'XRP', 'STELLAR', 'XRPL', 'STELLAR_USDC', 'USDC'] },
        })
        .limit(10)
        .toArray();

      if (pendingCryptoOrders.length === 0) {
        return { reconciledCount: 0 };
      }

      console.log(`🔍 [LedgerWatcherWorker] Scanning on-chain ledgers for ${pendingCryptoOrders.length} pending orders...`);

      for (const order of pendingCryptoOrders) {
        try {
          const isStellarUsdc = order.payment_rail === 'STELLAR_USDC' || order.payment_rail === 'USDC';
          const isStellar = order.payment_rail === 'STELLAR' || order.payment_rail === 'XLM' || isStellarUsdc;
          const isXrpl = order.payment_rail === 'XRPL' || order.payment_rail === 'XRP';

          if (isStellar) {
            const provider = isStellarUsdc ? stellarUsdcProvider : stellarProvider;
            const assetSymbol = isStellarUsdc ? 'USDC' : 'XLM';

            // Authoritative HMAC memo derivation
            const expectedMemo =
              order.payment_memo ||
              (`NR${crypto.createHmac('sha256', 'nexus_rail_settlement_v1_memo').update(order.id).digest('hex')}`)
                .slice(0, 28)
                .toUpperCase();

            let txHash = order.tx_hash;
            if (!txHash) {
              const foundHash = await provider.findRecentPaymentByMemo(expectedMemo);
              if (foundHash) txHash = foundHash;
            }

            if (txHash) {
              const verification = await provider.verifyPayment(order.id, txHash);
              if (verification.verified) {
                await ordersCol.updateOne(
                  { id: order.id, status: 'PENDING' },
                  {
                    $set: {
                      status: 'PAID',
                      tx_hash: txHash,
                      payment_rail: assetSymbol,
                      payment_memo: expectedMemo,
                      updated_at: new Date().toISOString(),
                    },
                  }
                );
                reconciledCount++;
                console.log(`✅ [LedgerWatcher] Stellar ${assetSymbol} Order ${order.order_number || order.id} reconciled on-chain! Tx: ${txHash}`);
                settlementEmitter.emitSettlement({
                  orderId: order.id,
                  orderNumber: order.order_number,
                  status: 'PAID',
                  paymentRail: assetSymbol,
                  txHash,
                  timestamp: new Date().toISOString(),
                });
              }
            }
          } else if (isXrpl) {
            // Authoritative DestinationTag derivation
            let expectedTag = order.payment_memo ? Number(order.payment_memo) : 0;
            if (!expectedTag || isNaN(expectedTag)) {
              const tagDigest = crypto.createHmac('sha256', 'nexus_rail_settlement_v1_tag').update(order.id).digest();
              expectedTag = (tagDigest.readUInt32BE(0) % 2_000_000_000) + 100_000;
            }

            let txHash = order.tx_hash;
            if (!txHash) {
              const foundHash = await xrplProvider.findRecentPaymentByDestinationTag(expectedTag);
              if (foundHash) txHash = foundHash;
            }

            if (txHash) {
              const verification = await xrplProvider.verifyPayment(order.id, txHash);
              if (verification.verified) {
                await ordersCol.updateOne(
                  { id: order.id, status: 'PENDING' },
                  {
                    $set: {
                      status: 'PAID',
                      tx_hash: txHash,
                      payment_rail: 'XRP',
                      payment_memo: String(expectedTag),
                      updated_at: new Date().toISOString(),
                    },
                  }
                );
                reconciledCount++;
                console.log(`✅ [LedgerWatcher] XRPL Order ${order.order_number || order.id} reconciled on-chain! Tx: ${txHash}`);
                settlementEmitter.emitSettlement({
                  orderId: order.id,
                  orderNumber: order.order_number,
                  status: 'PAID',
                  paymentRail: 'XRP',
                  txHash,
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }
        } catch (orderErr: any) {
          console.warn(`⚠️ [LedgerWatcher] Error inspecting order ${order.id}:`, orderErr.message);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [LedgerWatcherWorker Poll Warning]:', err.message);
    }

    return { reconciledCount };
  }

  static startWatchers(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('📡 [LedgerWatcherWorker] Multi-Chain Active Reconciler Started (Stellar + XRPL 20s tick)');

    // Execute an initial reconcile tick on startup
    this.reconcilePendingOrders().catch(() => {});

    // Periodic active watcher loop
    this.intervalId = setInterval(async () => {
      await this.reconcilePendingOrders();
    }, 20000);
  }

  static stopWatchers(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 [LedgerWatcherWorker] Stopped ledger watchers.');
  }
}
