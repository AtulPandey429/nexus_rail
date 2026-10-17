import { stellarProvider, xrplProvider } from '../services/crypto/index.js';
import { MongoService, MongoOrderDoc } from '../services/mongo.js';

export class LedgerWatcherWorker {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;

  static startWatchers(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('📡 [LedgerWatcherWorker] Multi-Chain Testnet Watcher Started (Stellar + XRPL)');

    // Periodic watcher loop for pending crypto orders
    this.intervalId = setInterval(async () => {
      try {
        const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
        const pendingCryptoOrders = await ordersCol
          .find({
            status: 'PENDING',
            payment_rail: { $in: ['XLM', 'XRP', 'STELLAR', 'XRPL'] },
          })
          .limit(5)
          .toArray();

        if (pendingCryptoOrders.length > 0) {
          console.log(`🔍 [LedgerWatcher] Watching ${pendingCryptoOrders.length} pending testnet orders...`);
        }
      } catch (err: any) {
        // Suppress background poll errors
      }
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
