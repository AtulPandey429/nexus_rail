import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { MongoService, MongoUserDoc, MongoOrderDoc } from '../services/mongo.js';
import { AuthService } from '../services/auth.js';
import { signToken } from '../services/jwt.js';

export class UserController {
  /**
   * GET /api/v1/user/profile
   * Returns authenticated user profile, verified wallets, and activity summary
   */
  static async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const usersCol = await MongoService.getCollection<MongoUserDoc>('users');
      let user: MongoUserDoc | null = await usersCol.findOne({ id: userId });

      // Fallback lookup if token user id was generated dynamically
      if (!user && req.user?.email) {
        user = await usersCol.findOne({ email: req.user.email });
      }
      if (!user && req.user?.walletAddress) {
        user = await usersCol.findOne({
          $or: [
            { walletAddress: req.user.walletAddress },
            { stellarAddress: req.user.walletAddress },
            { xrplAddress: req.user.walletAddress },
          ],
        });
      }

      // Auto-upsert Mongo user record if user is authenticating for the first time
      if (!user) {
        const now = new Date().toISOString();
        const rawAddr = req.user?.walletAddress || '';
        const isStellar = rawAddr.startsWith('G') && rawAddr.length === 56;
        const isXrpl = rawAddr.startsWith('r') && rawAddr.length >= 25 && rawAddr.length <= 35;
        const network: 'stellar' | 'xrpl' | null = isStellar ? 'stellar' : isXrpl ? 'xrpl' : null;

        const newUser: MongoUserDoc = {
          id: userId,
          name: req.user?.name || (req.user?.email ? req.user.email.split('@')[0] : 'Traveler'),
          email: req.user?.email,
          role: (req.user?.role as 'user' | 'admin') || 'user',
          walletAddress: rawAddr || undefined,
          stellarAddress: req.user?.stellarAddress || (isStellar ? rawAddr : undefined),
          xrplAddress: req.user?.xrplAddress || (isXrpl ? rawAddr : undefined),
          wallets: network && rawAddr ? [
            {
              network,
              address: rawAddr,
              provider: network === 'stellar' ? 'Freighter' : 'GemWallet',
              connectedAt: now,
              verified: true,
            },
          ] : [],
          lastConnectedWallet: network && rawAddr ? {
            network,
            provider: network === 'stellar' ? 'Freighter' : 'GemWallet',
            address: rawAddr,
            connectedAt: now,
          } : undefined,
          createdAt: now,
          updatedAt: now,
        };
        await usersCol.insertOne(newUser);
        user = newUser;
      }

      const activeUser = user!;

      // Resolve exactly 2 allowed wallet rails: 1 Stellar + 1 XRPL
      const resolvedStellar =
        activeUser.stellarAddress ||
        activeUser.wallets?.find((w: any) => w.network === 'stellar')?.address ||
        (activeUser.lastConnectedWallet?.network === 'stellar' ? activeUser.lastConnectedWallet.address : null) ||
        (activeUser.walletAddress?.startsWith('G') ? activeUser.walletAddress : null);

      const resolvedXrpl =
        activeUser.xrplAddress ||
        activeUser.wallets?.find((w: any) => w.network === 'xrpl')?.address ||
        (activeUser.lastConnectedWallet?.network === 'xrpl' ? activeUser.lastConnectedWallet.address : null) ||
        (activeUser.walletAddress?.startsWith('r') ? activeUser.walletAddress : null);

