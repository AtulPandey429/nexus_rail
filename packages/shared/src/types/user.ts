export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  email?: string;
  walletAddress?: string;
  xrplAddress?: string;
  privyDid?: string;
  role: UserRole;
  createdAt: string;
}
