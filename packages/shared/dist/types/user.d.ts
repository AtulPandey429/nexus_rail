export type UserRole = 'user' | 'admin';
export interface UserProfile {
    id: string;
    email?: string;
    walletAddress?: string;
    xrplAddress?: string;
    passkeyId?: string;
    privyDid?: string;
    role: UserRole;
    createdAt: string;
}
//# sourceMappingURL=user.d.ts.map