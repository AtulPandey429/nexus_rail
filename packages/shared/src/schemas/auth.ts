import { z } from 'zod';

export const LoginWithEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const Web3AuthChallengeSchema = z.object({
  walletAddress: z.string().min(10),
});

export const Web3VerifySignatureSchema = z.object({
  walletAddress: z.string().min(10),
  signature: z.string().min(10),
  nonce: z.string().min(10),
});

export type LoginWithEmailInput = z.infer<typeof LoginWithEmailSchema>;
export type Web3AuthChallengeInput = z.infer<typeof Web3AuthChallengeSchema>;
export type Web3VerifySignatureInput = z.infer<typeof Web3VerifySignatureSchema>;
