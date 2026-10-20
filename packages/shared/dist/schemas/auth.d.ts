import { z } from 'zod';
export declare const LoginWithEmailSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const Web3AuthChallengeSchema: z.ZodObject<{
    walletAddress: z.ZodString;
}, "strip", z.ZodTypeAny, {
    walletAddress: string;
}, {
    walletAddress: string;
}>;
export declare const Web3VerifySignatureSchema: z.ZodObject<{
    walletAddress: z.ZodString;
    signature: z.ZodString;
    nonce: z.ZodString;
}, "strip", z.ZodTypeAny, {
    walletAddress: string;
    signature: string;
    nonce: string;
}, {
    walletAddress: string;
    signature: string;
    nonce: string;
}>;
export type LoginWithEmailInput = z.infer<typeof LoginWithEmailSchema>;
export type Web3AuthChallengeInput = z.infer<typeof Web3AuthChallengeSchema>;
export type Web3VerifySignatureInput = z.infer<typeof Web3VerifySignatureSchema>;
//# sourceMappingURL=auth.d.ts.map