      // Build normalized dual-rail wallets array (maximum 1 per network)
      const normalizedWallets: MongoUserDoc['wallets'] = [];
      if (resolvedStellar) {
        const existingStellar = activeUser.wallets?.find((w: any) => w.network === 'stellar');
        normalizedWallets.push({
          network: 'stellar',
          address: resolvedStellar,
          provider: existingStellar?.provider || (activeUser.lastConnectedWallet?.network === 'stellar' ? activeUser.lastConnectedWallet.provider : 'Freighter'),
          connectedAt: existingStellar?.connectedAt || activeUser.lastConnectedWallet?.connectedAt || activeUser.createdAt,
          verified: true,
        });
      }
      if (resolvedXrpl) {
        const existingXrpl = activeUser.wallets?.find((w: any) => w.network === 'xrpl');
        normalizedWallets.push({
          network: 'xrpl',
          address: resolvedXrpl,
          provider: existingXrpl?.provider || (activeUser.lastConnectedWallet?.network === 'xrpl' ? activeUser.lastConnectedWallet.provider : 'GemWallet'),
          connectedAt: existingXrpl?.connectedAt || activeUser.lastConnectedWallet?.connectedAt || activeUser.createdAt,
          verified: true,
        });
      }

      // Sync back any resolved fields to DB if needed
      if (activeUser.stellarAddress !== resolvedStellar || activeUser.xrplAddress !== resolvedXrpl) {
        await usersCol.updateOne(
          { id: activeUser.id },
          {
            $set: {
              stellarAddress: resolvedStellar || undefined,
              xrplAddress: resolvedXrpl || undefined,
              wallets: normalizedWallets,
              updatedAt: new Date().toISOString(),
            },
          }
        );
      }

