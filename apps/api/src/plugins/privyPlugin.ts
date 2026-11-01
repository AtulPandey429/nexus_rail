export interface PrivyUserSession {
  privyDid: string;
  embeddedWalletAddress: string;
  email?: string;
  authenticated: boolean;
}

export class PrivyPlugin {
  static async verifyPrivySession(privyDid: string): Promise<PrivyUserSession> {
    return {
      privyDid,
      embeddedWalletAddress: '0xprivy' + privyDid.substring(0, 10),
      email: 'user@privy.auth',
      authenticated: true,
    };
  }
}
