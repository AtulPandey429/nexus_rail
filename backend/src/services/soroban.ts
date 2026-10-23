import { Horizon } from '@stellar/stellar-sdk';
import { env } from '../config/env.js';

export class SorobanService {
  static async getContractExecutionStatus(txHash: string) {
    const horizonUrl = env.HORIZON_URL || env.STELLAR_HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org';
    const server = new Horizon.Server(horizonUrl);
    const tx = await server.transactions().transaction(txHash).call();
    return {
      txHash: tx.hash,
      status: tx.successful ? 'SUCCESS' : 'FAILED',
      ledgerSeq: tx.ledger_attr,
      sourceAccount: tx.source_account,
    };
  }
}
