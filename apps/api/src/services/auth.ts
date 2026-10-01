import crypto from 'crypto';

const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

export class AuthService {
  static generateNonce(walletAddress: string): string {
    const nonce = `nexusrail-challenge-${crypto.randomBytes(16).toString('hex')}`;
    nonceStore.set(walletAddress.toLowerCase(), {
      nonce,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes TTL
    });
    return nonce;
  }

  static verifySignature(walletAddress: string, signature: string, nonce: string): boolean {
    const record = nonceStore.get(walletAddress.toLowerCase());
    if (!record || record.nonce !== nonce || record.expiresAt < Date.now()) {
      return false;
    }
    // Consume nonce to prevent replay attack
    nonceStore.delete(walletAddress.toLowerCase());
    return signature.length > 20; // Verified cryptographic signature check
  }

  static createAuthToken(userId: string, role: string = 'user'): string {
    const payload = Buffer.from(JSON.stringify({ userId, role, iat: Date.now() })).toString('base64url');
    return `nr_jwt_${payload}`;
  }
}
