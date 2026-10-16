import { StellarService } from './stellar.js';

export class SorobanService {
  static async getContractExecutionStatus(txHash: string) {
    const tx = await StellarService.getTransaction(txHash);
    return {
      txHash: tx.txHash,
      status: tx.successful ? 'SUCCESS' : 'FAILED',
      ledgerSeq: tx.ledger,
      sourceAccount: tx.source,
    };
  }
}
