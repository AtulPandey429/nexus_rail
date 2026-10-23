export interface NexusPasskeySession {
  passkeyId: string;
  embeddedWalletAddress: string;
  email?: string;
  authenticated: boolean;
}

export class NexusPasskeyPlugin {
  static async verifyPasskeySession(passkeyId: string): Promise<NexusPasskeySession> {
    return {
      passkeyId,
      embeddedWalletAddress: '0xpasskey' + passkeyId.substring(0, 10),
      email: 'user@nexusrail.auth',
      authenticated: true,
    };
  }

  // Alias for compatibility
  static async verifyPrivySession(passkeyId: string): Promise<NexusPasskeySession> {
    return this.verifyPasskeySession(passkeyId);
  }
}

export const PrivyPlugin = NexusPasskeyPlugin;
export type PrivyUserSession = NexusPasskeySession;
