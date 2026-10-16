import { Horizon } from '@stellar/stellar-sdk';
import { requiredEnv } from '../config/env.js';

function server() {
  return new Horizon.Server(requiredEnv('HORIZON_URL'));
}

export class StellarService {
  static async createPaymentInvoice(orderId: string, amountXlm: number) {
    const address = requiredEnv('STELLAR_MERCHANT_PUBLIC_KEY');
    const account = await server().loadAccount(address);
    return {
      orderId,
      stellarAddress: account.accountId(),
      sequence: account.sequenceNumber(),
      amountXlm,
      memoText: orderId.replace(/-/g, '').slice(0, 28),
      network: requiredEnv('HORIZON_URL'),
    };
  }

  static async getTransaction(txHash: string) {
    const tx = await server().transactions().transaction(txHash).call();
    return {
      txHash: tx.hash,
      successful: tx.successful,
      ledger: tx.ledger_attr,
      source: tx.source_account,
    };
  }
}
