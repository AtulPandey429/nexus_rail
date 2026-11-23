import { Request, Response } from 'express';
import crypto from 'crypto';
import { AuthService } from '../services/auth.js';
import { signToken } from '../services/jwt.js';
import { LoginWithEmailSchema, Web3AuthChallengeSchema, Web3VerifySignatureSchema } from '../types/index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { MongoService, MongoUserDoc } from '../services/mongo.js';

export class AuthController {
  /**
   * GET /api/v1/auth/me
   */
  static async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const freshUser = req.user?.id ? await AuthService.getUserById(req.user.id) : null;
      res.json({ success: true, user: freshUser || req.user });
    } catch {
      res.json({ success: true, user: req.user });
    }
  }

  /**
   * POST /api/v1/auth/register
   */
  static async register(req: Request, res: Response): Promise<void> {
    const email = req.body?.email;
    const password = req.body?.password;
    if (typeof email !== 'string' || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ success: false, error: 'Email and a password of at least 8 characters are required' });
      return;
    }
    try {
      const result = await AuthService.register(email, password);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Registration failed' });
    }
  }

  /**
   * POST /api/v1/auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    const parsed = LoginWithEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid email or password format' });
      return;
    }
    try {
      const result = await AuthService.login(parsed.data.email, parsed.data.password);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(401).json({ success: false, error: error instanceof Error ? error.message : 'Login failed' });
    }
  }

  /**
   * POST /api/v1/auth/nonce
   */
  static async createNonce(req: Request, res: Response): Promise<void> {
    const parsed = Web3AuthChallengeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid wallet address' });
      return;
    }
    try {
      const nonce = await AuthService.createNonce(parsed.data.walletAddress);
      res.json({ success: true, nonce });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Could not create a challenge' });
    }
  }

  /**
   * POST /api/v1/auth/verify-signature
   */
  static async verifySignature(req: Request, res: Response): Promise<void> {
    const parsed = Web3VerifySignatureSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid signature payload' });
      return;
    }
    try {
      const chain = String(req.body?.chain || '').toLowerCase();
      const result = await AuthService.verifyWallet(parsed.data.walletAddress, parsed.data.signature, parsed.data.nonce, chain);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(401).json({ success: false, error: error instanceof Error ? error.message : 'Signature rejected' });
    }
  }

  /**
   * POST /api/v1/auth/wallet-login
   */
  static async walletLogin(req: Request, res: Response): Promise<void> {
    const walletAddress = String(req.body?.walletAddress || '').trim();
    const walletName = String(req.body?.walletName || 'Wallet').trim();
    const rawChain = String(req.body?.chain || '').toLowerCase();

    if (!walletAddress) {
      res.status(400).json({ success: false, error: 'walletAddress is required' });
      return;
    }

    const isStellar = walletAddress.startsWith('G') || rawChain === 'stellar';
    const isXrpl = walletAddress.startsWith('r') || rawChain === 'xrpl';
    const network: 'stellar' | 'xrpl' = isStellar ? 'stellar' : 'xrpl';
    const userId = `usr_${walletName.toLowerCase()}_${walletAddress.slice(0, 8)}`;
    const now = new Date().toISOString();

    try {
      const usersCol = await MongoService.getCollection<MongoUserDoc>('users');
      let userDoc: MongoUserDoc | null = await usersCol.findOne({
        $or: [
          { id: userId },
          { walletAddress },
          { stellarAddress: walletAddress },
          { xrplAddress: walletAddress },
        ],
      });

      const lastConnected = {
        network,
        provider: walletName,
        address: walletAddress,
        connectedAt: now,
      };

      if (userDoc) {
        const updateFields: any = {
          updatedAt: now,
          lastConnectedWallet: lastConnected,
        };
        if (isStellar && !userDoc.stellarAddress) updateFields.stellarAddress = walletAddress;
        if (isXrpl && !userDoc.xrplAddress) updateFields.xrplAddress = walletAddress;
        if (!userDoc.walletAddress) updateFields.walletAddress = walletAddress;

        const existingWallets = (userDoc.wallets || []).filter((w: any) => w.network !== network);
        existingWallets.push({
          network,
          address: walletAddress,
          provider: walletName,
          connectedAt: now,
          verified: true,
        });
        updateFields.wallets = existingWallets;

        await usersCol.updateOne({ id: userDoc.id }, { $set: updateFields });
        userDoc = { ...userDoc, ...updateFields };
      } else {
        const newUserDoc: MongoUserDoc = {
          id: userId,
          name: `${walletName} Traveler`,
          email: `${walletName.toLowerCase()}_${walletAddress.slice(-4)}@nexusrail.dev`,
          walletAddress,
          stellarAddress: isStellar ? walletAddress : undefined,
          xrplAddress: isXrpl ? walletAddress : undefined,
          role: 'user',
          wallets: [
            {
              network,
              address: walletAddress,
              provider: walletName,
              connectedAt: now,
              verified: true,
            },
          ],
          lastConnectedWallet: lastConnected,
          createdAt: now,
          updatedAt: now,
        };
        await usersCol.insertOne(newUserDoc);
        userDoc = newUserDoc;
      }

      const activeUser = userDoc!;
      const tokenUser = {
        id: activeUser.id,
        name: activeUser.name,
        email: activeUser.email,
        walletAddress: activeUser.walletAddress,
        stellarAddress: activeUser.stellarAddress,
        xrplAddress: activeUser.xrplAddress,
        role: activeUser.role,
      };
      const token = signToken(tokenUser);
      res.json({
        success: true,
        token,
        user: tokenUser,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to issue wallet session' });
    }
  }

  /**
   * POST /api/v1/auth/manual-wallet
   */
  static async manualWallet(req: Request, res: Response): Promise<void> {
    const rawAddress = String(req.body?.address || '').trim();
    const rawChain = String(req.body?.chain || '').toLowerCase().trim();

    if (!rawAddress) {
      res.status(400).json({ success: false, error: 'Wallet address is required' });
      return;
    }

    let chain: 'stellar' | 'xrpl' | 'evm' = 'stellar';
    if (rawChain === 'xrpl' || rawAddress.startsWith('r')) {
      chain = 'xrpl';
      if (!rawAddress.startsWith('r') || rawAddress.length < 25 || rawAddress.length > 35) {
        res.status(400).json({
          success: false,
          error: 'Invalid XRPL address format. An XRPL public address must start with "r" and be 25 to 35 characters long.',
        });
        return;
      }
    } else if (rawChain === 'evm' || rawAddress.startsWith('0x')) {
      chain = 'evm';
      if (!/^0x[a-fA-F0-9]{40}$/.test(rawAddress)) {
        res.status(400).json({
          success: false,
          error: 'Invalid EVM address format. Must be a 42-character hex address starting with "0x".',
        });
        return;
      }
    } else {
      chain = 'stellar';
      if (!rawAddress.startsWith('G') || rawAddress.length !== 56) {
        res.status(400).json({
          success: false,
          error: 'Invalid Stellar address format. A Stellar public key must start with "G" and be exactly 56 characters long.',
        });
        return;
      }
    }

    try {
      const isStellar = chain === 'stellar';
      const isXrpl = chain === 'xrpl';
      const network: 'stellar' | 'xrpl' = isStellar ? 'stellar' : 'xrpl';
      const userId = `usr_${chain}_${rawAddress.slice(0, 8)}`;
      const now = new Date().toISOString();
      const provider = isStellar ? 'Freighter' : isXrpl ? 'GemWallet' : 'Web3';

      const usersCol = await MongoService.getCollection<MongoUserDoc>('users');
      let userDoc: MongoUserDoc | null = await usersCol.findOne({
        $or: [
          { id: userId },
          { walletAddress: rawAddress },
          { stellarAddress: rawAddress },
          { xrplAddress: rawAddress },
        ],
      });

      const lastConnected = {
        network,
        provider,
        address: rawAddress,
        connectedAt: now,
      };

      if (userDoc) {
        const updateFields: any = {
          updatedAt: now,
          lastConnectedWallet: lastConnected,
        };
        if (isStellar && !userDoc.stellarAddress) updateFields.stellarAddress = rawAddress;
        if (isXrpl && !userDoc.xrplAddress) updateFields.xrplAddress = rawAddress;
        if (!userDoc.walletAddress) updateFields.walletAddress = rawAddress;

        const existingWallets = (userDoc.wallets || []).filter((w: any) => w.network !== network);
        existingWallets.push({
          network,
          address: rawAddress,
          provider,
          connectedAt: now,
          verified: true,
        });
        updateFields.wallets = existingWallets;

        await usersCol.updateOne({ id: userDoc.id }, { $set: updateFields });
        userDoc = { ...userDoc, ...updateFields };
      } else {
        const newUserDoc: MongoUserDoc = {
          id: userId,
          name: `${provider} Traveler`,
          email: `${chain}_${rawAddress.slice(-4)}@nexusrail.dev`,
          walletAddress: rawAddress,
          stellarAddress: isStellar ? rawAddress : undefined,
          xrplAddress: isXrpl ? rawAddress : undefined,
          role: 'user',
          wallets: [
            {
              network,
              address: rawAddress,
              provider,
              connectedAt: now,
              verified: true,
            },
          ],
          lastConnectedWallet: lastConnected,
          createdAt: now,
          updatedAt: now,
        };
        await usersCol.insertOne(newUserDoc);
        userDoc = newUserDoc;
      }

      const activeUser = userDoc!;
      const tokenUser = {
        id: activeUser.id,
        name: activeUser.name,
        email: activeUser.email,
        walletAddress: activeUser.walletAddress,
        stellarAddress: activeUser.stellarAddress,
        xrplAddress: activeUser.xrplAddress,
        role: activeUser.role,
      };
      const token = signToken(tokenUser);
      res.json({
        success: true,
        token,
        user: tokenUser,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to authenticate manual wallet address' });
    }
  }

  /**
   * POST /api/v1/auth/google
   */
  static async googleLogin(req: Request, res: Response): Promise<void> {
    try {
      const credential = req.body?.credential;
      let email = String(req.body?.email || '').toLowerCase().trim();
      let name = String(req.body?.name || '').trim();
      let googleId = String(req.body?.googleId || '').trim();

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
        res.status(400).json({ success: false, error: 'Valid Google email is required' });
        return;
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
  }

  /**
   * POST /api/v1/auth/logout
   */
  static logout(_req: Request, res: Response): void {
    res.json({ success: true, message: 'Signed out' });
  }
}
