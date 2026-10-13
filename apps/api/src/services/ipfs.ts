import crypto from 'crypto';

export interface IpfsReceiptResult {
  orderId: string;
  ipfsCid: string;
  gatewayUrl: string;
  pinnedAt: string;
}

export class IpfsService {
  static async pinOrderReceipt(orderId: string, orderData: Record<string, any>): Promise<IpfsReceiptResult> {
    // Generate deterministic mock IPFS CID v1 (bafybeic...)
    const mockHash = crypto.createHash('sha256').update(JSON.stringify(orderData)).digest('hex').substring(0, 32);
    const ipfsCid = `bafybeic${mockHash}nexusrail`;
    
    return {
      orderId,
      ipfsCid,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${ipfsCid}`,
      pinnedAt: new Date().toISOString(),
    };
  }
}
