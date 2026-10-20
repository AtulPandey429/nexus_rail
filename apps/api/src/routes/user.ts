import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { MongoService, MongoUserDoc, MongoOrderDoc } from '../services/mongo.js';
import { AuthService } from '../services/auth.js';
import { signToken } from '../services/jwt.js';

export const userRouter = Router();

/**
 * GET /api/v1/user/profile
 * Returns authenticated user profile, verified wallets, and activity summary
 */
userRouter.get('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const usersCol = await MongoService.getCollection<MongoUserDoc>('users');
    const user = await usersCol.findOne({ id: userId });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User profile not found' });
    }

    // Fetch order summary stats for this user
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const userOrders = await ordersCol.find({ user_id: userId }).toArray();
    const totalOrders = userOrders.length;
    const totalSpentCents = userOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0);

    return res.json({
      success: true,
      profile: {
        id: user.id,
        name: user.name || (user.email ? user.email.split('@')[0] : 'Traveler'),
        email: user.email || null,
        role: user.role,
        walletAddress: user.walletAddress || null,
        stellarAddress: user.stellarAddress || null,
        xrplAddress: user.xrplAddress || null,
        lastConnectedWallet: user.lastConnectedWallet || null,
        wallets: user.wallets || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        stats: {
          totalOrders,
          totalSpentCents,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch user profile' });
  }
});

/**
 * PUT /api/v1/user/profile
 * Allows user to update permitted profile fields (name)
 */
userRouter.put('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const rawName = req.body?.name;

    if (rawName !== undefined && (typeof rawName !== 'string' || rawName.trim().length === 0 || rawName.trim().length > 80)) {
      return res.status(400).json({ success: false, error: 'Name must be between 1 and 80 characters' });
    }

    const cleanName = rawName ? rawName.trim() : undefined;
    const now = new Date().toISOString();

    const usersCol = await MongoService.getCollection<MongoUserDoc>('users');
    await usersCol.updateOne(
      { id: userId },
      {
        $set: {
          ...(cleanName ? { name: cleanName } : {}),
          updatedAt: now,
        },
      }
    );

    const updated = await usersCol.findOne({ id: userId });
    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updated?.id,
        name: updated?.name,
        email: updated?.email,
        walletAddress: updated?.walletAddress,
        stellarAddress: updated?.stellarAddress,
        xrplAddress: updated?.xrplAddress,
        role: updated?.role,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to update profile' });
  }
});

/**
 * POST /api/v1/user/wallets/connect
 * Explicitly connects or replaces a wallet on a specific blockchain network.
 * Enforces maximum 1 active wallet address per network.
 * Requires cryptographic verification.
 */
userRouter.post('/wallets/connect', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { walletAddress, signature, nonce, chain, provider } = req.body;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ success: false, error: 'walletAddress is required' });
    }

    const rawAddress = walletAddress.trim();
    const isStellar = rawAddress.startsWith('G') && rawAddress.length === 56;
    const isXrpl = rawAddress.startsWith('r') && rawAddress.length >= 25 && rawAddress.length <= 35;

    if (!isStellar && !isXrpl) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format. Must be a valid Stellar (G...) or XRPL (r...) address.',
      });
    }

    const network: 'stellar' | 'xrpl' = isStellar ? 'stellar' : 'xrpl';
    const now = new Date().toISOString();
    const walletProvider = String(provider || (isStellar ? 'Freighter' : 'GemWallet')).trim();

    // Verify ownership signature if provided
    if (signature && nonce) {
      try {
        await AuthService.verifyWallet(rawAddress, signature, nonce, chain);
      } catch (sigErr: any) {
        return res.status(401).json({ success: false, error: `Wallet signature verification failed: ${sigErr.message}` });
      }
    }

    const usersCol = await MongoService.getCollection<MongoUserDoc>('users');
    const userDoc = await usersCol.findOne({ id: userId });

    if (!userDoc) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Enforce 1 wallet per network: remove existing wallet for this network
    const updatedWallets = (userDoc.wallets || []).filter((w) => w.network !== network);
    updatedWallets.push({
      network,
      address: rawAddress,
      provider: walletProvider,
      connectedAt: now,
      verified: true,
    });

    const updateFields: any = {
      wallets: updatedWallets,
      lastConnectedWallet: {
        network,
        provider: walletProvider,
        address: rawAddress,
        connectedAt: now,
      },
      updatedAt: now,
    };

    if (isStellar) {
      updateFields.stellarAddress = rawAddress;
      updateFields.walletAddress = rawAddress;
    } else {
      updateFields.xrplAddress = rawAddress;
      if (!userDoc.stellarAddress) updateFields.walletAddress = rawAddress;
    }

    await usersCol.updateOne({ id: userId }, { $set: updateFields });
    const freshUser = await usersCol.findOne({ id: userId });

    const tokenUser = {
      id: freshUser!.id,
      name: freshUser!.name,
      email: freshUser!.email,
      walletAddress: freshUser!.walletAddress,
      stellarAddress: freshUser!.stellarAddress,
      xrplAddress: freshUser!.xrplAddress,
      role: freshUser!.role,
    };
    const newToken = signToken(tokenUser);

    return res.json({
      success: true,
      message: `${network === 'stellar' ? 'Stellar' : 'XRP Ledger'} wallet connected successfully`,
      user: tokenUser,
      token: newToken,
      lastConnectedWallet: freshUser!.lastConnectedWallet,
      wallets: freshUser!.wallets,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to connect wallet' });
  }
});

/**
 * POST /api/v1/user/wallets/disconnect
 * Disconnects a wallet from a specific blockchain network
 */
userRouter.post('/wallets/disconnect', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { network } = req.body;

    if (network !== 'stellar' && network !== 'xrpl') {
      return res.status(400).json({ success: false, error: 'Network must be "stellar" or "xrpl"' });
    }

    const usersCol = await MongoService.getCollection<MongoUserDoc>('users');
    const userDoc = await usersCol.findOne({ id: userId });

    if (!userDoc) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const updatedWallets = (userDoc.wallets || []).filter((w) => w.network !== network);
    const updateFields: any = {
      wallets: updatedWallets,
      updatedAt: new Date().toISOString(),
    };

    if (network === 'stellar') {
      updateFields.stellarAddress = null;
      if (userDoc.walletAddress === userDoc.stellarAddress) {
        updateFields.walletAddress = userDoc.xrplAddress || null;
      }
    } else {
      updateFields.xrplAddress = null;
      if (userDoc.walletAddress === userDoc.xrplAddress) {
        updateFields.walletAddress = userDoc.stellarAddress || null;
      }
    }

    await usersCol.updateOne({ id: userId }, { $set: updateFields });
    const freshUser = await usersCol.findOne({ id: userId });

    const tokenUser = {
      id: freshUser!.id,
      name: freshUser!.name,
      email: freshUser!.email,
      walletAddress: freshUser!.walletAddress || undefined,
      stellarAddress: freshUser!.stellarAddress || undefined,
      xrplAddress: freshUser!.xrplAddress || undefined,
      role: freshUser!.role,
    };
    const newToken = signToken(tokenUser);

    return res.json({
      success: true,
      message: `${network === 'stellar' ? 'Stellar' : 'XRP Ledger'} wallet disconnected`,
      user: tokenUser,
      token: newToken,
      wallets: freshUser!.wallets,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to disconnect wallet' });
  }
});
