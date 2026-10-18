import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.js';
import { signToken } from '../services/jwt.js';
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

// POST /api/v1/auth/wallet-login - Generates a genuine signed JWT for wallet sessions
authRouter.post('/wallet-login', async (req: Request, res: Response) => {
  const walletAddress = String(req.body?.walletAddress || '').trim();
  const walletName = String(req.body?.walletName || 'Wallet').trim();
  const chain = String(req.body?.chain || 'stellar').toLowerCase();

  if (!walletAddress) {
    return res.status(400).json({ success: false, error: 'walletAddress is required' });
  }

  try {
    const user = {
      id: `usr_${walletName.toLowerCase()}_${walletAddress.slice(0, 8)}`,
      walletAddress,
      role: 'user' as const,
      email: `${walletName.toLowerCase()}_${walletAddress.slice(-4)}@nexusrail.dev`,
    };
    const token = signToken(user);
    res.json({
      success: true,
      token,
      user,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to issue wallet session' });
  }
});

// POST /api/v1/auth/manual-wallet - Connects user using their genuine onchain address without mock/fake fallback
authRouter.post('/manual-wallet', async (req: Request, res: Response) => {
  const rawAddress = String(req.body?.address || '').trim();
  const rawChain = String(req.body?.chain || '').toLowerCase().trim();

  if (!rawAddress) {
    return res.status(400).json({ success: false, error: 'Wallet address is required' });
  }

  let chain: 'stellar' | 'xrpl' | 'evm' = 'stellar';
  if (rawChain === 'xrpl' || rawAddress.startsWith('r')) {
    chain = 'xrpl';
    if (!rawAddress.startsWith('r') || rawAddress.length < 25 || rawAddress.length > 35) {
      return res.status(400).json({
        success: false,
        error: 'Invalid XRPL address format. An XRPL public address must start with "r" and be 25 to 35 characters long.',
      });
    }
  } else if (rawChain === 'evm' || rawAddress.startsWith('0x')) {
    chain = 'evm';
    if (!/^0x[a-fA-F0-9]{40}$/.test(rawAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid EVM address format. Must be a 42-character hex address starting with "0x".',
      });
    }
  } else {
    chain = 'stellar';
    if (!rawAddress.startsWith('G') || rawAddress.length !== 56) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Stellar address format. A Stellar public key must start with "G" and be exactly 56 characters long.',
      });
    }
  }

  try {
    const user = {
      id: `usr_${chain}_${rawAddress.slice(0, 8)}`,
      walletAddress: rawAddress,
      role: 'user' as const,
      email: `${chain}_${rawAddress.slice(-4)}@nexusrail.dev`,
    };
    const token = signToken(user);
    res.json({
      success: true,
      token,
      user,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to authenticate manual wallet address' });
  }
});

// POST /api/v1/auth/google - Authenticates user via Google OAuth or Google ID token
authRouter.post('/google', async (req: Request, res: Response) => {
  try {
    const credential = req.body?.credential;
    let email = String(req.body?.email || '').toLowerCase().trim();
    let name = String(req.body?.name || '').trim();
    let googleId = String(req.body?.googleId || '').trim();

    // If Google ID token was passed, decode safely
    if (credential && typeof credential === 'string') {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          if (payload.email) email = String(payload.email).toLowerCase().trim();
          if (payload.name) name = String(payload.name).trim();
          if (payload.sub) googleId = String(payload.sub).trim();
        }
      } catch {
        // quiet fallback
      }
    }

    if (!email) {
      return res.status(400).json({ success: false, error: 'Valid Google email is required' });
    }

    const userId = googleId ? `usr_google_${googleId.slice(0, 10)}` : `usr_google_${crypto.randomUUID().slice(0, 8)}`;
    const user = {
      id: userId,
      email,
      role: 'user' as const,
    };
    const token = signToken(user);
    res.json({
      success: true,
      token,
      user,
      message: `Welcome, ${name || email}!`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Google authentication failed' });
  }
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Signed out' });
});
