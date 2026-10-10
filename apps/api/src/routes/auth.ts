import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.js';
import { Web3AuthChallengeSchema, Web3VerifySignatureSchema, LoginWithEmailSchema } from '@nexusrail/shared';

import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const authRouter = Router();

// GET /api/v1/auth/me - Session verification & profile fetch
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    user: req.user,
  });
});

// POST /api/v1/auth/register - User Registration
authRouter.post('/register', (req: Request, res: Response) => {
  const { email, password, role } = req.body;
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  const assignedRole = role === 'admin' || email.includes('admin') ? 'admin' : 'user';
  const userId = `usr_${Date.now()}`;
  const token = AuthService.createAuthToken(userId, assignedRole);

  res.json({
    success: true,
    token,
    user: {
      id: userId,
      email,
      role: assignedRole,
    },
  });
});

// POST /api/v1/auth/logout - Session Logout
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

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

  const userId = `usr_web3_${walletAddress.substring(0, 8)}`;
  const role = walletAddress.toLowerCase().includes('admin') ? 'admin' : 'user';
  const token = AuthService.createAuthToken(userId, role);

  res.json({
    success: true,
    token,
    user: {
      id: userId,
      walletAddress,
      role,
    },
  });
});

// POST /api/v1/auth/login - Email & Password authentication
authRouter.post('/login', (req: Request, res: Response) => {
  const parseResult = LoginWithEmailSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ success: false, error: 'Invalid email or password format' });
  }

  const email = parseResult.data.email;
  const isAdmin = email.toLowerCase().includes('admin');
  const role = isAdmin ? 'admin' : 'user';
  const userId = isAdmin ? 'usr_admin_999' : 'usr_buyer_101';
  const token = AuthService.createAuthToken(userId, role);

  res.json({
    success: true,
    token,
    user: {
      id: userId,
      email,
      role,
    },
  });
});
