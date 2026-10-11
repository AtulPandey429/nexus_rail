import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.js';
import { LoginWithEmailSchema, Web3AuthChallengeSchema, Web3VerifySignatureSchema } from '@nexusrail/shared';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const freshUser = req.user?.id ? await AuthService.getUserById(req.user.id) : null;
    res.json({ success: true, user: freshUser || req.user });
  } catch (error) {
    res.json({ success: true, user: req.user });
  }
});

authRouter.post('/register', async (req: Request, res: Response) => {
  const email = req.body?.email;
  const password = req.body?.password;
  if (typeof email !== 'string' || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ success: false, error: 'Email and a password of at least 8 characters are required' });
  }
  try {
    const result = await AuthService.register(email, password);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Registration failed' });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginWithEmailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid email or password format' });
  try {
    const result = await AuthService.login(parsed.data.email, parsed.data.password);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(401).json({ success: false, error: error instanceof Error ? error.message : 'Login failed' });
  }
});

authRouter.post('/nonce', async (req: Request, res: Response) => {
  const parsed = Web3AuthChallengeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid wallet address' });
  try {
    const nonce = await AuthService.createNonce(parsed.data.walletAddress);
    res.json({ success: true, nonce });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Could not create a challenge' });
  }
});

authRouter.post('/verify-signature', async (req: Request, res: Response) => {
  const parsed = Web3VerifySignatureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid signature payload' });
  try {
    const result = await AuthService.verifyWallet(parsed.data.walletAddress, parsed.data.signature, parsed.data.nonce);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(401).json({ success: false, error: error instanceof Error ? error.message : 'Signature rejected' });
  }
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Signed out' });
});
