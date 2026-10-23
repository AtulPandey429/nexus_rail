import { requiredEnv } from '../config/env.js';

export class IpfsService {
  static async pinOrderReceipt(orderId: string, orderData: Record<string, unknown>) {
    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requiredEnv('PINATA_JWT')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pinataContent: { orderId, ...orderData },
        pinataMetadata: { name: `nexusrail-order-${orderId}` },
      }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.IpfsHash) {
      throw new Error(payload?.error?.details || payload?.error || `Pinata returned ${res.status}`);
    }
    return {
      orderId,
      ipfsCid: payload.IpfsHash as string,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${payload.IpfsHash}`,
      pinnedAt: new Date().toISOString(),
    };
  }
}