      // Fetch order summary stats for this user
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const userOrders = await ordersCol.find({ user_id: userId }).toArray();
      const totalOrders = userOrders.length;
      const totalSpentCents = userOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0);

      return res.json({
        success: true,
        profile: {
          id: activeUser.id,
          name: activeUser.name || (activeUser.email ? activeUser.email.split('@')[0] : 'Traveler'),
          email: activeUser.email || null,
          role: activeUser.role,
          walletAddress: activeUser.walletAddress || resolvedStellar || resolvedXrpl || null,
          stellarAddress: resolvedStellar || null,
          xrplAddress: resolvedXrpl || null,
          lastConnectedWallet: activeUser.lastConnectedWallet || (normalizedWallets[0] ? {
            network: normalizedWallets[0].network,
            provider: normalizedWallets[0].provider,
            address: normalizedWallets[0].address,
            connectedAt: normalizedWallets[0].connectedAt,
          } : null),
          wallets: normalizedWallets,
          createdAt: activeUser.createdAt,
          updatedAt: activeUser.updatedAt,
          stats: {
            totalOrders,
            totalSpentCents,
          },
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch user profile' });
    }
  }

  /**
   * PUT /api/v1/user/profile
   * Allows user to update permitted profile fields (name)
   */
  static async updateProfile(req: AuthenticatedRequest, res: Response) {
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
  }

  /**
   * POST /api/v1/user/wallets/connect
   * Connect or replace a wallet on a specific blockchain network
   */
  static async connectWallet(req: AuthenticatedRequest, res: Response) {
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
      let userDoc: MongoUserDoc | null = await usersCol.findOne({ id: userId });

      if (!userDoc && req.user?.email) {
        userDoc = await usersCol.findOne({ email: req.user.email });
      }
      if (!userDoc && req.user?.walletAddress) {
        userDoc = await usersCol.findOne({
          $or: [
            { walletAddress: req.user.walletAddress },
            { stellarAddress: req.user.walletAddress },
            { xrplAddress: req.user.walletAddress },
          ],
        });
      }

      if (!userDoc) {
        const newUserDoc: MongoUserDoc = {
          id: userId,
          name: req.user?.name || (isStellar ? 'Stellar Traveler' : 'XRPL Traveler'),
          email: req.user?.email,
          role: (req.user?.role as 'user' | 'admin') || 'user',
          walletAddress: rawAddress,
          stellarAddress: isStellar ? rawAddress : undefined,
          xrplAddress: isXrpl ? rawAddress : undefined,
          wallets: [],
          createdAt: now,
          updatedAt: now,
        };
        await usersCol.insertOne(newUserDoc);
        userDoc = newUserDoc;
      }

      const activeDoc = userDoc!;

      // Enforce exactly 1 wallet per network: remove existing wallet for this network
      const updatedWallets = (activeDoc.wallets || []).filter((w: any) => w.network !== network);
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
        if (!activeDoc.walletAddress || activeDoc.walletAddress === activeDoc.stellarAddress) {
          updateFields.walletAddress = rawAddress;
        }
      } else {
        updateFields.xrplAddress = rawAddress;
        if (!activeDoc.walletAddress || activeDoc.walletAddress === activeDoc.xrplAddress) {
          updateFields.walletAddress = rawAddress;
        }
      }

      await usersCol.updateOne({ id: activeDoc.id }, { $set: updateFields });
      const freshUser = await usersCol.findOne({ id: activeDoc.id });

      const tokenUser = {
        id: freshUser!.id,
        name: freshUser!.name,
        email: freshUser!.email,
        walletAddress: freshUser!.walletAddress,
        stellarAddress: freshUser!.stellarAddress,
        xrplAddress: freshUser!.xrplAddress,
        role: (freshUser!.role as 'user' | 'admin') || 'user',
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
  }

  /**
   * POST /api/v1/user/wallets/disconnect
   * Disconnects a wallet from a specific blockchain network
   */
  static async disconnectWallet(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { network } = req.body;

      if (network !== 'stellar' && network !== 'xrpl') {
        return res.status(400).json({ success: false, error: 'Network must be "stellar" or "xrpl"' });
      }

      const usersCol = await MongoService.getCollection<MongoUserDoc>('users');
      let userDoc: MongoUserDoc | null = await usersCol.findOne({ id: userId });
      if (!userDoc && req.user?.email) {
        userDoc = await usersCol.findOne({ email: req.user.email });
      }

      if (!userDoc) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const activeDoc = userDoc!;
      const updatedWallets = (activeDoc.wallets || []).filter((w: any) => w.network !== network);
      const updateFields: any = {
        wallets: updatedWallets,
        updatedAt: new Date().toISOString(),
      };

      if (network === 'stellar') {
        updateFields.stellarAddress = null;
        if (activeDoc.walletAddress === activeDoc.stellarAddress) {
          updateFields.walletAddress = activeDoc.xrplAddress || null;
        }
      } else {
        updateFields.xrplAddress = null;
        if (activeDoc.walletAddress === activeDoc.xrplAddress) {
          updateFields.walletAddress = activeDoc.stellarAddress || null;
        }
      }

      // Switch or clear lastConnectedWallet if it matches the disconnected network
      if (activeDoc.lastConnectedWallet?.network === network) {
        const remainingWallet = updatedWallets[0];
        if (remainingWallet) {
          updateFields.lastConnectedWallet = {
            network: remainingWallet.network,
            provider: remainingWallet.provider,
            address: remainingWallet.address,
            connectedAt: remainingWallet.connectedAt,
          };
        } else {
          updateFields.lastConnectedWallet = null;
        }
      }

      await usersCol.updateOne({ id: activeDoc.id }, { $set: updateFields });
      const freshUser = await usersCol.findOne({ id: activeDoc.id });

      const tokenUser = {
        id: freshUser!.id,
        name: freshUser!.name,
        email: freshUser!.email,
        walletAddress: freshUser!.walletAddress || undefined,
        stellarAddress: freshUser!.stellarAddress || undefined,
        xrplAddress: freshUser!.xrplAddress || undefined,
        role: (freshUser!.role as 'user' | 'admin') || 'user',
      };
      const newToken = signToken(tokenUser);

      return res.json({
        success: true,
        message: `${network === 'stellar' ? 'Stellar' : 'XRP Ledger'} wallet disconnected`,
        user: tokenUser,
        token: newToken,
        lastConnectedWallet: freshUser!.lastConnectedWallet || null,
        wallets: freshUser!.wallets,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message || 'Failed to disconnect wallet' });
    }
  }
}
