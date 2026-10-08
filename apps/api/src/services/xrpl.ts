export interface XRPLInvoiceResult {
  orderId: string;
  xrplAddress: string;
  destinationTag: number;
  amountXrp: number;
  amountDrops: string;
  expiresAt: string;
}

export class XRPLService {
  // Official XRPL Testnet destination account address
  private static readonly XRPL_DESTINATION_ADDRESS = 'rPT1Sjh2peUzB4MwxyujwM7w6n54e365ge';

  static async createPaymentInvoice(orderId: string, amountXrp: number): Promise<XRPLInvoiceResult> {
    // Generate unique 32-bit unsigned integer DestinationTag (1 - 2,147,483,647)
    const destinationTag = Math.floor(Math.random() * 2000000000) + 1;
    const amountDrops = (amountXrp * 1000000).toString(); // 1 XRP = 1,000,000 drops

    return {
      orderId,
      xrplAddress: this.XRPL_DESTINATION_ADDRESS,
      destinationTag,
      amountXrp,
      amountDrops,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 mins TTL
    };
  }

  static verifyTransactionMemo(txMemo: string, destinationTag: number): boolean {
    return txMemo.includes(destinationTag.toString());
  }
}
