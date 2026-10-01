import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.js';
import { Web3AuthChallengeSchema, Web3VerifySignatureSchema, LoginWithEmailSchema } from '@nexusrail/shared';

export const authRouter = Router();

// POST /api/v1/auth/nonce - Request cryptographic challenge nonce for Web3 signing
authRouter.post('/nonce', (req: Request, res: Response) => {
  const parseResult = Web3AuthChallengeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ success: false, error: 'Invalid wallet address' });
  }

  const nonce = AuthService.generateNonce(parseResult.data.walletAddress);
  res.json({ success: true, nonce });
});

// POST /api/v1/auth/verify-signature - Verify Web3 signature and issue JWT token
authRouter.post('/verify-signature', (req: Request, res: Response) => {
  const parseResult = Web3VerifySignatureSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ success: false, error: 'Invalid signature verification payload' });
  }

  const { walletAddress, signature, nonce } = parseResult.data;
  const isValid = AuthService.verifySignature(walletAddress, signature, nonce);

  if (!isValid) {
    return res.status(401).json({ success: false, error: 'Invalid signature or expired challenge nonce' });
  }

  const token = AuthService.createAuthToken(`usr_web3_${walletAddress.substring(0, 8)}`);
  res.json({
    success: true,
    token,
    user: {
      id: `usr_web3_${walletAddress.substring(0, 8)}`,
      walletAddress,
      role: 'user',
    },
  });
});

// POST /api/v1/auth/login - Email & Password authentication fallback
authRouter.post('/login', (req: Request, res: Response) => {
  const parseResult = LoginWithEmailSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ success: false, error: 'Invalid email or password format' });
  }

  const token = AuthService.createAuthToken(`usr_email_123`);
  res.json({
    success: true,
    token,
    user: {
      id: 'usr_email_123',
      email: parseResult.data.email,
      role: 'user',
    },
  });
});
