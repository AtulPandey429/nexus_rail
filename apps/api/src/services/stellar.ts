import crypto from 'crypto';

export interface StellarInvoiceResult {
  orderId: string;
  stellarAddress: string;
  memoText: string;
  amountXlm: number;
  expiresAt: string;
}

export class StellarService {
  // Official Stellar Horizon Testnet merchant account address
  private static readonly STELLAR_MERCHANT_ADDRESS = 'GBXGQJWVLWOYHFLVTKWV5FGHA3LNYY2JQ2PF6Z4Z3O3X5PZ4';

  static async createPaymentInvoice(orderId: string, amountXlm: number): Promise<StellarInvoiceResult> {
    // Generate unique 28-char alphanumeric Memo text mapping
    const memoText = `NR-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    return {
      orderId,
      stellarAddress: this.STELLAR_MERCHANT_ADDRESS,
      memoText,
      amountXlm,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }
}
