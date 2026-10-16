import { Client } from 'xrpl';
import { requiredEnv } from '../config/env.js';

export class XRPLService {
  static async createPaymentInvoice(orderId: string, amountXrp: number) {
    const address = requiredEnv('XRPL_MERCHANT_ADDRESS');
    const client = new Client(requiredEnv('XRPL_WSS'));
    await client.connect();
    try {
      const response = await client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated',
      });
      const account = response.result.account_data.Account;
      const sequence = response.result.account_data.Sequence;
      const balanceDrops = response.result.account_data.Balance;
      return {
        orderId,
        xrplAddress: account,
        sequence,
        balanceDrops,
        amountXrp,
        amountDrops: String(Math.round(amountXrp * 1_000_000)),
        network: requiredEnv('XRPL_WSS'),
      };
    } finally {
      await client.disconnect();
    }
  }
}
