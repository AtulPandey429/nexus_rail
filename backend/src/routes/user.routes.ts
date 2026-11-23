import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { UserController } from '../controllers/user.controller.js';

export const userRouter = Router();

// GET /api/v1/user/profile - User profile, verified wallets & activity summary
userRouter.get('/profile', requireAuth, UserController.getProfile);

// PUT /api/v1/user/profile - Update user profile
userRouter.put('/profile', requireAuth, UserController.updateProfile);

// POST /api/v1/user/wallets/connect - Connect / replace wallet
userRouter.post('/wallets/connect', requireAuth, UserController.connectWallet);

// POST /api/v1/user/wallets/disconnect - Disconnect wallet
userRouter.post('/wallets/disconnect', requireAuth, UserController.disconnectWallet);
